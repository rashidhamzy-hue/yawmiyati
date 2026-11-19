create table public.stores (
 code text primary key check (code in ('sa','ae','om','eg','iq')),
 currency text not null,
 minor_digits smallint not null check (minor_digits between 0 and 3),
 checkout_enabled boolean not null default false,
 fulfillment_enabled boolean not null default false,
 check (not fulfillment_enabled or checkout_enabled)
);
insert into public.stores(code,currency,minor_digits) values
 ('sa','SAR',2),('ae','AED',2),('om','OMR',3),('eg','EGP',2),('iq','IQD',3);
create table public.catalog_products (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now()
);
create table public.country_listings (
 store_code text not null references public.stores(code),
 id uuid not null default gen_random_uuid(),
 product_id uuid not null references public.catalog_products(id),
 slug text not null,
 title text not null,
 status text not null default 'draft' check (status in ('draft','approved','published','suspended','archived')),
 primary key(store_code,id), unique(store_code,slug)
);
create table public.listing_variants (
 store_code text not null,
 id uuid not null default gen_random_uuid(),
 listing_id uuid not null,
 sku text not null,
 price_minor bigint not null check(price_minor >= 0),
 stock_state text not null default 'unknown' check(stock_state in ('unknown','available','unavailable')),
 stock_checked_at timestamptz,
 primary key(store_code,id), unique(store_code,sku),
 foreign key(store_code,listing_id) references public.country_listings(store_code,id)
);
create table public.orders (
 store_code text not null references public.stores(code),
 id uuid not null default gen_random_uuid(),
 checkout_key text not null,
 status text not null default 'pending' check(status in ('pending','accepted','confirmed','shipped','delivered','failed','cancelled','returned','unknown')),
 total_minor bigint not null check(total_minor >= 0),
 created_at timestamptz not null default now(),
 primary key(store_code,id), unique(store_code,checkout_key)
);
create table public.order_lines (
 store_code text not null,
 id uuid not null default gen_random_uuid(),
 order_id uuid not null,
 variant_id uuid not null,
 quantity integer not null check(quantity > 0),
 unit_minor bigint not null check(unit_minor >= 0),
 primary key(store_code,id),
 foreign key(store_code,order_id) references public.orders(store_code,id),
 foreign key(store_code,variant_id) references public.listing_variants(store_code,id)
);
create table public.commerce_outbox (
 id uuid primary key default gen_random_uuid(),
 store_code text not null,
 order_id uuid not null,
 event_type text not null,
 status text not null default 'pending' check(status in ('pending','processing','done','quarantined')),
 created_at timestamptz not null default now(),
 unique(store_code,order_id,event_type),
 foreign key(store_code,order_id) references public.orders(store_code,id)
);
do $$ declare t text; begin
 foreach t in array array['stores','catalog_products','country_listings','listing_variants','orders','order_lines','commerce_outbox'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
