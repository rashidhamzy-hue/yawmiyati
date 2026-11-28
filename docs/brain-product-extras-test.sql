-- Rollback-only fixture test for supabase/migrations/20261128060000_brain_product_extras.sql (staging only).
-- Proves: supplier-hosted videos only (deduplicated, max 3); the brain's quantity proposals are kept privately only
-- when above full unit cost and below buying singly, and never reach a visitor until the owner approves that exact
-- offer (owner approval, re-checks and Taager prices are covered by docs/store-offers-test.sql and
-- docs/brain-commerce-v2-test.sql); bundle contents only from declared bundleItems that resolve to a catalogue row.
begin;
do $$
declare u uuid; r uuid; res jsonb; pg jsonb; s text;
  v1 text := 'https://media.taager.com/aaaaaaaa-1111-2222-3333-444444444444.mp4';
  fin jsonb := '{"price":100,"originalPrice":70,"profit":30}';
  content jsonb := '{"title":"طقم عناية","description":"وصف الطقم.","image_alt":["صورة"],"category":"beauty","seo":{"slug":"care set"},"issues":[]}';
begin
 select user_id into u from public.dashboard_members where store_code='sa' limit 1;
 if u is null then raise exception 'No staging owner'; end if;
 insert into public.brain_runs(store_code,stage,status) values('sa','review','awaiting_review') returning id into r;
 insert into public.taager_catalog(market,sku,product_id,variant_id,item_type,name,listing,detail,financials) values
  ('sa','FIXBUNDLE1',900000101,0,'bundle','bundle',jsonb_build_object('financials',fin),jsonb_build_object('variant',jsonb_build_object(
     'images',jsonb_build_array('https://media.taager.com/11111111-2222-3333-4444-555555555555.jpg',v1),
     'videos',jsonb_build_array(v1,'https://www.youtube.com/embed/abc','https://media.taager.com/bbbbbbbb-1111-2222-3333-444444444444.mp4'),
     'bundleItems',jsonb_build_array(
        jsonb_build_object('sku','FIXPART01','quantity',2,'thumbnail','https://media.taager.com/cccccccc-1111-2222-3333-444444444444.jpg'),
        jsonb_build_object('sku','FIXMISSING','quantity',1)))),fin),
  ('sa','FIXPART01',900000102,0,'product','سيروم الشعر',jsonb_build_object('financials',fin),'{}'::jsonb,fin);
 insert into public.brain_product_analysis(run_id,store_code,product_id,variation_id,title,offer_kind,stage,score,decision,content,owner_decision) values
  (r,'sa',900000101,0,'bundle','verified_bundle','selected',9,
   '{"state":"priced","price_minor":12900,"quantity_offers":[{"quantity":2,"price_minor":22900},{"quantity":3,"price_minor":20000},{"quantity":4,"price_minor":60000}]}',content,'approved');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 res:=public.brain_publish_approved('sa',r);
 if (res->>'published')::int<>1 then raise exception 'publish %',res; end if;
 perform public.brain_set_release('sa',true);
 select slug into s from public.public_catalog('sa') limit 1;
 pg:=public.public_product_page('sa',s);
 if pg->'videos'<>'["aaaaaaaa-1111-2222-3333-444444444444.mp4","bbbbbbbb-1111-2222-3333-444444444444.mp4"]'::jsonb then raise exception 'videos %',pg->'videos'; end if;
 if (select extras->'quantity_offers' from public.brain_listings where store_code='sa' and sku='FIXBUNDLE1')<>'[{"quantity":2,"price_minor":22900}]'::jsonb
  then raise exception 'private proposals %',(select extras from public.brain_listings where store_code='sa' and sku='FIXBUNDLE1'); end if;
 if pg->'quantity_offers'<>'[]'::jsonb then raise exception 'unapproved offer is public %',pg->'quantity_offers'; end if;
 if pg->'bundle'<>'[{"name":"سيروم الشعر","quantity":2,"image":"cccccccc-1111-2222-3333-444444444444.jpg"}]'::jsonb then raise exception 'bundle %',pg->'bundle'; end if;
 if pg::text like '%FIX%' or pg::text ilike '%taager%' or pg::text like '%youtube%' then raise exception 'leak %',pg; end if;
 perform public.brain_set_release('sa',false);
 raise notice 'brain product extras fixture: all checks passed';
end $$;
rollback;
