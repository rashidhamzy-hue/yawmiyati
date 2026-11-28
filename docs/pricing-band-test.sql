-- Rollback-only fixture test for supabase/migrations/20261130090000_pricing_band.sql (staging only).
-- Proves: the US$2 floor is stored per market; a listing whose price stops earning the floor after a Taager cost
-- rise hides itself with reason 'margin_below_floor'; a re-price proposal is listed with both profits, an unsafe
-- one cannot be approved, an approved one moves listing and variant together and shows the product again;
-- offer inputs say which products were priced with delivery included; non-members and anon reach nothing.
begin;
do $$
declare u uuid; r uuid; res jsonb; lst jsonb; inp jsonb; la uuid; ld uuid; n integer; pid uuid;
  img1 text := 'https://media.taager.com/11111111-2222-3333-4444-555555555555.jpg';
  fin_a jsonb := '{"price":140,"originalPrice":77,"profit":63}';
  fin_d jsonb := '{"price":105,"originalPrice":100,"profit":5}';
  tpl text := '{"title":"%s","description":"وصف.","image_alt":["صورة"],"category":"%s","seo":{"slug":"%s"},"issues":[]}';
begin
 select user_id into u from public.dashboard_members where store_code='sa' limit 1;
 if u is null then raise exception 'No staging owner'; end if;
 if (select margin_floor_minor from public.store_commerce_facts where store_code='sa')<>750
    or (select margin_floor_minor from public.store_commerce_facts where store_code='iq')<>2620000
    or (select margin_floor_minor from public.store_commerce_facts where store_code='om')<>769
    or (select undelivered_cost_minor from public.store_commerce_facts where store_code='eg')<>270 then raise exception 'floors %',(select jsonb_agg(to_jsonb(f)) from public.store_commerce_facts f); end if;
 insert into public.brain_runs(store_code,stage,status) values('sa','review','awaiting_review') returning id into r;
 insert into public.taager_catalog(market,sku,product_id,variant_id,item_type,name,listing,detail,financials) values
  ('sa','FIXA',900000301,0,'product','a',jsonb_build_object('financials',fin_a),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img1))),fin_a),
  ('sa','FIXD',900000304,0,'product','d',jsonb_build_object('financials',fin_d),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img1))),fin_d);
 insert into public.brain_product_analysis(run_id,store_code,product_id,variation_id,title,offer_kind,stage,score,decision,content,owner_decision) values
  (r,'sa',900000301,0,'a','single','selected',9,'{"state":"priced","price_minor":14900,"delivery_included":true,"band_exception":null}',format(tpl,'خلاط','kitchen','blender')::jsonb,'approved'),
  (r,'sa',900000304,0,'d','single','selected',3,'{"state":"priced","price_minor":10900,"band_exception":{"kind":"below_band","reason":"traffic product"}}',format(tpl,'منتج بهامش رفيع','home','thin one')::jsonb,'approved');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 res:=public.brain_publish_approved('sa',r);
 if (res->>'published')::int<>2 then raise exception 'publish %',res; end if;
 select listing_id into la from public.brain_listings where store_code='sa' and sku='FIXA';
 select listing_id into ld from public.brain_listings where store_code='sa' and sku='FIXD';

 -- 1. Both earn the floor: 149-77-1.35=70.65 and 109-100-0.60=8.40 (floor 7.50).
 if exists (select 1 from public.brain_listing_state('sa') s where s.listing_id in (la,ld) and s.hidden_reason is not null) then raise exception 'visible at start %',(select jsonb_agg(to_jsonb(s)) from public.brain_listing_state('sa') s); end if;

 -- 2. Offer inputs carry the pricing record.
 inp:=public.brain_offer_inputs('sa');
 if not exists (select 1 from jsonb_array_elements(inp->'listings') l where l->>'listing_id'=la::text and (l->>'priced_with_delivery')::boolean)
    or not exists (select 1 from jsonb_array_elements(inp->'listings') l where l->>'listing_id'=ld::text and not (l->>'priced_with_delivery')::boolean and l->>'band_exception'='traffic product')
    or (inp->'facts'->>'margin_floor_minor')::bigint<>750 then raise exception 'inputs %',inp; end if;

 -- 3. Taager raises D's cost to 102.50: 109-102.50-0.60=5.90, under the floor. Hidden on the next read, nobody acted.
 update public.taager_catalog set financials=jsonb_set(financials,'{originalPrice}','102.5') where market='sa' and sku='FIXD';
 if (select hidden_reason from public.brain_listing_state('sa') where listing_id=ld) is distinct from 'margin_below_floor' then raise exception 'not paused %',(select hidden_reason from public.brain_listing_state('sa') where listing_id=ld); end if;
 if (select hidden_reason from public.brain_listing_state('sa') where listing_id=la) is not null then raise exception 'A must stay'; end if;
 if (public.brain_publication_status('sa')->'hidden'->>'margin_below_floor')::int<>1 then raise exception 'status %',public.brain_publication_status('sa')->'hidden'; end if;

 -- 4. The brain proposes (service role). An unsafe new price (105: loss) is refused at approval; nothing moves.
 n:=public.brain_reprice_save('sa',jsonb_build_array(jsonb_build_object('listing_id',ld,'action','pause','new_price_minor',10500,'reason','Under the floor after the cost rise.','pricing','{}'::jsonb)));
 if n<>1 then raise exception 'save %',n; end if;
 lst:=public.brain_reprice_list('sa');
 if jsonb_array_length(lst)<>1 or (lst->0->>'profit_now_minor')::bigint<>590 or not (lst->0->>'hidden_now')::boolean or (lst->0->>'old_price_minor')::bigint<>10900 then raise exception 'list %',lst; end if;
 res:=public.brain_reprice_decide('sa',null,'approved');
 if (res->>'decided')::int<>0 or (res->>'skipped_unsafe')::int<>1 or (select price_minor from public.brain_listings where listing_id=ld)<>10900 then raise exception 'unsafe approved %',res; end if;

 -- 5. A new proposal replaces the open one (idempotent per listing). 119: 119-102.50-2.10=14.40. Approved: shown again.
 n:=public.brain_reprice_save('sa',jsonb_build_array(jsonb_build_object('listing_id',ld,'action','pause','new_price_minor',11900,'reason','Under the floor after the cost rise.','pricing','{"margin_on_price_pct":12.1,"band_exception":{"kind":"below_band","reason":"traffic product"}}'::jsonb)));
 if (select count(*) from public.brain_reprice_proposals where listing_id=ld and status='proposed')<>1 or (select count(*) from public.brain_reprice_proposals where listing_id=ld and status='superseded')<>1 then raise exception 'supersede'; end if;
 lst:=public.brain_reprice_list('sa'); pid:=(lst->0->>'id')::uuid;
 if (lst->0->>'profit_new_minor')::bigint<>1440 then raise exception 'new profit %',lst; end if;
 res:=public.brain_reprice_decide('sa',array[pid],'approved');
 if (res->>'decided')::int<>1 then raise exception 'approve %',res; end if;
 if (select b.price_minor from public.brain_listings b where b.listing_id=ld)<>11900
    or (select v.price_minor from public.listing_variants v join public.brain_listings b on (v.store_code,v.id)=(b.store_code,b.variant_id) where b.listing_id=ld)<>11900
    or (select b.pricing->>'margin_on_price_pct' from public.brain_listings b where b.listing_id=ld)<>'12.1' then raise exception 'price not moved'; end if;
 if (select hidden_reason from public.brain_listing_state('sa') where listing_id=ld) is not null then raise exception 'still hidden %',(select hidden_reason from public.brain_listing_state('sa') where listing_id=ld); end if;
 if jsonb_array_length(public.brain_reprice_list('sa'))<>0 then raise exception 'queue not empty'; end if;
 -- Same price as now: nothing to propose.
 if public.brain_reprice_save('sa',jsonb_build_array(jsonb_build_object('listing_id',ld,'action','change','new_price_minor',11900,'reason','same price')))<>0 then raise exception 'no-op saved'; end if;

 -- 6. Privileges: anon and non-members reach nothing; only the service role writes proposals.
 if has_function_privilege('anon','public.brain_reprice_list(text)','execute') or has_function_privilege('authenticated','public.brain_reprice_save(text,jsonb)','execute')
    or has_table_privilege('authenticated','public.brain_reprice_proposals','select') or has_table_privilege('anon','public.brain_reprice_proposals','select')
    or has_function_privilege('anon','public.brain_listing_state(text)','execute') then raise exception 'privileges'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin perform public.brain_reprice_decide('sa',null,'approved'); raise exception 'a non-member approved prices';
 exception when sqlstate '42501' then null; end;
 begin perform public.brain_reprice_list('sa'); raise exception 'a non-member read proposals';
 exception when sqlstate '42501' then null; end;
 raise notice 'pricing band: all checks passed';
end $$;
rollback;
