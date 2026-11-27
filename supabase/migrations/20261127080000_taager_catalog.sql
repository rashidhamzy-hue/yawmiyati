-- Raw Taager catalogue snapshots from the owner-run "Taager sync" bookmarklet
-- (docs/handoff/TAAGER-BROWSER-SYNC.md). One row per market + Taager SKU, latest data wins.
-- Server/owner use only: RLS on, no client policies, no grants to anon/authenticated.

create table if not exists public.taager_sync_batches (
  id uuid primary key default gen_random_uuid(),
  market text not null check (market in ('sa','ae','om','eg','iq')),
  country text not null,
  source text not null default 'taager-merchant-sync',
  source_version int,
  started_at timestamptz,
  finished_at timestamptz,
  imported_at timestamptz not null default now(),
  listing_count int not null default 0,
  detail_count int not null default 0,
  errors jsonb not null default '[]'::jsonb
);

create table if not exists public.taager_catalog (
  market text not null check (market in ('sa','ae','om','eg','iq')),
  sku text not null,
  product_id bigint not null,
  variant_id bigint,
  item_type text,
  name text,
  listing jsonb not null,
  detail jsonb,
  alternatives jsonb,
  batch_id uuid references public.taager_sync_batches(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  primary key (market, sku)
);

create index if not exists taager_catalog_product_idx on public.taager_catalog (market, product_id);

alter table public.taager_sync_batches enable row level security;
alter table public.taager_catalog enable row level security;
revoke all on public.taager_sync_batches from anon, authenticated;
revoke all on public.taager_catalog from anon, authenticated;

comment on table public.taager_catalog is 'Latest Taager merchant-API data per market+SKU (listing, merchant-info detail, alternatives). Source: owner-run Taager sync. Supplier facts only; never shown to shoppers as-is.';
