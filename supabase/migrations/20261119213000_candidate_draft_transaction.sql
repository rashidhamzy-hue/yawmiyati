-- Draft promotion only. Does not publish, verify stock, or enable checkout.
create table public.candidate_content_approvals (
 store_code text not null, woo_product_id bigint not null, woo_variation_id bigint not null default 0,
 revision_id uuid not null default gen_random_uuid(), title text not null check(length(btrim(title)) between 1 and 500),
 description text not null check(length(btrim(description)) between 1 and 10000),
 source_observed_at timestamptz not null, approved_by uuid not null references auth.users(id), approved_at timestamptz not null default clock_timestamp(),
 approval_sequence bigint generated always as identity,
 primary key(store_code,woo_product_id,woo_variation_id,revision_id),
 foreign key(store_code,woo_product_id,woo_variation_id) references public.catalog_import_candidates(store_code,woo_product_id,woo_variation_id)
);
create table public.candidate_draft_links (
 store_code text not null, woo_product_id bigint not null, woo_variation_id bigint not null,
 revision_id uuid not null, review_at timestamptz not null, listing_id uuid not null,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 primary key(store_code,woo_product_id,woo_variation_id), unique(store_code,listing_id),
 foreign key(store_code,woo_product_id,woo_variation_id,revision_id) references public.candidate_content_approvals(store_code,woo_product_id,woo_variation_id,revision_id),
 foreign key(store_code,listing_id) references public.country_listings(store_code,id)
);
alter table public.candidate_content_approvals enable row level security;
alter table public.candidate_draft_links enable row level security;
revoke all on public.candidate_content_approvals,public.candidate_draft_links from public,anon,authenticated;
create index candidate_content_latest_idx on public.candidate_content_approvals(store_code,woo_product_id,woo_variation_id,approval_sequence desc);

create function public.approve_candidate_content(p_store text,p_product bigint,p_observed_at timestamptz,p_title text,p_description text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.catalog_import_candidates%rowtype; v_revision uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members m where m.user_id=auth.uid() and m.store_code=p_store) then raise exception using errcode='42501',message='Access denied'; end if;
 select * into c from public.catalog_import_candidates where store_code=p_store and woo_product_id=p_product and woo_variation_id=0 for update;
 if not found or c.observed_at is distinct from p_observed_at or c.observed_at not between now()-interval '24 hours' and now() then raise exception 'Candidate changed or stale'; end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 500 or p_description is null or length(btrim(p_description)) not between 1 and 10000 then raise exception 'Invalid content'; end if;
 insert into public.candidate_content_approvals(store_code,woo_product_id,woo_variation_id,title,description,source_observed_at,approved_by)
 values(p_store,p_product,0,btrim(p_title),btrim(p_description),c.observed_at,auth.uid()) returning revision_id into v_revision;
 return v_revision;
end $$;
create function public.create_candidate_draft(p_store text,p_product bigint,p_review_at timestamptz,p_revision uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.catalog_import_candidates%rowtype; r public.candidate_commercial_review%rowtype; a public.candidate_content_approvals%rowtype; existing public.candidate_draft_links%rowtype; v_product uuid; v_listing uuid; v_variant uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members m where m.user_id=auth.uid() and m.store_code=p_store) then raise exception using errcode='42501',message='Access denied'; end if;
 select * into c from public.catalog_import_candidates where store_code=p_store and woo_product_id=p_product and woo_variation_id=0 for update;
 if not found then raise exception 'Candidate unavailable'; end if;
 select * into existing from public.candidate_draft_links where store_code=p_store and woo_product_id=p_product and woo_variation_id=0;
 if found then
  if existing.revision_id=p_revision and existing.review_at=p_review_at then return existing.listing_id; end if;
  raise exception 'Draft exists; explicit edit required';
 end if;
 if c.observed_at not between now()-interval '24 hours' and now() then raise exception 'Candidate stale'; end if;
 select * into r from public.candidate_commercial_review where store_code=p_store and woo_product_id=p_product and woo_variation_id=0 for update;
 if not found or r.updated_at is distinct from p_review_at or r.decision<>'shortlisted' or r.supplier_cost_minor is null or r.delivery_cost_minor is null or r.other_cost_minor is null or r.proposed_price_minor is null then raise exception 'Commercial review incomplete or changed'; end if;
 select * into a from public.candidate_content_approvals where store_code=p_store and woo_product_id=p_product and woo_variation_id=0 and revision_id=p_revision;
 if not found or a.source_observed_at is distinct from c.observed_at or exists(select 1 from public.candidate_content_approvals n where n.store_code=p_store and n.woo_product_id=p_product and n.woo_variation_id=0 and n.approval_sequence>a.approval_sequence) then raise exception 'Content approval missing or superseded'; end if;
 insert into public.catalog_products default values returning id into v_product;
 insert into public.country_listings(store_code,product_id,slug,title,status) values(p_store,v_product,'supplier-'||p_product::text,a.title,'draft') returning id into v_listing;
 insert into public.listing_variants(store_code,listing_id,sku,price_minor,stock_state) values(p_store,v_listing,c.supplier_sku,r.proposed_price_minor,'unknown') returning id into v_variant;
 insert into public.supplier_variant_mappings(store_code,variant_id,supplier_sku,woo_product_id,woo_variation_id) values(p_store,v_variant,c.supplier_sku,p_product,0);
 insert into public.candidate_draft_links(store_code,woo_product_id,woo_variation_id,revision_id,review_at,listing_id,created_by) values(p_store,p_product,0,p_revision,p_review_at,v_listing,auth.uid());
 return v_listing;
end $$;
revoke all on function public.approve_candidate_content(text,bigint,timestamptz,text,text),public.create_candidate_draft(text,bigint,timestamptz,uuid) from public,anon;
grant execute on function public.approve_candidate_content(text,bigint,timestamptz,text,text),public.create_candidate_draft(text,bigint,timestamptz,uuid) to authenticated;

-- Recover approved content and existing draft links after a browser reload.
create function public.dashboard_candidate_content(p_store text,p_product bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.candidate_content_approvals%rowtype; d public.candidate_draft_links%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members m where m.user_id=auth.uid() and m.store_code=p_store) then raise exception using errcode='42501',message='Access denied'; end if;
 select * into a from public.candidate_content_approvals where store_code=p_store and woo_product_id=p_product and woo_variation_id=0 order by approval_sequence desc limit 1;
 select * into d from public.candidate_draft_links where store_code=p_store and woo_product_id=p_product and woo_variation_id=0;
 return jsonb_build_object('approval',case when a.revision_id is null then null else jsonb_build_object('revision_id',a.revision_id,'title',a.title,'description',a.description,'source_observed_at',a.source_observed_at,'approved_at',a.approved_at) end,
 'draft',case when d.listing_id is null then null else jsonb_build_object('listing_id',d.listing_id,'revision_id',d.revision_id,'review_at',d.review_at) end);
end $$;
revoke all on function public.dashboard_candidate_content(text,bigint) from public,anon;
grant execute on function public.dashboard_candidate_content(text,bigint) to authenticated;
