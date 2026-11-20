-- Read-only readiness diagnostics; NOT an authorization to publish.
create function public.dashboard_catalog_readiness(p_store text)
returns table(woo_product_id bigint,listing_id uuid,listing_status text,blockers text[])
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members m where m.user_id=auth.uid() and m.store_code=p_store) then
  raise exception using errcode='42501',message='Access denied';
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
 order by c.observed_at desc,c.woo_product_id limit 100;
end $$;
revoke all on function public.dashboard_catalog_readiness(text) from public,anon;
grant execute on function public.dashboard_catalog_readiness(text) to authenticated;
