-- Rollback-only fixture test for supabase/migrations/20261129090000_brain_commerce_v2.sql (staging only).
-- Proves: both profit figures are reported; an offer that only earns at Taager's quantity price cannot be approved
-- until the market's "Taager discounts proven" switch is on, and disappears again when it is switched off; a sale
-- offer follows the supplier sale's real end date and shows a crossed-out price only when the product was on the
-- visible store at that price before; free delivery counts eligible products only, excludes thin ones by itself and
-- switches off when unsafe or outside its dates; delivery-included never loses; stock history and velocity; the
-- brain's picture order is applied at publish; anon reaches nothing private.
begin;
do $$
declare u uuid; r uuid; res jsonb; pub jsonb; pg jsonb; lst jsonb; inp jsonb; rep jsonb; st record;
  la uuid; lb uuid; lc uuid; ld uuid; sa text; oq uuid; os uuid; ofd uuid; odi uuid; obad uuid; ob uuid;
  img1 text := 'https://media.taager.com/11111111-2222-3333-4444-555555555555.jpg';
  img2 text := 'https://media.taager.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg';
  fin_a jsonb := '{"price":140,"originalPrice":77,"profit":63,"tieredPricing":[{"quantity":1,"price":140,"profit":63},{"quantity":2,"price":174,"profit":40},{"quantity":3,"price":400,"profit":10}]}';
  fin_b jsonb := '{"price":90,"originalPrice":50,"profit":40}';
  fin_c jsonb := '{"price":120,"originalPrice":100,"profit":20}';
  fin_d jsonb := '{"price":105,"originalPrice":100,"profit":5}';
  tpl text := '{"title":"%s","description":"وصف.","image_alt":["صورة"],"category":"%s","seo":{"slug":"%s"},"issues":[]}';
  sale_end text := to_char((now() at time zone 'utc') + interval '10 days', 'YYYY-MM-DD"T"HH24:MI:SS');
  det_a jsonb;
begin
 select user_id into u from public.dashboard_members where store_code='sa' limit 1;
 if u is null then raise exception 'No staging owner'; end if;
 det_a := jsonb_build_object('variant', jsonb_build_object('images', jsonb_build_array(img1, img2), 'financials', jsonb_build_object('discounts', jsonb_build_array(
   jsonb_build_object('type','sale','price',110,'profit',43,'startsAt','2026-11-01T00:00:00','expiresAt',sale_end),
   jsonb_build_object('type','second_placement','price',80,'profit',5),
   jsonb_build_object('type','second_confirmation','price',80,'profit',3)))));
 insert into public.brain_runs(store_code,stage,status) values('sa','review','awaiting_review') returning id into r;
 insert into public.taager_catalog(market,sku,product_id,variant_id,item_type,name,listing,detail,financials) values
  ('sa','FIXA',900000301,0,'product','a',jsonb_build_object('financials',fin_a,'createdAt',to_char(now() - interval '5 days','YYYY-MM-DD"T"HH24:MI:SS'),'stockAvailability',jsonb_build_object('stockBucket','from_200_to_210')),det_a,fin_a),
  ('sa','FIXB',900000302,0,'product','b',jsonb_build_object('financials',fin_b),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img1))),fin_b),
  ('sa','FIXC',900000303,0,'bundle','c',jsonb_build_object('financials',fin_c),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img1))),fin_c),
  ('sa','FIXD',900000304,0,'product','d',jsonb_build_object('financials',fin_d),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img1))),fin_d);
 insert into public.brain_product_analysis(run_id,store_code,product_id,variation_id,title,offer_kind,stage,score,decision,content,owner_decision) values
  (r,'sa',900000301,0,'a','single','selected',9,'{"state":"priced","price_minor":14900,"positioning":"dearer"}',
     format(tpl,'خلاط','kitchen','blender')::jsonb || '{"pictures":{"order":["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg"],"dropped":["11111111-2222-3333-4444-555555555555.jpg"]}}','approved'),
  (r,'sa',900000302,0,'b','single','selected',7,'{"state":"priced","price_minor":9900}',format(tpl,'رف مطبخ','organize','rack')::jsonb,'approved'),
  (r,'sa',900000303,0,'c','verified_bundle','selected',5,'{"state":"priced","price_minor":12900}',format(tpl,'طقم جاهز','home','ready set')::jsonb,'approved'),
  (r,'sa',900000304,0,'d','single','selected',3,'{"state":"priced","price_minor":10900}',format(tpl,'منتج بهامش رفيع','home','thin one')::jsonb,'approved');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 res:=public.brain_publish_approved('sa',r);
 if (res->>'published')::int<>4 then raise exception 'publish %',res; end if;
 perform public.brain_set_release('sa',true);
 select listing_id into la from public.brain_listings where store_code='sa' and sku='FIXA';
 select listing_id into lb from public.brain_listings where store_code='sa' and sku='FIXB';
 select listing_id into lc from public.brain_listings where store_code='sa' and sku='FIXC';
 select listing_id into ld from public.brain_listings where store_code='sa' and sku='FIXD';
 select slug into sa from public.country_listings where id=la;

 -- 1. Picture rule: the brain's order is applied at publish (promo picture dropped, clean one first).
 if (select media from public.brain_listings where listing_id=la)::text not like '%aaaaaaaa-bbbb%' or (select jsonb_array_length(media) from public.brain_listings where listing_id=la)<>1
  then raise exception 'picture order %',(select media from public.brain_listings where listing_id=la); end if;
 if (select jsonb_array_length(media) from public.brain_listings where listing_id=lb)<>1 then raise exception 'pictures untouched without a verdict'; end if;

 -- 2. Owner inputs carry Taager's quantity, add-on and sale costs; the switch starts off.
 inp:=public.brain_offer_inputs('sa');
 if (inp->'facts'->>'taager_discounts_proven')::boolean then raise exception 'switch must start off'; end if;
 if (inp->'listings'->0->'tiers'->0->>'cost_minor')::bigint<>13400 or (inp->'listings'->0->>'addon_cost_minor')::bigint<>7500
    or (inp->'listings'->0->'sale'->>'cost_minor')::bigint<>6700 or inp->'listings'->0->>'positioning'<>'dearer' then raise exception 'inputs %',inp->'listings'->0; end if;

 -- 3. "2 for 219": full cost 21900-15400=6500, VAT 975 -> 5525 (less than one single: 14900-7700-135=7065).
 --    At Taager's quantity price: 21900-13400=8500, VAT on what is above 17400 = 675 -> 7825.
 res:=public.brain_offers_save('sa',jsonb_build_array(jsonb_build_object('kind','quantity','listing_id',la,'quantity',2,'price_minor',21900)));
 select id into oq from public.store_offers where store_code='sa' and kind='quantity';
 select * into st from public.store_offer_state('sa') o where o.id=oq;
 if st.profit_full_minor<>5525 or st.profit_taager_minor<>7825 or st.profit_minor<>5525 or st.problem<>'earns_less_than_one_single' then raise exception 'dual figures %',to_jsonb(st); end if;
 begin perform public.brain_offer_decide('sa',oq,'approved'); raise exception 'approved an offer that only earns at Taager''s price';
 exception when sqlstate '22023' then null; end;
 perform public.brain_set_discounts_proven('sa',true);
 select * into st from public.store_offer_state('sa') o where o.id=oq;
 if st.problem is not null or st.profit_minor<>7825 then raise exception 'proven %',to_jsonb(st); end if;
 perform public.brain_offer_decide('sa',oq,'approved');
 pg:=public.public_product_page('sa',sa);
 if pg->'quantity_offers'->0->>'price_minor'<>'21900' then raise exception 'approved quantity offer missing %',pg->'quantity_offers'; end if;
 perform public.brain_set_discounts_proven('sa',false);
 pg:=public.public_product_page('sa',sa);
 if pg->'quantity_offers'<>'[]'::jsonb then raise exception 'offer must hide when the switch goes off %',pg->'quantity_offers'; end if;
 if (select count(*) from public.store_commerce_facts_log where store_code='sa')<>2 then raise exception 'switch log'; end if;
 -- A supplier tier that costs MORE than singles (3 for cost 390 > 231) is ignored.
 perform public.brain_offers_save('sa',jsonb_build_array(jsonb_build_object('kind','quantity','listing_id',la,'quantity',3,'price_minor',37900)));
 select * into st from public.store_offer_state('sa') o where o.listing_id=la and o.quantity=3;
 if st.profit_taager_minor<>st.profit_full_minor then raise exception 'noisy tier used %',to_jsonb(st); end if;

 -- 4. Sale offer 129 until 5 days from now (supplier sale ends in 10): shown with its end date, no crossed-out price yet.
 perform public.brain_offers_save('sa',jsonb_build_array(jsonb_build_object('kind','sale','listing_id',la,'price_minor',12900,'ends_at',now()+interval '5 days')));
 select id into os from public.store_offers where store_code='sa' and kind='sale';
 select * into st from public.store_offer_state('sa') o where o.id=os;
 -- full: 12900-7700 = 5200 (below Taager's minimum: no VAT). Taager sale: 12900-6700=6200, VAT 15% of 1900 = 285 -> 5915.
 if st.profit_full_minor<>5200 or st.profit_taager_minor<>5915 or st.problem is not null then raise exception 'sale figures %',to_jsonb(st); end if;
 if public.public_product_page('sa',sa)->'sale'<>'null'::jsonb then raise exception 'unapproved sale is public'; end if;
 perform public.brain_offer_decide('sa',os,'approved');
 pg:=public.public_product_page('sa',sa);
 if pg->'sale'->>'price_minor'<>'12900' or pg->'sale'->>'ends_at' is null or pg->'sale'->'was_price_minor'<>'null'::jsonb then raise exception 'sale public %',pg->'sale'; end if;
 if (select sale_price_minor from public.public_catalog('sa') where listing_id=la)<>12900 then raise exception 'catalog sale price'; end if;
 --    Once the product has been on the visible store at 149 for over a day before the offer, 149 may be crossed out.
 update public.brain_listings set price_since=now()-interval '3 days' where listing_id=la;
 update public.catalog_release_log set changed_at=now()-interval '3 days' where store_code='sa' and changed_by=u and changed_at>now()-interval '1 minute';
 if public.public_product_page('sa',sa)->'sale'->>'was_price_minor'<>'14900' then raise exception 'was price %',public.public_product_page('sa',sa)->'sale'; end if;
 --    Supplier shortens its sale to 6 days: our offer (5 days + 3 safety) hides itself. Supplier ends it: hidden too.
 update public.taager_catalog set detail=jsonb_set(detail,'{variant,financials,discounts,0,expiresAt}',to_jsonb(to_char((now() at time zone 'utc')+interval '6 days','YYYY-MM-DD"T"HH24:MI:SS'))) where market='sa' and sku='FIXA';
 select * into st from public.store_offer_state('sa') o where o.id=os;
 if st.problem<>'supplier_sale_ends_sooner' or public.public_product_page('sa',sa)->'sale'<>'null'::jsonb then raise exception 'shortened sale %',st.problem; end if;
 update public.taager_catalog set detail=jsonb_set(detail,'{variant,financials,discounts,0,expiresAt}',to_jsonb('2026-11-02T00:00:00'::text)) where market='sa' and sku='FIXA';
 select * into st from public.store_offer_state('sa') o where o.id=os;
 if st.problem<>'supplier_sale_over' then raise exception 'ended sale %',st.problem; end if;
 begin perform public.brain_offers_save('sa',jsonb_build_array(jsonb_build_object('kind','sale','listing_id',lb,'price_minor',8900))); raise exception 'sale without an end date saved';
 exception when sqlstate '22023' then null; end;

 -- 5. Free delivery from 400 for products with a margin of at least 20%: thinnest eligible basket earns 8000-2800=5200.
 begin perform public.brain_offers_save('sa',jsonb_build_array(jsonb_build_object('kind','free_delivery','price_minor',40000))); raise exception 'free delivery without a margin rule saved';
 exception when sqlstate '22023' then null; end;
 perform public.brain_offers_save('sa',jsonb_build_array(jsonb_build_object('kind','free_delivery','price_minor',40000,'meta',jsonb_build_object('min_margin_bps',2000))));
 select id into ofd from public.store_offers where store_code='sa' and kind='free_delivery';
 select * into st from public.store_offer_state('sa') o where o.id=ofd;
 if st.profit_minor<>5200 or st.problem is not null then raise exception 'free delivery %',to_jsonb(st); end if;
 if (select bool_or(free_delivery) from public.public_catalog('sa')) then raise exception 'eligible before approval'; end if;
 perform public.brain_offer_decide('sa',ofd,'approved');
 pub:=public.public_store_offers('sa');
 if pub->'free_delivery'->>'threshold_minor'<>'40000' then raise exception 'threshold not public %',pub; end if;
 if not (select free_delivery from public.public_catalog('sa') where listing_id=la) or not (select free_delivery from public.public_catalog('sa') where listing_id=lc)
    or (select free_delivery from public.public_catalog('sa') where listing_id=ld) then raise exception 'eligibility flags'; end if;
 rep:=public.brain_free_delivery_report('sa');
 if (rep->>'eligible')::int<>3 or jsonb_array_length(rep->'excluded')<>1 or rep->'excluded'->0->>'listing_id'<>ld::text then raise exception 'report %',rep; end if;
 --    Taager raises a cost: that product leaves the eligible set by itself, the rule stays safe.
 update public.taager_catalog set financials=jsonb_set(financials,'{originalPrice}','115'), listing=jsonb_set(listing,'{financials,originalPrice}','115') where market='sa' and sku='FIXC';
 if (select free_delivery from public.public_catalog('sa') where listing_id=lc) then raise exception 'thin product still eligible'; end if;
 --    A threshold too low to pay the fee cannot be approved; an ended rule is not public; a future one waits.
 perform public.brain_offers_save('sa',jsonb_build_array(jsonb_build_object('kind','free_delivery','price_minor',10000,'meta',jsonb_build_object('min_margin_bps',2000))));
 select * into st from public.store_offer_state('sa') o where o.id=ofd;
 if st.status<>'proposed' or st.problem<>'loss_on_thinnest_basket' then raise exception 'low threshold %',to_jsonb(st); end if;
 begin perform public.brain_offer_decide('sa',ofd,'approved'); raise exception 'approved a losing threshold';
 exception when sqlstate '22023' then null; end;
 perform public.brain_offers_save('sa',jsonb_build_array(jsonb_build_object('kind','free_delivery','price_minor',40000,'starts_at',now()+interval '2 days','ends_at',now()+interval '9 days','meta',jsonb_build_object('min_margin_bps',2000))));
 perform public.brain_offer_decide('sa',ofd,'approved');
 if public.public_store_offers('sa')->'free_delivery'<>'null'::jsonb then raise exception 'future rule is public'; end if;
 update public.store_offers set starts_at=now()-interval '9 days', ends_at=now()-interval '1 day' where id=ofd;
 select * into st from public.store_offer_state('sa') o where o.id=ofd;
 if st.problem<>'ended' or public.public_store_offers('sa')->'free_delivery'<>'null'::jsonb then raise exception 'ended rule %',st.problem; end if;

 -- 6. Delivery included: B earns 4765-2800=1965 (ok); D earns 885-2800 (never).
 perform public.brain_offers_save('sa',jsonb_build_array(jsonb_build_object('kind','delivery_included','listing_id',lb,'price_minor',9900),jsonb_build_object('kind','delivery_included','listing_id',ld,'price_minor',10900)));
 select id into odi from public.store_offers where store_code='sa' and kind='delivery_included' and listing_id=lb;
 select id into obad from public.store_offers where store_code='sa' and kind='delivery_included' and listing_id=ld;
 select * into st from public.store_offer_state('sa') o where o.id=odi;
 if st.profit_minor<>1965 or st.problem is not null then raise exception 'delivery included %',to_jsonb(st); end if;
 begin perform public.brain_offer_decide('sa',obad,'approved'); raise exception 'approved a losing delivery-included product';
 exception when sqlstate '22023' then null; end;
 perform public.brain_offer_decide('sa',odi,'approved');
 if public.public_store_offers('sa')->'delivery_included'<>jsonb_build_array(lb) or not (select delivery_included from public.public_catalog('sa') where listing_id=lb) then raise exception 'delivery included not public'; end if;
 if not (public.public_product_page('sa',(select slug from public.country_listings where id=lb))->>'delivery_included')::boolean then raise exception 'page flag'; end if;
 update public.listing_variants v set price_minor=8900 from public.brain_listings b where b.listing_id=lb and v.id=b.variant_id;
 update public.brain_listings set price_minor=8900 where listing_id=lb;
 select * into st from public.store_offer_state('sa') o where o.id=odi;
 if st.problem<>'price_changed' then raise exception 'approval must not survive a price change %',st.problem; end if;

 -- 7. Themed set of three with its theme and tagline; add-on figure reported beside the full-cost figure.
 perform public.brain_offers_save('sa',jsonb_build_array(jsonb_build_object('kind','bundle','slug','routine-kitchen-prep-3','title','تجهيز المطبخ بسهولة','price_minor',29900,
   'meta',jsonb_build_object('theme','kitchen-prep','tagline','تحضير أسرع وترتيب أسهل'),
   'items',jsonb_build_array(jsonb_build_object('listing_id',la,'quantity',1),jsonb_build_object('listing_id',lb,'quantity',1),jsonb_build_object('listing_id',ld,'quantity',1)))));
 select id into ob from public.store_offers where store_code='sa' and slug='routine-kitchen-prep-3';
 select * into st from public.store_offer_state('sa') o where o.id=ob;
 -- full: 29900-(7700+5000+10000)=7200, VAT 1080 -> 6120; add-on price on A (7500): 7400, VAT 1110 -> 6290; two parcels: 6120-2800.
 if st.profit_full_minor<>6120 or st.profit_taager_minor<>6290 or st.profit_if_split_minor<>3320 or st.problem is not null then raise exception 'themed set %',to_jsonb(st); end if;
 perform public.brain_offer_decide('sa',ob,'approved');
 if public.public_store_offers('sa')->'bundles'->0->>'tagline'<>'تحضير أسرع وترتيب أسهل' then raise exception 'tagline %',public.public_store_offers('sa')->'bundles'; end if;

 -- 8. Stock history: a reading per bucket change; velocity from readings at least a day apart; new-arrival flag.
 if (select count(*) from public.taager_stock_history where market='sa' and sku='FIXA')<>1 then raise exception 'first reading'; end if;
 update public.taager_catalog set listing=jsonb_set(listing,'{stockAvailability,stockBucket}','"from_150_to_160"') where market='sa' and sku='FIXA';
 update public.taager_catalog set listing=jsonb_set(listing,'{stockAvailability,stockBucket}','"from_150_to_160"') where market='sa' and sku='FIXA';
 if (select count(*) from public.taager_stock_history where market='sa' and sku='FIXA')<>2 then raise exception 'one reading per change'; end if;
 insert into public.taager_stock_history(market,sku,observed_at,stock_bucket,stock_low) values('sa','FIXA',now()-interval '2 days','from_300_to_310',300);
 if (select per_day from public.taager_stock_velocity('sa') where sku='FIXA') not between 70 and 80 then raise exception 'velocity %',(select per_day from public.taager_stock_velocity('sa') where sku='FIXA'); end if;
 if not (select is_new from public.public_catalog('sa') where listing_id=la) or (select is_new from public.public_catalog('sa') where listing_id=lb) then raise exception 'new flag'; end if;
 if public.taager_stock_low('less_than_10')<>0 or public.taager_stock_low('more_than_1000')<>1000 or public.taager_stock_low('whatever') is not null then raise exception 'buckets'; end if;

 -- 9. Owner list has both figures in US dollars; nothing private is reachable without membership.
 lst:=public.brain_offers_list('sa');
 if not exists (select 1 from jsonb_array_elements(lst) o where o->>'id'=oq::text and (o->>'profit_full_usd')::numeric=14.73 and (o->>'profit_taager_usd')::numeric=20.87) then raise exception 'list %',lst; end if;
 if has_function_privilege('anon','public.brain_set_discounts_proven(text,boolean)','execute') or has_function_privilege('anon','public.store_offer_state(text)','execute')
    or has_function_privilege('authenticated','public.store_listing_costs(text)','execute') or has_function_privilege('anon','public.brain_free_delivery_report(text)','execute')
    or has_function_privilege('authenticated','public.brain_publish_approved_core(text,uuid)','execute') or has_table_privilege('anon','public.taager_stock_history','select')
    or not has_function_privilege('anon','public.public_store_offers(text)','execute') then raise exception 'privileges'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin perform public.brain_set_discounts_proven('sa',true); raise exception 'a non-member flipped the switch';
 exception when sqlstate '42501' then null; end;
 raise notice 'brain commerce v2: all checks passed';
end $$;
rollback;
