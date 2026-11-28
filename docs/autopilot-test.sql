-- Rollback-only fixture test for supabase/migrations/20261201100000_autopilot.sql.
-- Proves: autopilot is off and does nothing until the owner switches it on; nobody but a member can switch it and the
-- settings patch cannot; when on it approves a safe price change, leaves a change of more than 15% and an offer that
-- loses money for the owner, retires what the brain proposed, approves a safe offer, never touches a product
-- addition, writes everything to its log, and moves no release, checkout or fulfilment flag.
begin;
do $$
declare u uuid; r uuid; res jsonb; la uuid; lb uuid; n int; good uuid; bad uuid;
  img1 text := 'https://media.taager.com/11111111-2222-3333-4444-555555555555.jpg';
  fin jsonb := '{"price":140,"originalPrice":77,"profit":63}';
  tpl text := '{"title":"%s","description":"وصف.","image_alt":["صورة"],"category":"%s","seo":{"slug":"%s"},"issues":[]}';
  today date := (now() at time zone 'utc')::date;
begin
 select user_id into u from public.dashboard_members where store_code='sa' limit 1;
 if u is null then raise exception 'No staging owner'; end if;
 insert into public.brain_runs(store_code,stage,status) values('sa','review','awaiting_review') returning id into r;
 insert into public.taager_catalog(market,sku,product_id,variant_id,item_type,name,listing,detail,financials) values
  ('sa','AUTOA',900000401,0,'product','a',jsonb_build_object('financials',fin),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img1))),fin),
  ('sa','AUTOB',900000402,0,'product','b',jsonb_build_object('financials',fin),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img1))),fin);
 insert into public.brain_product_analysis(run_id,store_code,product_id,variation_id,title,offer_kind,stage,score,decision,content,owner_decision) values
  (r,'sa',900000401,0,'a','single','selected',9,'{"state":"priced","price_minor":14900}',format(tpl,'خلاط','kitchen','auto-blender')::jsonb,'approved'),
  (r,'sa',900000402,0,'b','single','selected',7,'{"state":"priced","price_minor":12900}',format(tpl,'رف','organize','auto-rack')::jsonb,'approved');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 perform public.brain_publish_approved('sa',r);
 select listing_id into la from public.brain_listings where store_code='sa' and sku='AUTOA';
 select listing_id into lb from public.brain_listings where store_code='sa' and sku='AUTOB';
 update public.brain_reprice_proposals set status='superseded' where store_code='sa' and status='proposed';
 update public.brain_daily_proposals set status='superseded' where store_code='sa' and status='proposed';
 update public.store_offers set status='rejected' where store_code='sa' and status='proposed';
 insert into public.brain_reprice_proposals(store_code,listing_id,action,old_price_minor,new_price_minor,reason,pricing) values
  ('sa',la,'change',14900,15900,'Cheapest shop moved up; still under it.','{"state":"priced","price_minor":15900}'),
  ('sa',lb,'change',12900,9000,'A shop dropped its price.','{"state":"priced","price_minor":9000}');
 perform public.brain_daily_save('sa', today, '{"headline":"auto"}',
   jsonb_build_array(jsonb_build_object('kind','retire_product','ref',lb::text,'title','رف','why','400 views and no orders.'),
                     jsonb_build_object('kind','add_product','ref','AUTONEW','title','new','why','new at Taager this month.','data',jsonb_build_object('product_id',900000409))));
 insert into public.store_offers(store_code,kind,listing_id,quantity,price_minor,status) values ('sa','quantity',la,2,27000,'proposed') returning id into good;
 insert into public.store_offers(store_code,kind,listing_id,quantity,price_minor,status) values ('sa','quantity',la,3,23000,'proposed') returning id into bad;

 -- 1. Off: nothing happens. The settings patch cannot switch it on; a non-member cannot either.
 res := public.brain_autopilot_apply('sa');
 if (res->>'enabled')::boolean or (select price_minor from public.brain_listings where listing_id=la)<>14900 then raise exception 'autopilot acted while off %',res; end if;
 perform public.brain_update_settings('sa','{"autopilot_enabled":true}');
 if (select autopilot_enabled from public.brain_settings where store_code='sa') then raise exception 'settings patch switched autopilot on'; end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 begin perform public.brain_set_autopilot('sa', true); raise exception 'non-member switched autopilot';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);

 -- 2. The owner switches it on; the loop applies it.
 if not public.brain_set_autopilot('sa', true) then raise exception 'switch on'; end if;
 if (select autopilot_since from public.brain_settings where store_code='sa') is null then raise exception 'switch time not recorded'; end if;
 res := public.brain_autopilot_apply('sa');
 if (res->>'price_changes')::int<>1 or (res->>'retired')::int<>1 or (res->>'offers')::int<>1 or (res->>'left_for_owner')::int<>2 or (res->>'new_products_waiting')::int<>1 then raise exception 'apply %',res; end if;
 if (select price_minor from public.brain_listings where listing_id=la)<>15900 or (select price_minor from public.brain_listings where listing_id=lb)<>12900 then raise exception 'prices'; end if;
 if (select status from public.brain_reprice_proposals where listing_id=lb and store_code='sa' order by created_at desc limit 1)<>'proposed' then raise exception 'the 30%% move must wait for the owner'; end if;
 if (select hidden_reason from public.brain_listing_state('sa') where listing_id=lb)<>'unpublished' then raise exception 'retire'; end if;
 if (select status from public.store_offers where id=good)<>'approved' or (select status from public.store_offers where id=bad)<>'proposed' then raise exception 'offers % %',(select status from public.store_offers where id=good),(select status from public.store_offers where id=bad); end if;
 if (select status from public.brain_daily_proposals where store_code='sa' and kind='add_product' and ref='AUTONEW')<>'proposed' then raise exception 'a product addition must stay with the owner'; end if;
 res := public.brain_autopilot_log_list('sa', 1);
 if jsonb_array_length(res)<>5 or not exists (select 1 from jsonb_array_elements(res) x where x->>'kind'='left_for_owner' and x->'detail'->>'why'='moves the price by more than 15%') then raise exception 'log %',res; end if;
 -- Running it again changes nothing more.
 res := public.brain_autopilot_apply('sa');
 if (res->>'price_changes')::int<>0 or (res->>'retired')::int<>0 or (res->>'offers')::int<>0 then raise exception 'second apply %',res; end if;

 -- 3. The brief carries what autopilot did; off again stops it.
 if not public.brain_brief_merge('sa', today, '{"autopilot":{"price_changes":1}}') or (select brief->'autopilot'->>'price_changes' from public.brain_briefs where store_code='sa' and day=today)<>'1'
    or (select brief->>'headline' from public.brain_briefs where store_code='sa' and day=today)<>'auto' then raise exception 'brief merge'; end if;
 perform public.brain_set_autopilot('sa', false);
 if (public.brain_autopilot_apply('sa')->>'enabled')::boolean then raise exception 'still on'; end if;
 if exists (select 1 from public.stores where checkout_enabled or fulfillment_enabled) then raise exception 'a flag moved'; end if;
 if has_function_privilege('authenticated','public.brain_autopilot_apply(text)','execute') or has_function_privilege('anon','public.brain_set_autopilot(text, boolean)','execute') then raise exception 'privileges'; end if;
end $$;
rollback;
