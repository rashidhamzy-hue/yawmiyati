create table public.webhook_receipts (
 store_code text not null references public.stores(code),
 delivery_key text not null,
 body_sha256 text not null check(body_sha256 ~ '^[a-f0-9]{64}$'),
 received_at timestamptz not null default now(),
 state text not null default 'quarantined' check(state in ('quarantined','processed','rejected')),
 primary key(store_code,delivery_key)
);
create table public.reconciliation_runs (
 id uuid primary key default gen_random_uuid(),
 store_code text not null references public.stores(code),
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 state text not null default 'running' check(state in ('running','complete','failed')),
 checked_count integer not null default 0 check(checked_count>=0),
 discrepancy_count integer not null default 0 check(discrepancy_count>=0)
);
alter table public.webhook_receipts enable row level security;
alter table public.reconciliation_runs enable row level security;
revoke all on public.webhook_receipts,public.reconciliation_runs from anon,authenticated;
create index orders_customer_history_idx on public.orders(store_code,customer_id,created_at desc);
create function public.dashboard_customer_orders(p_store text,p_customer uuid,p_limit integer default 50)
returns table(order_id uuid,order_status text,total_minor text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members m where m.user_id=auth.uid() and m.store_code=p_store) then
 raise exception using errcode='42501',message='Access denied';
 end if;
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid limit'; end if;
 return query select o.id,o.status,o.total_minor::text,o.created_at from public.orders o
 where o.store_code=p_store and o.customer_id=p_customer order by o.created_at desc,o.id limit p_limit;
end $$;
revoke all on function public.dashboard_customer_orders(text,uuid,integer) from public,anon;
grant execute on function public.dashboard_customer_orders(text,uuid,integer) to authenticated;
