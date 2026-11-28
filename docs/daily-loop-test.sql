-- Rollback-only fixture test for supabase/migrations/20261130130000_daily_loop.sql.
-- Proves: a paused product is hidden with reason 'paused' and only the owner resumes it; the loop's reads return
-- listings with current costs and new-product candidates (never something already on the store or rejected);
-- saving a day's brief is idempotent; approving a retirement takes the product off the store, approving an addition
-- only marks it for the next build; autopilot cannot be switched on through any function; the scheduler does nothing
-- without its Vault secrets; anon and non-members reach nothing.
begin;
do $$
declare u uuid; r uuid; res jsonb; la uuid; lb uuid; j jsonb; n int; pid uuid;
  img1 text := 'https://media.taager.com/11111111-2222-3333-4444-555555555555.jpg';
  fin jsonb := '{"price":140,"originalPrice":77,"profit":63}';
  tpl text := '{"title":"%s","description":"وصف.","image_alt":["صورة"],"category":"%s","seo":{"slug":"%s"},"issues":[]}';
  today date := (now() at time zone 'utc')::date;
begin
 select user_id into u from public.dashboard_members where store_code='sa' limit 1;
 if u is null then raise exception 'No staging owner'; end if;
 insert into public.brain_runs(store_code,stage,status) values('sa','review','awaiting_review') returning id into r;
 insert into public.taager_catalog(market,sku,product_id,variant_id,item_type,name,listing,detail,financials) values
  ('sa','FIXA',900000301,0,'product','a',jsonb_build_object('financials',fin),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img1))),fin),
  ('sa','FIXB',900000302,0,'product','b',jsonb_build_object('financials',fin),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img1))),fin),
  ('sa','FIXNEW',900000309,0,'product','new one',jsonb_build_object('financials',fin,'createdAt',to_char(now() - interval '3 days','YYYY-MM-DD"T"HH24:MI:SS')),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img1))),fin),
  ('sa','FIXREJ',900000310,0,'product','rejected before',jsonb_build_object('financials',fin),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img1))),fin);
 insert into public.brain_product_analysis(run_id,store_code,product_id,variation_id,title,offer_kind,stage,score,decision,content,owner_decision) values
  (r,'sa',900000301,0,'a','single','selected',9,'{"state":"priced","price_minor":14900,"delivery_included":true}',format(tpl,'خلاط','kitchen','blender')::jsonb,'approved'),
  (r,'sa',900000302,0,'b','single','selected',7,'{"state":"priced","price_minor":12900}',format(tpl,'رف','organize','rack')::jsonb,'approved'),
  (r,'sa',900000310,0,'rejected before','single','selected',1,'{"state":"priced","price_minor":12900}',format(tpl,'مرفوض','home','no')::jsonb,'rejected');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 perform public.brain_publish_approved('sa',r);
 select listing_id into la from public.brain_listings where store_code='sa' and sku='FIXA';
 select listing_id into lb from public.brain_listings where store_code='sa' and sku='FIXB';

 -- 1. What the loop reads.
 j := public.brain_daily_listings('sa');
 if not exists (select 1 from jsonb_array_elements(j) x where x->>'listing_id'=la::text and (x->>'cost_minor')::bigint=7700 and (x->>'floor_minor')::bigint=14000
                and (x->'pricing'->>'delivery_included')::boolean and x->>'hidden_reason' is null) then raise exception 'listings %',j; end if;
 j := public.brain_daily_candidates('sa', 60);
 if not exists (select 1 from jsonb_array_elements(j) x where x->>'sku'='FIXNEW') or exists (select 1 from jsonb_array_elements(j) x where x->>'sku' in ('FIXA','FIXB','FIXREJ'))
    then raise exception 'candidates %',(select jsonb_agg(x->>'sku') from jsonb_array_elements(j) x); end if;

 -- 2. The brain pauses B (refusals): hidden at once with the reason; pausing twice changes nothing; the owner resumes.
 if not public.brain_pause_listing('sa', lb, 'Only 10% of 10 finished orders were delivered.') or public.brain_pause_listing('sa', lb, 'again') then raise exception 'pause'; end if;
 if (select hidden_reason from public.brain_listing_state('sa') where listing_id=lb) is distinct from 'paused' or (select hidden_reason from public.brain_listing_state('sa') where listing_id=la) is not null then raise exception 'paused state'; end if;
 res := public.brain_brief('sa');
 if res->'paused'->0->>'reason' not like 'Only 10%%' or res->'paused'->0->>'by'<>'brain' or (res->>'autopilot_enabled')::boolean then raise exception 'brief paused %',res; end if;
 perform public.brain_set_paused('sa', lb, false);
 if (select hidden_reason from public.brain_listing_state('sa') where listing_id=lb) is not null then raise exception 'resume'; end if;

 -- 3. Saving the day: brief + proposals; saving again replaces, never duplicates.
 res := public.brain_daily_save('sa', today, '{"headline":"first","to_approve":{"products_to_add":1}}',
   jsonb_build_array(jsonb_build_object('kind','add_product','ref','FIXNEW','title','new one','why','new at Taager this month.','data',jsonb_build_object('product_id',900000309)),
                     jsonb_build_object('kind','retire_product','ref',lb::text,'title','رف','why','400 views and no orders.'),
                     jsonb_build_object('kind','publish_everything','ref','x','why','not a real kind')));
 if (res->>'proposals')::int<>2 then raise exception 'save %',res; end if;
 perform public.brain_daily_save('sa', today, '{"headline":"second"}',
   jsonb_build_array(jsonb_build_object('kind','add_product','ref','FIXNEW','title','new one','why','new at Taager this month.','data',jsonb_build_object('product_id',900000309)),
                     jsonb_build_object('kind','retire_product','ref',lb::text,'title','رف','why','400 views and no orders.')));
 if (select count(*) from public.brain_briefs where store_code='sa' and day=today)<>1 or (select brief->>'headline' from public.brain_briefs where store_code='sa' and day=today)<>'second'
    or (select count(*) from public.brain_daily_proposals where store_code='sa' and status='proposed')<>2 then raise exception 'not idempotent'; end if;
 res := public.brain_brief('sa');
 if res->'brief'->>'headline'<>'second' or jsonb_array_length(res->'proposals')<>2 or (res->>'day')::date<>today then raise exception 'brief %',res; end if;

 -- 4. Approve all: B leaves the store; the addition is only marked (nothing is published by this).
 n := (select count(*) from public.brain_listings where store_code='sa');
 res := public.brain_daily_decide('sa', null, 'approved');
 if (res->>'decided')::int<>2 or (res->>'retired')::int<>1 or res->'add_product_ids'->>0<>'900000309' then raise exception 'decide %',res; end if;
 if (select hidden_reason from public.brain_listing_state('sa') where listing_id=lb)<>'unpublished' or (select count(*) from public.brain_listings where store_code='sa')<>n
    or exists (select 1 from public.brain_listings where sku='FIXNEW') then raise exception 'effects'; end if;
 if (select status from public.brain_daily_proposals where store_code='sa' and kind='add_product' and ref='FIXNEW' and status<>'superseded')<>'approved' then raise exception 'add status'; end if;
 -- A rejected addition is never proposed again.
 perform public.brain_daily_save('sa', today, '{"headline":"third"}', jsonb_build_array(jsonb_build_object('kind','add_product','ref','FIXB2','title','x','why','because.')));
 select id into pid from public.brain_daily_proposals where store_code='sa' and ref='FIXB2' and status='proposed';
 perform public.brain_daily_decide('sa', array[pid], 'rejected');
 insert into public.taager_catalog(market,sku,product_id,variant_id,item_type,name,listing,detail,financials) values ('sa','FIXB2',900000311,0,'product','x',jsonb_build_object('financials',fin),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img1))),fin);
 if exists (select 1 from jsonb_array_elements(public.brain_daily_candidates('sa',60)) x where x->>'sku'='FIXB2') then raise exception 'rejected candidate proposed again'; end if;

 -- 5. Switches: the loop can be turned off per market; no function turns autopilot on; the scheduler is a no-op without secrets.
 perform public.brain_set_daily_loop('sa', false);
 if (select daily_loop_enabled from public.brain_settings where store_code='sa') or (select autopilot_enabled from public.brain_settings where store_code='sa') then raise exception 'switches'; end if;
 if public.brain_daily_kick() <> 0 then raise exception 'scheduler ran without secrets'; end if;
 if not exists (select 1 from cron.job where jobname='yawmiyati-brain-daily' and schedule='20 3 * * *') then raise exception 'not scheduled'; end if;

 -- 6. Privileges.
 if has_function_privilege('authenticated','public.brain_daily_save(text,date,jsonb,jsonb)','execute') or has_function_privilege('authenticated','public.brain_pause_listing(text,uuid,text)','execute')
    or has_function_privilege('authenticated','public.brain_daily_candidates(text,integer)','execute') or has_function_privilege('anon','public.brain_brief(text,date)','execute')
    or has_function_privilege('authenticated','public.brain_daily_kick()','execute') or has_table_privilege('authenticated','public.brain_briefs','select') then raise exception 'privileges'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin perform public.brain_brief('sa'); raise exception 'a non-member read the brief'; exception when sqlstate '42501' then null; end;
 begin perform public.brain_daily_decide('sa',null,'approved'); raise exception 'a non-member approved'; exception when sqlstate '42501' then null; end;
 begin perform public.brain_set_paused('sa',la,true); raise exception 'a non-member paused'; exception when sqlstate '42501' then null; end;
 raise notice 'daily loop: all checks passed';
end $$;
rollback;
