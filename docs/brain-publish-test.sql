-- Rollback-only fixture test for supabase/migrations/20261127130000_brain_publish.sql (staging only).
-- Proves: owner-only publish, skip reasons, release gate, public cards/page, and automatic hiding when
-- the Taager sync goes stale, stock runs out, Taager raises its cost above our price, or the owner unpublishes.
-- Taager's minimum/maximum are references only: picks priced below the minimum or above the maximum are published.
begin;
do $$
declare u uuid; r uuid; res jsonb; n integer; st jsonb; pg jsonb; s text;
  img text := 'https://media.taager.com/11111111-2222-3333-4444-555555555555.jpg';
  fin jsonb := '{"price":100,"originalPrice":70,"profit":30,"pricingRange":{"min":100,"max":150}}';
  content jsonb := '{"title":"منتج تجريبي","subtitle":"سطر","description":"وصف تجريبي للمنتج.","bullets":["ميزة"],"specs":[{"label":"اللون","value":"أبيض"}],"faq":[{"q":"سؤال","a":"جواب"}],"image_alt":["صورة المنتج"],"category":"home","tags":["بيت"],"seo":{"title":"منتج","meta_description":"وصف","slug":"Test Product!"},"removed_claims":["internal note"],"issues":[]}';
begin
 select user_id into u from public.dashboard_members where store_code='sa' limit 1;
 if u is null then raise exception 'No staging owner'; end if;
 if (select catalog_release_enabled from public.stores where code='sa') then raise exception 'Fixture expects release off'; end if;
 insert into public.brain_runs(store_code,stage,status) values('sa','review','awaiting_review') returning id into r;
 -- 1 above Taager max (allowed), 2 priced under Taager cost, 3 under Taager minimum (allowed) and out of stock later,
 -- 4 banned wording, 5 not in catalogue, 6 rejected by owner
 insert into public.taager_catalog(market,sku,product_id,variant_id,item_type,name,listing,detail,financials) values
  ('sa','FIXSKU0001',900000001,11,'product','f1',jsonb_build_object('financials',fin),jsonb_build_object('active',true,'variant',jsonb_build_object('images',jsonb_build_array(img,'https://media.taager.com/aaaaaaaa-2222-3333-4444-555555555555.mp4','https://example.com/x.jpg'),'merchantInfo',jsonb_build_object('orderable',true),'availability','available')),fin),
  ('sa','FIXSKU0002',900000002,12,'product','f2',jsonb_build_object('financials',fin),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img))),fin),
  ('sa','FIXSKU0003',900000003,13,'product','f3',jsonb_build_object('financials',fin),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img))),fin),
  ('sa','FIXSKU0004',900000004,14,'product','f4',jsonb_build_object('financials',fin),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img))),fin),
  ('sa','FIXSKU0006',900000006,16,'product','f6',jsonb_build_object('financials',fin),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img))),fin);
 insert into public.brain_product_analysis(run_id,store_code,product_id,variation_id,title,offer_kind,stage,score,decision,content,owner_decision) values
  (r,'sa',900000001,11,'f1','single','selected',9,'{"state":"priced","price_minor":15900}',content,'approved'),
  (r,'sa',900000002,12,'f2','single','selected',8,'{"state":"priced","price_minor":6900}',content,'approved'),
  (r,'sa',900000003,13,'f3','single','selected',7,'{"state":"priced","price_minor":8900}',content,'approved'),
  (r,'sa',900000004,14,'f4','single','selected',6,'{"state":"priced","price_minor":12000}',content||'{"issues":["banned_wording_present"]}','approved'),
  (r,'sa',900000005,15,'f5','single','selected',5,'{"state":"priced","price_minor":12000}',content,'approved'),
  (r,'sa',900000006,16,'f6','single','selected',4,'{"state":"priced","price_minor":12000}',content,'rejected');

 -- Not signed in: refused.
 begin perform public.brain_publish_approved('sa',r); raise exception 'anon publish allowed';
 exception when insufficient_privilege then null; end;

 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u)::text,true);
 res:=public.brain_publish_approved('sa',r);
 if (res->>'published')::int<>2 or (res->>'updated')::int<>0 or jsonb_array_length(res->'skipped')<>3 then raise exception 'publish result %',res; end if;
 if not (res->'skipped') @> '[{"product_id":900000002,"reason":"below_supplier_cost"},{"product_id":900000004,"reason":"page_content_needs_fix"},{"product_id":900000005,"reason":"not_in_taager_catalogue"}]' then raise exception 'skip reasons %',res; end if;
 -- Running it again refreshes, never duplicates.
 res:=public.brain_publish_approved('sa',r);
 if (res->>'published')::int<>0 or (res->>'updated')::int<>2 or (select count(*) from public.brain_listings where store_code='sa')<>2 then raise exception 'republish %',res; end if;

 -- Release flag off: nothing public.
 if exists(select 1 from public.public_catalog('sa')) then raise exception 'visible while release off'; end if;
 st:=public.brain_publication_status('sa');
 if (st->>'listings')::int<>2 or (st->>'ready')::int<>2 or (st->>'release_enabled')::boolean then raise exception 'status %',st; end if;

 perform public.brain_set_release('sa',true);
 select count(*) into n from public.public_catalog('sa'); if n<>2 then raise exception 'expected 2 public, got %',n; end if;
 select slug into s from public.public_catalog('sa') where price_minor='15900';
 if not exists(select 1 from public.public_catalog('sa') where price_minor='8900') then raise exception 'below-minimum price not published'; end if;
 if s<>'test-product-900000001' then raise exception 'slug %',s; end if;
 if not exists(select 1 from public.public_catalog('sa') where slug=s and currency='SAR' and approved_category_slugs=array['home'] and category_release='owner_approved' and image='11111111-2222-3333-4444-555555555555.jpg') then raise exception 'card fields'; end if;
 if not exists(select 1 from public.public_catalog_detail('sa',s) where description='وصف تجريبي للمنتج.') then raise exception 'detail'; end if;
 if not exists(select 1 from public.public_catalog_search('sa','تجريبي',10)) then raise exception 'search'; end if;
 pg:=public.public_product_page('sa',s);
 if pg->>'release'<>'public_approved' or jsonb_array_length(pg->'images')<>1 or pg->'images'->0->>'alt'<>'صورة المنتج' or pg->'page'->>'title'<>'منتج تجريبي'
    or pg::text like '%internal note%' or pg::text ilike '%taager%' or pg::text like '%FIXSKU%' or pg->'page' ? 'issues' then raise exception 'page %',pg; end if;

 -- Taager marks product 3 out of stock on the next sync: hidden without any owner action.
 update public.taager_catalog set detail=jsonb_set(detail,'{variant,merchantInfo}','{"orderable":false}') where market='sa' and sku='FIXSKU0003';
 select count(*) into n from public.public_catalog('sa'); if n<>1 then raise exception 'out of stock still visible'; end if;
 -- Taager raises its cost above our price: hidden (never sell at a loss).
 update public.taager_catalog set financials=jsonb_set(financials,'{originalPrice}','165') where market='sa' and sku='FIXSKU0001';
 if exists(select 1 from public.public_catalog('sa')) then raise exception 'below-cost still visible'; end if;
 if public.public_product_page('sa',s) is not null then raise exception 'page visible while hidden'; end if;
 st:=public.brain_publication_status('sa');
 if st->'hidden'<>'{"out_of_stock":1,"below_supplier_cost":1}'::jsonb then raise exception 'hidden reasons %',st; end if;
 update public.taager_catalog set financials=fin where market='sa' and sku='FIXSKU0001';
 -- No sync for longer than the allowed window: hidden.
 update public.taager_catalog set synced_at=now()-interval '73 hours' where market='sa' and sku='FIXSKU0001';
 if exists(select 1 from public.public_catalog('sa')) then raise exception 'stale sync still visible'; end if;
 update public.taager_catalog set synced_at=now() where market='sa' and sku='FIXSKU0001';
 select count(*) into n from public.public_catalog('sa'); if n<>1 then raise exception 'not restored'; end if;

 -- Owner unpublishes; then release off again.
 if public.brain_unpublish('sa',null)<>2 then raise exception 'unpublish count'; end if;
 if exists(select 1 from public.public_catalog('sa')) then raise exception 'visible after unpublish'; end if;
 perform public.brain_set_release('sa',false);
 if (select count(*) from public.catalog_release_log where store_code='sa')<>2 then raise exception 'release log'; end if;

 -- A signed-in non-member is refused everywhere.
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid())::text,true);
 begin perform public.brain_set_release('sa',true); raise exception 'non-member release allowed'; exception when insufficient_privilege then null; end;
 begin perform public.brain_unpublish('sa',null); raise exception 'non-member unpublish allowed'; exception when insufficient_privilege then null; end;
 begin perform public.brain_publication_status('sa'); raise exception 'non-member status allowed'; exception when insufficient_privilege then null; end;
 raise notice 'brain publish fixture: all checks passed';
end $$;
rollback;
