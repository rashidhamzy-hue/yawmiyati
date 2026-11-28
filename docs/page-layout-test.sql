-- Rollback-only fixture test for supabase/migrations/20261130110000_page_layout.sql.
-- Proves: the published page carries benefit_line / in_box / how_to_use and the public page returns them; a page the
-- validator marked needs_fix is not published and the owner is told why; the core stays private.
begin;
do $$
declare u uuid; r uuid; res jsonb; pg jsonb; slug text;
  img1 text := 'https://media.taager.com/11111111-2222-3333-4444-555555555555.jpg';
  fin jsonb := '{"price":140,"originalPrice":77,"profit":63}';
begin
 select user_id into u from public.dashboard_members where store_code='sa' limit 1;
 if u is null then raise exception 'No staging owner'; end if;
 insert into public.brain_runs(store_code,stage,status) values('sa','review','awaiting_review') returning id into r;
 insert into public.taager_catalog(market,sku,product_id,variant_id,item_type,name,listing,detail,financials) values
  ('sa','FIXA',900000301,0,'product','a',jsonb_build_object('financials',fin),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img1))),fin),
  ('sa','FIXB',900000302,0,'product','b',jsonb_build_object('financials',fin),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img1))),fin);
 insert into public.brain_product_analysis(run_id,store_code,product_id,variation_id,title,offer_kind,stage,score,decision,content,owner_decision) values
  (r,'sa',900000301,0,'a','single','selected',9,'{"state":"priced","price_minor":14900}',
   '{"title":"خلاط","benefit_line":"عصير طازج في دقيقة.","description":"وصف.","bullets":["أ","ب","ج"],"in_box":["خلاط","كوب"],"how_to_use":["اضغطي الزر"],"image_alt":["صورة"],"category":"kitchen","seo":{"slug":"blender"},"issues":[]}','approved'),
  (r,'sa',900000302,0,'b','single','selected',7,'{"state":"priced","price_minor":14900}',
   '{"title":"مكواة","description":"قوة 5000 واط.","image_alt":["صورة"],"category":"home","seo":{"slug":"iron"},"issues":["unsupported_number","needs_fix"]}','approved');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 res:=public.brain_publish_approved('sa',r);
 if (res->>'published')::int<>1 or res->'skipped'->0->>'reason'<>'page_content_needs_fix' or (res->'skipped'->0->>'product_id')::bigint<>900000302 then raise exception 'publish %',res; end if;
 if (select page->>'benefit_line' from public.brain_listings where store_code='sa' and sku='FIXA')<>'عصير طازج في دقيقة.'
    or (select jsonb_array_length(page->'in_box') from public.brain_listings where store_code='sa' and sku='FIXA')<>2
    or (select page->'how_to_use'->>0 from public.brain_listings where store_code='sa' and sku='FIXA')<>'اضغطي الزر' then raise exception 'page keys %',(select page from public.brain_listings where sku='FIXA'); end if;
 perform public.brain_set_release('sa',true);
 select l.slug into slug from public.country_listings l join public.brain_listings b on b.listing_id=l.id where b.sku='FIXA';
 pg:=public.public_product_page('sa',slug);
 if pg->'page'->>'benefit_line'<>'عصير طازج في دقيقة.' or jsonb_array_length(pg->'page'->'in_box')<>2 then raise exception 'public page %',pg; end if;
 if has_function_privilege('authenticated','public.brain_publish_approved_core(text,uuid)','execute') or has_function_privilege('anon','public.brain_publish_approved(text,uuid)','execute') then raise exception 'privileges'; end if;
 raise notice 'page layout: all checks passed';
end $$;
rollback;
