-- Release is OFF by default. Only trusted server operations may manage release and stock evidence.
alter table public.stores add column catalog_release_enabled boolean not null default false;
create table public.verified_stock_evidence (
 store_code text not null, variant_id uuid not null, source_ref text not null check(length(btrim(source_ref)) between 1 and 500),
 state text not null check(state in ('available','unavailable')), verified_at timestamptz not null,
 primary key(store_code,variant_id), foreign key(store_code,variant_id) references public.listing_variants(store_code,id)
);
alter table public.verified_stock_evidence enable row level security;
revoke all on public.verified_stock_evidence from public,anon,authenticated;
create function public.record_verified_stock(p_store text,p_variant uuid,p_state text,p_ref text,p_at timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_state is null or p_state not in ('available','unavailable') or p_ref is null or length(btrim(p_ref)) not between 1 and 500 or p_at is null or p_at not between now()-interval '15 minutes' and now() then raise exception 'Invalid stock evidence'; end if;
 perform 1 from public.listing_variants where store_code=p_store and id=p_variant for update;
 if not found then raise exception 'Variant unavailable'; end if;
 insert into public.verified_stock_evidence as e(store_code,variant_id,source_ref,state,verified_at) values(p_store,p_variant,p_ref,p_state,p_at)
 on conflict(store_code,variant_id) do update set source_ref=excluded.source_ref,state=excluded.state,verified_at=excluded.verified_at where excluded.verified_at>e.verified_at;
 if found then update public.listing_variants set stock_state=p_state,stock_checked_at=p_at where store_code=p_store and id=p_variant; end if;
end $$;
revoke all on function public.record_verified_stock(text,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_verified_stock(text,uuid,text,text,timestamptz) to service_role;

-- Shared read guard; never allow a changed commercial or content revision to stay visible.
create function public.current_catalog_release(p_store text)
returns table(listing_id uuid,slug text,title text,description text,price_minor text,currency text)
language sql stable security definer set search_path='' as $$
 select l.id,l.slug,a.title,a.description,v.price_minor::text,s.currency
 from public.country_listings l
 join public.stores s on s.code=l.store_code
 join public.candidate_draft_links d on (d.store_code,d.listing_id)=(l.store_code,l.id)
 join public.catalog_import_candidates c on (c.store_code,c.woo_product_id,c.woo_variation_id)=(d.store_code,d.woo_product_id,d.woo_variation_id)
 join public.candidate_content_approvals a on (a.store_code,a.woo_product_id,a.woo_variation_id,a.revision_id)=(d.store_code,d.woo_product_id,d.woo_variation_id,d.revision_id)
 join public.candidate_commercial_review r on (r.store_code,r.woo_product_id,r.woo_variation_id)=(d.store_code,d.woo_product_id,d.woo_variation_id)
 join public.supplier_variant_mappings m on (m.store_code,m.woo_product_id,m.woo_variation_id)=(d.store_code,d.woo_product_id,d.woo_variation_id)
 join public.listing_variants v on (v.store_code,v.id,v.listing_id)=(m.store_code,m.variant_id,l.id)
 join public.verified_stock_evidence e on (e.store_code,e.variant_id)=(v.store_code,v.id)
 where l.store_code=p_store and s.catalog_release_enabled and l.status='published'
 and v.stock_state='available' and e.state='available' and v.stock_checked_at=e.verified_at and e.verified_at between now()-interval '15 minutes' and now()
 and r.updated_at=d.review_at and r.decision='shortlisted' and r.proposed_price_minor=v.price_minor and r.supplier_cost_minor is not null and r.delivery_cost_minor is not null and r.other_cost_minor is not null
 and c.observed_stock<>'unavailable' and c.supplier_sku=m.supplier_sku and a.source_observed_at=c.observed_at
 and not exists(select 1 from public.candidate_content_approvals n where (n.store_code,n.woo_product_id,n.woo_variation_id)=(a.store_code,a.woo_product_id,a.woo_variation_id) and n.approval_sequence>a.approval_sequence)
$$;
revoke all on function public.current_catalog_release(text) from public,anon,authenticated;
create or replace function public.public_catalog(p_store text,p_limit integer default 50,p_offset integer default 0)
returns table(listing_id uuid,slug text,title text,price_minor text,currency text)
language sql stable security definer set search_path='' as $$
 select listing_id,slug,title,price_minor,currency from public.current_catalog_release(p_store)
 order by slug,listing_id limit least(greatest(coalesce(p_limit,50),1),100) offset least(greatest(coalesce(p_offset,0),0),10000)
$$;
create function public.public_catalog_detail(p_store text,p_slug text)
returns table(listing_id uuid,slug text,title text,description text,price_minor text,currency text)
language sql stable security definer set search_path='' as $$
 select * from public.current_catalog_release(p_store) where slug=p_slug limit 1
$$;
revoke all on function public.public_catalog_detail(text,text) from public;
grant execute on function public.public_catalog_detail(text,text) to anon,authenticated;
-- Explicit owner release; hold candidate/review/listing/stock rows until transaction completes.
create function public.publish_candidate_draft(p_store text,p_product bigint,p_listing uuid)
returns void language plpgsql security definer set search_path='' as $$
declare d public.candidate_draft_links%rowtype; c public.catalog_import_candidates%rowtype; r public.candidate_commercial_review%rowtype; a public.candidate_content_approvals%rowtype; v public.listing_variants%rowtype; e public.verified_stock_evidence%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members where user_id=auth.uid() and store_code=p_store) then raise exception using errcode='42501',message='Access denied'; end if;
 perform 1 from public.stores where code=p_store and catalog_release_enabled for share;
 if not found then raise exception 'Market release disabled'; end if;
 select * into c from public.catalog_import_candidates where store_code=p_store and woo_product_id=p_product and woo_variation_id=0 for update;
 if not found or c.observed_stock='unavailable' then raise exception 'Candidate unavailable'; end if;
 select * into d from public.candidate_draft_links where store_code=p_store and woo_product_id=p_product and woo_variation_id=0 and listing_id=p_listing for update;
 if not found then raise exception 'Draft unavailable'; end if;
 select * into r from public.candidate_commercial_review where store_code=p_store and woo_product_id=p_product and woo_variation_id=0 for update;
 if not found or r.updated_at<>d.review_at or r.decision<>'shortlisted' or r.supplier_cost_minor is null or r.delivery_cost_minor is null or r.other_cost_minor is null or r.proposed_price_minor is null then raise exception 'Review changed'; end if;
 select * into a from public.candidate_content_approvals where store_code=p_store and woo_product_id=p_product and woo_variation_id=0 and revision_id=d.revision_id;
 if not found or a.source_observed_at<>c.observed_at or exists(select 1 from public.candidate_content_approvals n where (n.store_code,n.woo_product_id,n.woo_variation_id)=(a.store_code,a.woo_product_id,a.woo_variation_id) and n.approval_sequence>a.approval_sequence) then raise exception 'Content changed'; end if;
 perform 1 from public.country_listings where store_code=p_store and id=p_listing and status in ('draft','approved','published') for update;
 if not found then raise exception 'Listing unavailable'; end if;
 select lv.* into v from public.listing_variants lv join public.supplier_variant_mappings m on (m.store_code,m.variant_id)=(lv.store_code,lv.id) where lv.store_code=p_store and lv.listing_id=p_listing and m.woo_product_id=p_product and m.woo_variation_id=0 and m.supplier_sku=c.supplier_sku for update of lv;
 if not found or v.price_minor<>r.proposed_price_minor or v.stock_state<>'available' then raise exception 'Variant unavailable'; end if;
 select * into e from public.verified_stock_evidence where store_code=p_store and variant_id=v.id for update;
 if not found or e.state<>'available' or e.verified_at is distinct from v.stock_checked_at or e.verified_at not between now()-interval '15 minutes' and now() then raise exception 'Verified stock required'; end if;
 update public.country_listings set status='published' where store_code=p_store and id=p_listing;
end $$;
revoke all on function public.publish_candidate_draft(text,bigint,uuid) from public,anon;
grant execute on function public.publish_candidate_draft(text,bigint,uuid) to authenticated;
