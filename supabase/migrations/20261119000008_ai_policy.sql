create table public.ai_market_policy (
 store_code text primary key references public.stores(code),
 enabled boolean not null default false,
 daily_budget_microusd bigint not null default 0 check(daily_budget_microusd>=0),
 auto_pricing_enabled boolean not null default false,
 auto_publish_enabled boolean not null default false
);
insert into public.ai_market_policy(store_code) select code from public.stores;
create table public.ai_jobs (
 id uuid primary key default gen_random_uuid(),
 store_code text not null references public.stores(code),
 task text not null check(task in ('product_research','pricing','marketing','localized_content','merchandising')),
 dedupe_key text not null,
 state text not null default 'blocked' check(state in ('blocked','queued','running','complete','failed')),
 reserved_microusd bigint not null default 0 check(reserved_microusd>=0),
 actual_microusd bigint check(actual_microusd>=0),
 created_at timestamptz not null default now(),
 unique(store_code,dedupe_key)
);
create table public.marketing_observations (
 id uuid primary key default gen_random_uuid(),
 store_code text not null references public.stores(code),
 listing_id uuid not null,
 source text not null,
 external_key text not null,
 observed_at timestamptz not null,
 impressions bigint not null check(impressions>=0),
 clicks bigint not null check(clicks>=0),
 submitted_orders bigint not null check(submitted_orders>=0),
 delivered_orders bigint not null check(delivered_orders>=0 and delivered_orders<=submitted_orders),
 spend_minor bigint not null check(spend_minor>=0),
 unique(store_code,source,external_key),
 foreign key(store_code,listing_id) references public.country_listings(store_code,id)
);
create table public.localized_content_drafts (
 id uuid primary key default gen_random_uuid(),
 store_code text not null,
 listing_id uuid not null,
 locale text not null,
 channel text not null check(channel in ('storefront','seo','social','ad')),
 body jsonb not null,
 evidence jsonb not null,
 state text not null default 'draft' check(state in ('draft','approved','rejected')),
 created_at timestamptz not null default now(),
 foreign key(store_code,listing_id) references public.country_listings(store_code,id)
);
alter table public.ai_market_policy enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.marketing_observations enable row level security;
alter table public.localized_content_drafts enable row level security;
revoke all on public.ai_market_policy,public.ai_jobs,public.marketing_observations,public.localized_content_drafts from anon,authenticated;
