-- Dated shop-price cache for the brain (session 3, step 2).
-- One row per shop page a product was seen on (price, the shop's own delivery charge, exact/similar, whether the
-- seller looked credible, when and how it was seen), plus one summary row per product: median and cheapest credible
-- door total, what the research cost, and the full research record (facts in the researcher's own words with their
-- source pages, buyer questions). Service role writes; the owner reads through one RPC. No shopper ever reads these.
-- The cache is what makes re-runs idempotent and the daily re-pricing cheap: a product researched within 14 days is
-- not paid for again.

create table public.market_price_evidence (
  store_code text not null references public.stores(code),
  sku text not null check (length(sku) between 1 and 120),
  url text not null check (url ~ '^https?://' and length(url) <= 600),
  retailer text not null,
  title text,
  price_minor bigint not null check (price_minor > 0),
  delivery_minor bigint check (delivery_minor >= 0),
  match text not null check (match in ('exact', 'similar')),
  confidence numeric not null check (confidence between 0 and 1),
  credible boolean not null default true,
  cited boolean not null default false,
  source text not null default 'web_search' check (source in ('web_search', 'owner')),
  seen_at timestamptz not null default now(),
  primary key (store_code, sku, url)
);
create index market_price_evidence_seen on public.market_price_evidence(store_code, seen_at);

create table public.market_research_cache (
  store_code text not null references public.stores(code),
  sku text not null check (length(sku) between 1 and 120),
  research jsonb not null check (jsonb_typeof(research) = 'object'),
  researched_at timestamptz not null default now(),
  cost_microusd bigint not null default 0 check (cost_microusd >= 0),
  web_searches integer not null default 0 check (web_searches >= 0),
  basis text not null default 'none' check (basis in ('exact', 'similar', 'none')),
  shops integer not null default 0 check (shops >= 0),
  shops_ignored integer not null default 0 check (shops_ignored >= 0),
  median_minor bigint check (median_minor > 0),
  cheapest_minor bigint check (cheapest_minor > 0),
  cheapest_retailer text,
  primary key (store_code, sku)
);
alter table public.market_price_evidence enable row level security;
alter table public.market_research_cache enable row level security;
revoke all on public.market_price_evidence, public.market_research_cache from public, anon, authenticated;
grant select, insert, update, delete on public.market_price_evidence, public.market_research_cache to service_role;

-- Owner: what the brain knows about other shops' prices in one market (totals) or for one product (every page, dated).
create function public.brain_market_evidence(p_store text, p_sku text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_sku is null then
    return (select jsonb_build_object(
      'products', count(*), 'with_shops', count(*) filter (where c.shops > 0),
      'research_cost_microusd', coalesce(sum(c.cost_microusd), 0), 'web_searches', coalesce(sum(c.web_searches), 0),
      'avg_cost_microusd', coalesce(round(avg(c.cost_microusd)), 0),
      'oldest', min(c.researched_at), 'newest', max(c.researched_at),
      'stale', count(*) filter (where c.researched_at < now() - interval '14 days'))
      from public.market_research_cache c where c.store_code = p_store);
  end if;
  return jsonb_build_object(
    'summary', (select to_jsonb(c) - 'research' - 'store_code' from public.market_research_cache c where (c.store_code, c.sku) = (p_store, p_sku)),
    'facts', (select c.research->'facts' from public.market_research_cache c where (c.store_code, c.sku) = (p_store, p_sku)),
    'shops', coalesce((select jsonb_agg(to_jsonb(e) - 'store_code' - 'sku' order by e.credible desc, e.price_minor)
                        from public.market_price_evidence e where (e.store_code, e.sku) = (p_store, p_sku)), '[]'::jsonb));
end $$;
revoke all on function public.brain_market_evidence(text, text) from public, anon;
grant execute on function public.brain_market_evidence(text, text) to authenticated;
