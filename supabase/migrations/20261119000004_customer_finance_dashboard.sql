create table public.customers (
 store_code text not null references public.stores(code),
 id uuid not null default gen_random_uuid(),
 phone_e164 text not null check(phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
 display_name text,
 created_at timestamptz not null default now(),
 primary key(store_code,id), unique(store_code,phone_e164)
);
alter table public.orders add column customer_id uuid;
alter table public.orders add foreign key(store_code,customer_id) references public.customers(store_code,id);
create table public.financial_entries (
 id uuid primary key default gen_random_uuid(),
 store_code text not null references public.stores(code),
 order_id uuid,
 source text not null,
 external_key text not null,
 kind text not null check(kind in ('sale','supplier_cost','delivery_cost','failed_delivery_cost','refund','ad_cost','operating_cost','adjustment')),
 amount_minor bigint not null check(amount_minor <> 0),
 occurred_at timestamptz not null,
 recorded_at timestamptz not null default now(),
 unique(store_code,source,external_key),
 foreign key(store_code,order_id) references public.orders(store_code,id)
);
create table public.dashboard_members (
 user_id uuid not null references auth.users(id) on delete cascade,
 store_code text not null references public.stores(code),
 primary key(user_id,store_code)
);
alter table public.customers enable row level security;
alter table public.financial_entries enable row level security;
alter table public.dashboard_members enable row level security;
revoke all on public.customers,public.financial_entries,public.dashboard_members from anon,authenticated;
create function public.dashboard_summary(p_store text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members where user_id=auth.uid() and store_code=p_store) then
 raise exception using errcode='42501',message='Access denied';
 end if;
 return jsonb_build_object('store',p_store,
 'currency',(select currency from public.stores where code=p_store),
 'orders',(select count(*) from public.orders where store_code=p_store),
 'customers',(select count(*) from public.customers where store_code=p_store),
 'order_statuses',(select coalesce(jsonb_object_agg(status,n),'{}'::jsonb) from (select status,count(*) n from public.orders where store_code=p_store group by status) s),
 'recorded_net_minor',(select coalesce(sum(amount_minor),0)::text from public.financial_entries where store_code=p_store));
end $$;
revoke all on function public.dashboard_summary(text) from public,anon;
grant execute on function public.dashboard_summary(text) to authenticated;
