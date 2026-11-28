-- Rollback-only fixture test for supabase/migrations/20261128120000_store_offers.sql (staging only).
-- Proves: nothing is public before the owner approves it; a loss-making offer cannot be approved; approved offers
-- are re-checked against the supplier's CURRENT cost and stock on every read; sets never use a supplier bundle
-- or a hidden product; free delivery is sized on the thinnest basket; anon sees no costs; release flag is restored.
begin;
do $$
declare u uuid; r uuid; res jsonb; pub jsonb; pg jsonb; lst jsonb; inp jsonb;
  la uuid; lb uuid; lc uuid; sa text; oq uuid; ob uuid; obad uuid; ofd uuid; ok boolean;
  fin_a jsonb := '{"price":140,"originalPrice":77,"profit":63}';
  fin_b jsonb := '{"price":90,"originalPrice":50,"profit":40}';
  fin_c jsonb := '{"price":120,"originalPrice":100,"profit":20}';
  img text := 'https://media.taager.com/11111111-2222-3333-4444-555555555555.jpg';
  function_content text := '{"title":"%s","description":"وصف.","image_alt":["صورة"],"category":"%s","seo":{"slug":"%s"},"issues":[]}';
begin
 select user_id into u from public.dashboard_members where store_code='sa' limit 1;
 if u is null then raise exception 'No staging owner'; end if;
 insert into public.brain_runs(store_code,stage,status) values('sa','review','awaiting_review') returning id into r;
 insert into public.taager_catalog(market,sku,product_id,variant_id,item_type,name,listing,detail,financials) values
  ('sa','FIXA',900000201,0,'product','a',jsonb_build_object('financials',fin_a),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img),'availability','available_with_low_qty')),fin_a),
  ('sa','FIXB',900000202,0,'product','b',jsonb_build_object('financials',fin_b),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img))),fin_b),
  ('sa','FIXC',900000203,0,'bundle','c',jsonb_build_object('financials',fin_c),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img))),fin_c);
 insert into public.brain_product_analysis(run_id,store_code,product_id,variation_id,title,offer_kind,stage,score,decision,content,owner_decision) values
  (r,'sa',900000201,0,'a','single','selected',9,'{"state":"priced","price_minor":14900,"quantity_offers":[{"quantity":2,"price_minor":25900}]}',format(function_content,'خلاط','kitchen','blender')::jsonb,'approved'),
  (r,'sa',900000202,0,'b','single','selected',7,'{"state":"priced","price_minor":9900}',format(function_content,'رف مطبخ','organize','rack')::jsonb,'approved'),
  (r,'sa',900000203,0,'c','verified_bundle','selected',5,'{"state":"priced","price_minor":12900}',format(function_content,'طقم جاهز','home','ready set')::jsonb,'approved');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 res:=public.brain_publish_approved('sa',r);
 if (res->>'published')::int<>3 then raise exception 'publish %',res; end if;
 perform public.brain_set_release('sa',true);
 select listing_id into la from public.brain_listings where store_code='sa' and sku='FIXA';
 select listing_id into lb from public.brain_listings where store_code='sa' and sku='FIXB';
 select listing_id into lc from public.brain_listings where store_code='sa' and sku='FIXC';
 select slug into sa from public.country_listings where id=la;

 -- 1. Low-quantity product is shown, carries the supplier's own low-stock signal, rank follows the brain score.
 pg:=public.public_product_page('sa',sa);
 if pg is null or pg->>'stock_signal'<>'low' then raise exception 'low stock %',pg; end if;
 if pg->'quantity_offers'<>'[]'::jsonb then raise exception 'unapproved quantity offer is public %',pg->'quantity_offers'; end if;
 if (select rank from public.public_catalog('sa') where listing_id=la)<>1 or (select rank from public.public_catalog('sa') where listing_id=lc)<>3 then raise exception 'rank'; end if;
 if (select offer from public.public_catalog('sa') where listing_id=la) then raise exception 'offer flag before approval'; end if;

 -- 2. Owner inputs carry costs (owner only); proposals are saved as "proposed" and stay private.
 inp:=public.brain_offer_inputs('sa');
 if jsonb_array_length(inp->'listings')<>3 or (inp->'listings'->0->>'cost_minor')::bigint<>7700 or (inp->'facts'->>'delivery_fee_minor')::bigint<>2800 then raise exception 'inputs %',inp; end if;
 res:=public.brain_offers_save('sa',jsonb_build_array(
   jsonb_build_object('kind','quantity','listing_id',la,'quantity',2,'price_minor',25900),
   jsonb_build_object('kind','bundle','slug','set-blender-rack','title','خلاط + رف مطبخ','price_minor',22900,'items',jsonb_build_array(jsonb_build_object('listing_id',la,'quantity',1),jsonb_build_object('listing_id',lb,'quantity',1))),
   jsonb_build_object('kind','bundle','slug','set-blender-ready','title','خلاط + طقم جاهز','price_minor',24900,'items',jsonb_build_array(jsonb_build_object('listing_id',la,'quantity',1),jsonb_build_object('listing_id',lc,'quantity',1))),
   jsonb_build_object('kind','free_delivery','price_minor',40000)));
 if (res->>'saved')::int<>4 then raise exception 'save %',res; end if;
 pub:=public.public_store_offers('sa');
 if pub->'free_delivery'<>'null'::jsonb or pub->'bundles'<>'[]'::jsonb then raise exception 'proposals are public %',pub; end if;
 select id into oq from public.store_offers where store_code='sa' and kind='quantity';
 select id into ob from public.store_offers where store_code='sa' and slug='set-blender-rack';
 select id into obad from public.store_offers where store_code='sa' and slug='set-blender-ready';
 select id into ofd from public.store_offers where store_code='sa' and kind='free_delivery';

 -- 3. Profit figures (lowest case: VAT 15% on all profit of multi-piece prices).
 --    2 for 259: 25900 - 2*7700 = 10500, VAT 1575 -> 8925.  Set 229: 22900 - 12700 = 10200, VAT 1530 -> 8670; two parcels -2800 -> 5870.
 lst:=public.brain_offers_list('sa');
 if (select (x->>'profit_minor')::bigint from jsonb_array_elements(lst) x where x->>'id'=oq::text)<>8925 then raise exception 'quantity profit %',lst; end if;
 if (select (x->>'profit_minor')::bigint from jsonb_array_elements(lst) x where x->>'id'=ob::text)<>8670 or (select (x->>'profit_if_split_minor')::bigint from jsonb_array_elements(lst) x where x->>'id'=ob::text)<>5870 then raise exception 'set profit %',lst; end if;
 if (select x->>'profit_usd' from jsonb_array_elements(lst) x where x->>'id'=ob::text)<>'23.12' then raise exception 'usd %',lst; end if;
 if (select x->>'problem' from jsonb_array_elements(lst) x where x->>'id'=obad::text)<>'piece_is_supplier_bundle' then raise exception 'supplier bundle used as a piece %',lst; end if;

 -- 4. A set with a supplier bundle as a piece cannot be approved; safe offers can, and only then become public.
 begin perform public.brain_offer_decide('sa',obad,'approved'); ok:=false; exception when others then ok:=true; end;
 if not ok then raise exception 'unsafe set was approved'; end if;
 perform public.brain_offer_decide('sa',oq,'approved'); perform public.brain_offer_decide('sa',ob,'approved'); perform public.brain_offer_decide('sa',ofd,'approved');
 pub:=public.public_store_offers('sa');
 if (pub->'free_delivery'->>'threshold_minor')::bigint<>40000 or jsonb_array_length(pub->'bundles')<>1 or pub->'bundles'->0->>'slug'<>'set-blender-rack' then raise exception 'approved offers %',pub; end if;
 if pub::text ilike '%cost%' or pub::text ilike '%profit%' or pub::text ilike '%taager%' or pub::text like '%FIX%' then raise exception 'leak %',pub; end if;
 pg:=public.public_product_page('sa',sa);
 if pg->'quantity_offers'<>'[{"quantity":2,"price_minor":25900}]'::jsonb then raise exception 'approved quantity offer %',pg->'quantity_offers'; end if;
 if not (select offer from public.public_catalog('sa') where listing_id=la) then raise exception 'offer flag'; end if;

 -- 5. Supplier raises the cost of A to 135: 2 for 259 would lose money -> that offer vanishes; the product, the set
 --    (22900 - 18500 = 4400, VAT 660 -> 3740; two parcels 940) and free delivery (thinnest basket still earns) stay.
 update public.taager_catalog set financials=jsonb_set(financials,'{originalPrice}','135') where market='sa' and sku='FIXA';
 pg:=public.public_product_page('sa',sa); pub:=public.public_store_offers('sa');
 if pg is null or pg->'quantity_offers'<>'[]'::jsonb then raise exception 'quantity offer not re-checked %',pg->'quantity_offers'; end if;
 if jsonb_array_length(pub->'bundles')<>1 or pub->'free_delivery'='null'::jsonb then raise exception 'safe offers were dropped %',pub; end if;
 --    Cost 147: the set would lose money if it shipped as two parcels (3200*0.85 = 2720 < 2800) and the thinnest
 --    basket (A alone: 200 - 135 VAT = 65 on 149) cannot pay for delivery at the threshold -> both vanish.
 update public.taager_catalog set financials=jsonb_set(financials,'{originalPrice}','147') where market='sa' and sku='FIXA';
 pub:=public.public_store_offers('sa');
 if pub->'bundles'<>'[]'::jsonb or pub->'free_delivery'<>'null'::jsonb then raise exception 'losing offers still public %',pub; end if;
 if public.public_product_page('sa',sa) is null then raise exception 'product should still be shown'; end if;
 update public.taager_catalog set financials=jsonb_set(financials,'{originalPrice}','77') where market='sa' and sku='FIXA';

 -- 6. A piece goes out of stock: the set disappears; a changed proposal price needs a new approval.
 update public.taager_catalog set detail=jsonb_set(detail,'{variant,availability}','"not_available"') where market='sa' and sku='FIXB';
 if public.public_store_offers('sa')->'bundles'<>'[]'::jsonb then raise exception 'set shown with a missing piece'; end if;
 update public.taager_catalog set detail=jsonb_set(detail,'{variant,availability}','"available"') where market='sa' and sku='FIXB';
 perform public.brain_offers_save('sa',jsonb_build_array(jsonb_build_object('kind','quantity','listing_id',la,'quantity',2,'price_minor',24900)));
 if (select status from public.store_offers where id=oq)<>'proposed' or public.public_product_page('sa',sa)->'quantity_offers'<>'[]'::jsonb then raise exception 'changed price kept its approval'; end if;

 -- 7. Visitors cannot reach owner functions or tables; hidden store shows nothing.
 perform set_config('request.jwt.claims','{"role":"anon"}',true); perform set_config('request.jwt.claim.sub','',true);
 begin perform public.brain_offers_list('sa'); ok:=false; exception when others then ok:=true; end;
 if not ok then raise exception 'anon reached owner list'; end if;
 if has_table_privilege('anon','public.store_offers','select') or has_table_privilege('authenticated','public.store_commerce_facts','select')
    or has_function_privilege('anon','public.store_offer_state(text)','execute') or has_function_privilege('anon','public.brain_offer_inputs(text)','execute') then raise exception 'privileges too wide'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 perform public.brain_set_release('sa',false);
 if public.public_store_offers('sa') is not null then raise exception 'offers public while the store is hidden'; end if;
 raise notice 'store offers fixture: all checks passed';
end $$;
rollback;
