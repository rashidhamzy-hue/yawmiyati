-- Rollback-only fixture test for supabase/migrations/20261130160000_kids_section.sql.
-- Proves: a page approved in the 'kids' section is published in that section and the public catalogue returns it
-- under 'kids'; an unknown section still publishes with no section; the table refuses a made-up section.
begin;
do $$
declare u uuid; r uuid; res jsonb; cats text[];
  img1 text := 'https://media.taager.com/11111111-2222-3333-4444-555555555555.jpg';
  fin jsonb := '{"price":140,"originalPrice":77,"profit":63}';
begin
 select user_id into u from public.dashboard_members where store_code='sa' limit 1;
 if u is null then raise exception 'No staging owner'; end if;
 insert into public.brain_runs(store_code,stage,status) values('sa','review','awaiting_review') returning id into r;
 insert into public.taager_catalog(market,sku,product_id,variant_id,item_type,name,listing,detail,financials) values
  ('sa','FIXK',900000401,0,'product','k',jsonb_build_object('financials',fin),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img1))),fin),
  ('sa','FIXU',900000402,0,'product','u',jsonb_build_object('financials',fin),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img1))),fin);
 insert into public.brain_product_analysis(run_id,store_code,product_id,variation_id,title,offer_kind,stage,score,decision,content,owner_decision) values
  (r,'sa',900000401,0,'k','single','selected',9,'{"state":"priced","price_minor":14900}',
   '{"title":"حقيبة مستلزمات الطفل","benefit_line":"كل أغراض صغيرك في مكان واحد.","description":"وصف.","bullets":["أ","ب","ج"],"image_alt":["صورة"],"category":"kids","seo":{"slug":"baby-bag"},"issues":[]}','approved'),
  (r,'sa',900000402,0,'u','single','selected',7,'{"state":"priced","price_minor":14900}',
   '{"title":"منتج آخر","description":"وصف.","bullets":["أ","ب","ج"],"image_alt":["صورة"],"category":"garden","seo":{"slug":"other-thing"},"issues":[]}','approved');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 res:=public.brain_publish_approved('sa',r);
 if (res->>'published')::int<>2 then raise exception 'publish %',res; end if;
 if (select category from public.brain_listings where store_code='sa' and sku='FIXK') is distinct from 'kids' then raise exception 'kids section not kept'; end if;
 if (select category from public.brain_listings where store_code='sa' and sku='FIXU') is not null then raise exception 'unknown section kept'; end if;
 perform public.brain_set_release('sa',true);
 select c.approved_category_slugs into cats from public.public_catalog('sa',200,0) c join public.brain_listings b on b.listing_id=c.listing_id where b.sku='FIXK';
 if cats is distinct from array['kids'] then raise exception 'public catalogue sections %',cats; end if;
 begin
  update public.brain_listings set category='garden' where sku='FIXU';
  raise exception 'made-up section accepted';
 exception when check_violation then null; end;
 -- The backfill rule: a listing with no section whose approved page says kids gets the section.
 update public.brain_listings set category=null where sku='FIXK';
 update public.brain_listings b set category='kids' where b.category is null
   and exists (select 1 from public.brain_product_analysis a where a.run_id=b.run_id and a.store_code=b.store_code and a.product_id=b.taager_product_id and a.content->>'category'='kids');
 if (select count(*) from public.brain_listings where sku in ('FIXK','FIXU') and category='kids')<>1 then raise exception 'backfill'; end if;
 raise notice 'kids section: all checks passed';
end $$;
rollback;
