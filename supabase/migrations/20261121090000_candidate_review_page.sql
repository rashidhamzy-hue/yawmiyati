-- M6C: additive owner-only candidate pagination. SOURCE ONLY until explicitly
-- deployed to the existing Yawmiyati STAGING project skhtunkknshvolturqlm.
-- Preserve dashboard_candidate_review for clients not upgraded yet.
create function public.dashboard_candidate_review_page(
 p_store text, p_limit integer default 100, p_offset integer default 0
)
returns table(
 woo_product_id bigint,supplier_sku text,title text,observed_price_minor text,
 source_stock_status text,observed_at timestamptz,images jsonb,categories jsonb,review jsonb
)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(
  select 1 from public.dashboard_members m
  where m.user_id=auth.uid() and m.store_code=p_store
 ) then
  raise exception using errcode='42501',message='Access denied';
 end if;
 if p_limit is null or p_limit not between 1 and 100
    or p_offset is null or p_offset not between 0 and 100000 then
  raise exception 'Invalid candidate pagination';
 end if;
 return query
 select c.woo_product_id,c.supplier_sku,c.title,c.observed_price_minor::text,
  c.supplier_snapshot->>'stock_status',c.observed_at,
  c.supplier_snapshot->'images',c.supplier_snapshot->'categories',
  case when r.woo_product_id is null then null
   else jsonb_build_object(
    'supplier_cost_minor',r.supplier_cost_minor,
    'delivery_cost_minor',r.delivery_cost_minor,
    'other_cost_minor',r.other_cost_minor,
    'proposed_price_minor',r.proposed_price_minor,
    'decision',r.decision,'updated_at',r.updated_at
   )
  end
 from public.catalog_import_candidates c
 left join public.candidate_commercial_review r
  on (c.store_code,c.woo_product_id,c.woo_variation_id)=
     (r.store_code,r.woo_product_id,r.woo_variation_id)
 where c.store_code=p_store and c.woo_variation_id=0
 order by c.observed_at desc,c.woo_product_id
 limit p_limit offset p_offset;
end $$;
revoke all on function public.dashboard_candidate_review_page(text,integer,integer)
 from public,anon;
grant execute on function public.dashboard_candidate_review_page(text,integer,integer)
 to authenticated;

-- Add an equivalent, market-scoped readiness view for candidate pages beyond 100.
create function public.dashboard_catalog_readiness_page(p_store text,p_limit integer default 100,p_offset integer default 0)
returns table(woo_product_id bigint,listing_id uuid,listing_status text,blockers text[])
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members m where m.user_id=auth.uid() and m.store_code=p_store) then
  raise exception using errcode='42501',message='Access denied';
 end if;
 if p_limit is null or p_limit not between 1 and 100
  or p_offset is null or p_offset not between 0 and 100000 then
  raise exception 'Invalid readiness pagination';
 end if;
 return query
 select c.woo_product_id,d.listing_id,l.status,
 array_remove(array[
  case when c.observed_at not between now()-interval '24 hours' and now() then 'supplier_observation_stale' end,
  case when c.observed_stock='unavailable' then 'supplier_unavailable' end,
  case when r.woo_product_id is null or r.decision<>'shortlisted' then 'not_shortlisted' end,
  case when r.woo_product_id is null or r.supplier_cost_minor is null or r.delivery_cost_minor is null or r.other_cost_minor is null or r.proposed_price_minor is null then 'commercial_costs_incomplete' end,
  case when a.revision_id is null or a.source_observed_at is distinct from c.observed_at then 'content_approval_missing_or_stale' end,
  case when d.listing_id is null then 'draft_missing' end,
  case when d.listing_id is not null and (r.updated_at is distinct from d.review_at or d.revision_id is distinct from a.revision_id) then 'draft_review_or_content_changed' end,
  case when l.id is not null and l.status in ('suspended','archived') then 'listing_suspended_or_archived' end,
  case when d.listing_id is not null and (e.state is distinct from 'available' or v.stock_state is distinct from 'available' or e.verified_at is null or e.verified_at is distinct from v.stock_checked_at or e.verified_at not between now()-interval '15 minutes' and now()) then 'verified_stock_missing_or_stale' end,
  case when not s.catalog_release_enabled then 'market_release_disabled' end
 ]::text[],null)
 from public.catalog_import_candidates c
 join public.stores s on s.code=c.store_code
 left join public.candidate_commercial_review r on (r.store_code,r.woo_product_id,r.woo_variation_id)=(c.store_code,c.woo_product_id,c.woo_variation_id)
 left join lateral (select ac.revision_id,ac.source_observed_at from public.candidate_content_approvals ac
 where (ac.store_code,ac.woo_product_id,ac.woo_variation_id)=(c.store_code,c.woo_product_id,c.woo_variation_id)
 order by ac.approval_sequence desc limit 1) a on true
 left join public.candidate_draft_links d on (d.store_code,d.woo_product_id,d.woo_variation_id)=(c.store_code,c.woo_product_id,c.woo_variation_id)
 left join public.country_listings l on (l.store_code,l.id)=(d.store_code,d.listing_id)
 left join public.supplier_variant_mappings m on (m.store_code,m.woo_product_id,m.woo_variation_id)=(c.store_code,c.woo_product_id,c.woo_variation_id)
 left join public.listing_variants v on (v.store_code,v.id)=(m.store_code,m.variant_id)
 left join public.verified_stock_evidence e on (e.store_code,e.variant_id)=(v.store_code,v.id)
 where c.store_code=p_store and c.woo_variation_id=0
 order by c.observed_at desc,c.woo_product_id limit p_limit offset p_offset;
end $$;
revoke all on function public.dashboard_catalog_readiness_page(text,integer,integer)
 from public,anon;
grant execute on function public.dashboard_catalog_readiness_page(text,integer,integer)
 to authenticated;
notify pgrst,'reload schema';
