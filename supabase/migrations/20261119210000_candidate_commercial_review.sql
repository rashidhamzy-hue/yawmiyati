-- Owner-only commercial review data; never publishes or orders.
create table public.candidate_commercial_review (
 store_code text not null, woo_product_id bigint not null, woo_variation_id bigint not null default 0,
 supplier_cost_minor bigint check (supplier_cost_minor between 0 and 1000000000),
 delivery_cost_minor bigint check (delivery_cost_minor between 0 and 1000000000),
 other_cost_minor bigint check (other_cost_minor between 0 and 1000000000),
 proposed_price_minor bigint check (proposed_price_minor between 1 and 1000000000),
 decision text not null default 'pending' check (decision in ('pending','shortlisted','rejected')),
 updated_at timestamptz not null default now(),
 updated_by uuid not null,
 primary key(store_code,woo_product_id,woo_variation_id),
 foreign key(store_code,woo_product_id,woo_variation_id) references public.catalog_import_candidates(store_code,woo_product_id,woo_variation_id)
);
alter table public.candidate_commercial_review enable row level security;
revoke all on public.candidate_commercial_review from public,anon,authenticated;
create function public.dashboard_candidate_review(p_store text,p_limit integer default 100)
returns table(woo_product_id bigint, supplier_sku text,title text,observed_price_minor text,source_stock_status text,observed_at timestamptz,images jsonb,categories jsonb,review jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members where user_id=auth.uid() and store_code=p_store) then raise exception using errcode='42501',message='Access denied'; end if;
 return query select c.woo_product_id,c.supplier_sku,c.title,c.observed_price_minor::text,c.supplier_snapshot->>'stock_status',c.observed_at,c.supplier_snapshot->'images',c.supplier_snapshot->'categories',case when r.woo_product_id is null then null else jsonb_build_object('supplier_cost_minor',r.supplier_cost_minor,'delivery_cost_minor',r.delivery_cost_minor,'other_cost_minor',r.other_cost_minor,'proposed_price_minor',r.proposed_price_minor,'decision',r.decision,'updated_at',r.updated_at) end from public.catalog_import_candidates c left join public.candidate_commercial_review r on (c.store_code,c.woo_product_id,c.woo_variation_id)=(r.store_code,r.woo_product_id,r.woo_variation_id) where c.store_code=p_store and c.woo_variation_id=0 order by c.observed_at desc,c.woo_product_id limit least(greatest(coalesce(p_limit,100),1),100);
end $$;
create function public.dashboard_save_candidate_review(p_store text,p_product bigint,p_supplier bigint,p_delivery bigint,p_other bigint,p_price bigint,p_decision text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members where user_id=auth.uid() and store_code=p_store) then raise exception using errcode='42501',message='Access denied'; end if;
 if p_decision is null or p_decision not in ('pending','shortlisted','rejected') then raise exception 'Invalid decision'; end if;
 insert into public.candidate_commercial_review(store_code,woo_product_id,woo_variation_id,supplier_cost_minor,delivery_cost_minor,other_cost_minor,proposed_price_minor,decision,updated_by)
 values(p_store,p_product,0,p_supplier,p_delivery,p_other,p_price,p_decision,auth.uid())
 on conflict(store_code,woo_product_id,woo_variation_id) do update set supplier_cost_minor=excluded.supplier_cost_minor,delivery_cost_minor=excluded.delivery_cost_minor,other_cost_minor=excluded.other_cost_minor,proposed_price_minor=excluded.proposed_price_minor,decision=excluded.decision,updated_by=auth.uid(),updated_at=now();
end $$;
revoke all on function public.dashboard_candidate_review(text,integer) from public,anon;
revoke all on function public.dashboard_save_candidate_review(text,bigint,bigint,bigint,bigint,bigint,text) from public,anon;
grant execute on function public.dashboard_candidate_review(text,integer) to authenticated;
grant execute on function public.dashboard_save_candidate_review(text,bigint,bigint,bigint,bigint,bigint,text) to authenticated;
