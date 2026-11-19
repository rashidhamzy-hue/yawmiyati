create table public.supplier_variant_mappings (
 store_code text not null, variant_id uuid not null,
 supplier_sku text not null, woo_product_id bigint not null check(woo_product_id>0),
 woo_variation_id bigint not null default 0 check(woo_variation_id>=0),
 updated_at timestamptz not null default now(),
 primary key(store_code,variant_id), unique(store_code,woo_product_id,woo_variation_id),
 foreign key(store_code,variant_id) references public.listing_variants(store_code,id)
);
create table public.supplier_order_mappings (
 store_code text not null, order_id uuid not null,
 woo_order_id bigint not null check(woo_order_id>0), supplier_order_id text,
 primary key(store_code,order_id), unique(store_code,woo_order_id), unique(store_code,supplier_order_id),
 foreign key(store_code,order_id) references public.orders(store_code,id)
);
create table public.supplier_order_events (
 id uuid primary key default gen_random_uuid(),
 store_code text not null, order_id uuid not null,
 source text not null check(source in ('woo','taager','reconciliation')),
 source_event_key text not null,
 raw_status text not null,
 normalized_status text not null check(normalized_status in ('pending','accepted','confirmed','shipped','delivered','failed','cancelled','returned','unknown')),
 outcome_reason text,
 occurred_at timestamptz, received_at timestamptz not null default now(),
 unique(store_code,source,source_event_key),
 foreign key(store_code,order_id) references public.orders(store_code,id)
);
create index supplier_events_order_idx on public.supplier_order_events(store_code,order_id,received_at);
alter table public.supplier_variant_mappings enable row level security;
alter table public.supplier_order_mappings enable row level security;
alter table public.supplier_order_events enable row level security;
revoke all on public.supplier_variant_mappings,public.supplier_order_mappings,public.supplier_order_events from anon,authenticated;
