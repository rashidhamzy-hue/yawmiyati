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
notify pgrst,'reload schema';
