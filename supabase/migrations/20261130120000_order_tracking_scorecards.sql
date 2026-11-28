-- Order lifecycle and daily scorecards (session 3, step 5).
-- order_tracking: one row per WooCommerce order of a market's connector site, as the Taager plugin reports it:
--   placed → confirmed → shipped → delivered / refused / returned / unreachable (/ cancelled), with the reason.
--   It holds NO name, address or email: the order number, the items, the totals, the traffic source, a keyed
--   one-way hash of the phone (for the blacklist) and the profit that order earns if delivered.
-- product_scorecard_daily / source_scorecard_daily: counts per product and per traffic source per day
--   (listing impressions and clicks, views, add to cart, order-form starts from PostHog aggregates; orders and their
--   outcomes from order_tracking). No visitor, session or customer is stored anywhere.
-- Service role writes; the owner reads through brain_scorecards. Nothing here is visible to shoppers.

create table public.order_tracking (
  store_code text not null references public.stores(code),
  woo_order_id bigint not null check (woo_order_id > 0),
  order_number text not null,
  status text not null check (status in ('placed','confirmed','shipped','delivered','refused','returned','unreachable','cancelled','unknown')),
  raw_status text not null default '',
  reason text check (length(reason) <= 300),
  reason_bucket text check (reason_bucket in ('unreachable','refused_at_door','changed_mind','price','wrong_address','duplicate','out_of_stock','delivery_delay','not_as_expected','other')),
  placed_at timestamptz not null,
  modified_at timestamptz not null,
  confirmed_at timestamptz, shipped_at timestamptz, closed_at timestamptz,
  total_minor bigint not null default 0 check (total_minor >= 0),
  delivery_minor bigint not null default 0 check (delivery_minor >= 0),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  source text, medium text, campaign text, paid_click text,
  phone_hash text check (phone_hash ~ '^[0-9a-f]{64}$'),
  -- What this order earns if delivered: items total - Taager cost of every piece - Saudi VAT, snapshotted when first seen.
  profit_minor bigint,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store_code, woo_order_id)
);
create index order_tracking_placed on public.order_tracking(store_code, placed_at);
create index order_tracking_phone on public.order_tracking(phone_hash) where phone_hash is not null;

create table public.order_sync_state (
  store_code text primary key references public.stores(code),
  synced_through timestamptz not null default '2026-01-01T00:00:00Z',
  last_run_at timestamptz, last_error text, orders_seen bigint not null default 0
);
insert into public.order_sync_state(store_code) select code from public.stores on conflict do nothing;

create table public.product_scorecard_daily (
  store_code text not null references public.stores(code),
  day date not null,
  listing_id uuid not null,
  list_impressions integer not null default 0, list_clicks integer not null default 0, views integer not null default 0, scroll_75 integer not null default 0,
  add_to_cart integer not null default 0, checkout_starts integer not null default 0,
  orders integer not null default 0, confirmed integer not null default 0, shipped integer not null default 0, delivered integer not null default 0,
  refused integer not null default 0, returned integer not null default 0, unreachable integer not null default 0, cancelled integer not null default 0,
  profit_delivered_minor bigint not null default 0,
  refusal_reasons jsonb not null default '{}'::jsonb check (jsonb_typeof(refusal_reasons) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (store_code, day, listing_id),
  foreign key (store_code, listing_id) references public.country_listings(store_code, id) on delete cascade
);
create table public.source_scorecard_daily (
  store_code text not null references public.stores(code),
  day date not null,
  source text not null default 'direct', medium text not null default '', campaign text not null default '',
  visits integer not null default 0, product_views integer not null default 0, add_to_cart integer not null default 0, checkout_starts integer not null default 0,
  orders integer not null default 0, delivered integer not null default 0, undelivered integer not null default 0, profit_delivered_minor bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (store_code, day, source, medium, campaign)
);
create table public.search_gaps_daily (
  store_code text not null references public.stores(code),
  day date not null, query text not null check (length(query) between 2 and 80), searches integer not null check (searches > 0),
  primary key (store_code, day, query)
);
alter table public.order_tracking enable row level security;
alter table public.order_sync_state enable row level security;
alter table public.product_scorecard_daily enable row level security;
alter table public.source_scorecard_daily enable row level security;
alter table public.search_gaps_daily enable row level security;
revoke all on public.order_tracking, public.order_sync_state, public.product_scorecard_daily, public.source_scorecard_daily, public.search_gaps_daily from public, anon, authenticated;
grant select, insert, update, delete on public.order_tracking, public.order_sync_state, public.product_scorecard_daily, public.source_scorecard_daily, public.search_gaps_daily to service_role;

-- Service role: store what the connector read. Idempotent per order; an older reading never overwrites a newer one;
-- the first time a state is seen its time is kept; the profit snapshot is taken once, from Taager's cost at that moment.
create function public.order_tracking_upsert(p_store text, p_rows jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare r jsonb; n_new integer := 0; n_changed integer := 0; v_old public.order_tracking; v_status text; v_profit bigint; v_modified timestamptz;
  v_digits smallint; v_vat integer;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then raise exception 'invalid_rows' using errcode = '22023'; end if;
  select s.minor_digits into v_digits from public.stores s where s.code = p_store;
  if v_digits is null then raise exception 'unknown_store' using errcode = '22023'; end if;
  select coalesce(f.vat_added_profit_bps, 0) into v_vat from public.store_commerce_facts f where f.store_code = p_store;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_status := r->>'status'; v_modified := (r->>'modified_at')::timestamptz;
    select * into v_old from public.order_tracking o where o.store_code = p_store and o.woo_order_id = (r->>'woo_order_id')::bigint for update;
    if v_old.woo_order_id is null then
      -- Profit if delivered: only when Taager's cost is known for every item.
      select case when bool_and(c.cost is not null) then
               public.store_profit(sum((i->>'total_minor')::bigint)::bigint, sum(c.cost * (i->>'quantity')::integer)::bigint,
                                   case when bool_and(c.floor is not null) then sum(c.floor * (i->>'quantity')::integer)::bigint end, coalesce(v_vat, 0)) end
        into v_profit
        from jsonb_array_elements(coalesce(r->'items', '[]'::jsonb)) i
        left join lateral (select public.taager_minor(t.financials->'originalPrice', v_digits) as cost, public.taager_minor(t.financials->'price', v_digits) as floor
                             from public.taager_catalog t where t.market = p_store and t.sku = i->>'sku' order by t.synced_at desc limit 1) c on true;
      insert into public.order_tracking(store_code, woo_order_id, order_number, status, raw_status, reason, reason_bucket, placed_at, modified_at,
          confirmed_at, shipped_at, closed_at, total_minor, delivery_minor, items, source, medium, campaign, paid_click, phone_hash, profit_minor)
      values (p_store, (r->>'woo_order_id')::bigint, left(r->>'order_number', 40), v_status, left(coalesce(r->>'raw_status', ''), 80), left(r->>'reason', 300), r->>'reason_bucket',
          (r->>'placed_at')::timestamptz, v_modified,
          case when v_status in ('confirmed','shipped','delivered','refused','returned') then v_modified end,
          case when v_status in ('shipped','delivered','refused','returned') then v_modified end,
          case when v_status in ('delivered','refused','returned','unreachable','cancelled') then v_modified end,
          coalesce((r->>'total_minor')::bigint, 0), coalesce((r->>'delivery_minor')::bigint, 0), coalesce(r->'items', '[]'::jsonb),
          left(r->'source'->>'source', 60), left(r->'source'->>'medium', 40), left(r->'source'->>'campaign', 80), left(r->'source'->>'paid_click', 20), r->>'phone_hash', v_profit);
      n_new := n_new + 1;
    elsif v_modified > v_old.modified_at or (v_modified = v_old.modified_at and v_status <> v_old.status) then
      update public.order_tracking o set status = v_status, raw_status = left(coalesce(r->>'raw_status', ''), 80),
          reason = coalesce(left(r->>'reason', 300), o.reason), reason_bucket = coalesce(r->>'reason_bucket', o.reason_bucket), modified_at = v_modified,
          confirmed_at = coalesce(o.confirmed_at, case when v_status in ('confirmed','shipped','delivered','refused','returned') then v_modified end),
          shipped_at = coalesce(o.shipped_at, case when v_status in ('shipped','delivered','refused','returned') then v_modified end),
          closed_at = case when v_status in ('delivered','refused','returned','unreachable','cancelled') then coalesce(o.closed_at, v_modified) end,
          phone_hash = coalesce(o.phone_hash, r->>'phone_hash'), updated_at = now()
       where o.store_code = p_store and o.woo_order_id = v_old.woo_order_id;
      if v_status <> v_old.status then n_changed := n_changed + 1; end if;
    end if;
  end loop;
  return jsonb_build_object('new', n_new, 'status_changed', n_changed);
end $$;

-- Service role: PostHog's aggregates for one day (counts per product slug and per source; unknown slugs are dropped).
create function public.scorecard_write_funnel(p_store text, p_day date, p_products jsonb, p_sources jsonb, p_searches jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare n_p integer; n_s integer;
begin
  insert into public.product_scorecard_daily as d (store_code, day, listing_id, list_impressions, list_clicks, views, scroll_75, add_to_cart)
  select p_store, p_day, l.id, sum(coalesce((x->>'list_impressions')::integer, 0)), sum(coalesce((x->>'list_clicks')::integer, 0)), sum(coalesce((x->>'views')::integer, 0)),
         sum(coalesce((x->>'scroll_75')::integer, 0)), sum(coalesce((x->>'add_to_cart')::integer, 0))
    from jsonb_array_elements(coalesce(p_products, '[]'::jsonb)) x
    join public.country_listings l on l.store_code = p_store and l.slug = x->>'slug'
   group by l.id
  on conflict (store_code, day, listing_id) do update set list_impressions = excluded.list_impressions, list_clicks = excluded.list_clicks, views = excluded.views,
     scroll_75 = excluded.scroll_75, add_to_cart = excluded.add_to_cart, updated_at = now();
  get diagnostics n_p = row_count;
  insert into public.source_scorecard_daily as d (store_code, day, source, medium, campaign, visits, product_views, add_to_cart, checkout_starts)
  select p_store, p_day, coalesce(nullif(left(x->>'source', 60), ''), 'direct'), left(coalesce(x->>'medium', ''), 40), left(coalesce(x->>'campaign', ''), 80),
         sum(coalesce((x->>'visits')::integer, 0)), sum(coalesce((x->>'product_views')::integer, 0)), sum(coalesce((x->>'add_to_cart')::integer, 0)), sum(coalesce((x->>'checkout_starts')::integer, 0))
    from jsonb_array_elements(coalesce(p_sources, '[]'::jsonb)) x group by 3, 4, 5
  on conflict (store_code, day, source, medium, campaign) do update set visits = excluded.visits, product_views = excluded.product_views, add_to_cart = excluded.add_to_cart,
     checkout_starts = excluded.checkout_starts, updated_at = now();
  get diagnostics n_s = row_count;
  delete from public.search_gaps_daily where store_code = p_store and day = p_day;
  insert into public.search_gaps_daily(store_code, day, query, searches)
  select p_store, p_day, left(x->>'query', 80), sum((x->>'searches')::integer)
    from jsonb_array_elements(coalesce(p_searches, '[]'::jsonb)) x where length(x->>'query') >= 2 and (x->>'searches')::integer > 0 group by 3;
  return jsonb_build_object('products', n_p, 'sources', n_s);
end $$;

-- Service role: recompute the order columns of both scorecards from order_tracking for every day from p_from on.
-- A day is the day the order was PLACED (UTC): an order placed on Monday and refused on Thursday counts against Monday.
create function public.scorecard_rollup_orders(p_store text, p_from date) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare n_p integer; n_s integer;
begin
  update public.product_scorecard_daily set orders = 0, confirmed = 0, shipped = 0, delivered = 0, refused = 0, returned = 0, unreachable = 0, cancelled = 0,
         profit_delivered_minor = 0, refusal_reasons = '{}'::jsonb where store_code = p_store and day >= p_from;
  with lines as (
    select o.woo_order_id, (o.placed_at at time zone 'utc')::date as day, o.status, o.reason_bucket, o.profit_minor, b.listing_id,
           (i->>'total_minor')::numeric as line_total,
           sum((i->>'total_minor')::numeric) over (partition by o.woo_order_id) as order_total
      from public.order_tracking o, jsonb_array_elements(o.items) i
      join public.brain_listings b on b.store_code = p_store and b.sku = i->>'sku'
     where o.store_code = p_store and o.placed_at >= p_from::timestamptz
  ), per as (
    select day, listing_id, count(distinct woo_order_id) as orders,
           count(distinct woo_order_id) filter (where status = 'confirmed') as confirmed, count(distinct woo_order_id) filter (where status = 'shipped') as shipped,
           count(distinct woo_order_id) filter (where status = 'delivered') as delivered, count(distinct woo_order_id) filter (where status = 'refused') as refused,
           count(distinct woo_order_id) filter (where status = 'returned') as returned, count(distinct woo_order_id) filter (where status = 'unreachable') as unreachable,
           count(distinct woo_order_id) filter (where status = 'cancelled') as cancelled,
           coalesce(sum(case when status = 'delivered' and profit_minor is not null and order_total > 0 then profit_minor * line_total / order_total end), 0)::bigint as profit
      from lines group by day, listing_id
  ), why as (
    select day, listing_id, jsonb_object_agg(reason_bucket, n) as reasons
      from (select day, listing_id, reason_bucket, count(distinct woo_order_id) as n from lines
             where status in ('refused','returned','unreachable','cancelled') and reason_bucket is not null group by 1, 2, 3) z group by day, listing_id
  )
  insert into public.product_scorecard_daily as d (store_code, day, listing_id, orders, confirmed, shipped, delivered, refused, returned, unreachable, cancelled, profit_delivered_minor, refusal_reasons)
  select p_store, per.day, per.listing_id, per.orders, per.confirmed, per.shipped, per.delivered, per.refused, per.returned, per.unreachable, per.cancelled, per.profit, coalesce(why.reasons, '{}'::jsonb)
    from per left join why using (day, listing_id)
  on conflict (store_code, day, listing_id) do update set orders = excluded.orders, confirmed = excluded.confirmed, shipped = excluded.shipped, delivered = excluded.delivered,
     refused = excluded.refused, returned = excluded.returned, unreachable = excluded.unreachable, cancelled = excluded.cancelled,
     profit_delivered_minor = excluded.profit_delivered_minor, refusal_reasons = excluded.refusal_reasons, updated_at = now();
  get diagnostics n_p = row_count;
  update public.source_scorecard_daily set orders = 0, delivered = 0, undelivered = 0, profit_delivered_minor = 0 where store_code = p_store and day >= p_from;
  insert into public.source_scorecard_daily as d (store_code, day, source, medium, campaign, orders, delivered, undelivered, profit_delivered_minor)
  select p_store, (o.placed_at at time zone 'utc')::date, coalesce(nullif(o.source, ''), 'direct'), coalesce(o.medium, ''), coalesce(o.campaign, ''), count(*),
         count(*) filter (where o.status = 'delivered'), count(*) filter (where o.status in ('refused','returned','unreachable')),
         coalesce(sum(o.profit_minor) filter (where o.status = 'delivered'), 0)::bigint
    from public.order_tracking o where o.store_code = p_store and o.placed_at >= p_from::timestamptz group by 2, 3, 4, 5
  on conflict (store_code, day, source, medium, campaign) do update set orders = excluded.orders, delivered = excluded.delivered, undelivered = excluded.undelivered,
     profit_delivered_minor = excluded.profit_delivered_minor, updated_at = now();
  get diagnostics n_s = row_count;
  return jsonb_build_object('product_days', n_p, 'source_days', n_s);
end $$;
revoke all on function public.order_tracking_upsert(text, jsonb), public.scorecard_write_funnel(text, date, jsonb, jsonb, jsonb), public.scorecard_rollup_orders(text, date) from public, anon, authenticated;
grant execute on function public.order_tracking_upsert(text, jsonb), public.scorecard_write_funnel(text, date, jsonb, jsonb, jsonb), public.scorecard_rollup_orders(text, date) to service_role;

-- Totals per product and per source over the last p_days days, with price position against other shops (private).
create function public.scorecard_window(p_store text, p_days integer)
returns table(listing_id uuid, slug text, title text, visible boolean, hidden_reason text, price_minor bigint, cost_minor bigint, floor_minor bigint,
              cheapest_minor bigint, median_minor bigint, counts jsonb)
language sql stable security definer set search_path = '' as $$
  select st.listing_id, st.slug, st.title, st.hidden_reason is null, st.hidden_reason, st.price_minor,
         public.taager_minor(t.financials->'originalPrice', s.minor_digits), public.taager_minor(t.financials->'price', s.minor_digits),
         c.cheapest_minor, c.median_minor,
         jsonb_build_object('list_impressions', coalesce(a.list_impressions, 0), 'list_clicks', coalesce(a.list_clicks, 0), 'views', coalesce(a.views, 0), 'scroll_75', coalesce(a.scroll_75, 0),
           'add_to_cart', coalesce(a.add_to_cart, 0), 'checkout_starts', coalesce(a.checkout_starts, 0), 'orders', coalesce(a.orders, 0), 'confirmed', coalesce(a.confirmed, 0),
           'shipped', coalesce(a.shipped, 0), 'delivered', coalesce(a.delivered, 0), 'refused', coalesce(a.refused, 0), 'returned', coalesce(a.returned, 0),
           'unreachable', coalesce(a.unreachable, 0), 'cancelled', coalesce(a.cancelled, 0), 'profit_delivered_minor', coalesce(a.profit, 0), 'refusal_reasons', coalesce(a.reasons, '{}'::jsonb))
    from public.brain_listing_state(p_store) st
    join public.stores s on s.code = p_store
    left join public.taager_catalog t on (t.market, t.sku) = (p_store, st.sku)
    left join public.market_research_cache c on (c.store_code, c.sku) = (p_store, st.sku)
    left join lateral (
      select sum(d.list_impressions) as list_impressions, sum(d.list_clicks) as list_clicks, sum(d.views) as views, sum(d.scroll_75) as scroll_75, sum(d.add_to_cart) as add_to_cart,
             sum(d.checkout_starts) as checkout_starts, sum(d.orders) as orders, sum(d.confirmed) as confirmed, sum(d.shipped) as shipped, sum(d.delivered) as delivered,
             sum(d.refused) as refused, sum(d.returned) as returned, sum(d.unreachable) as unreachable, sum(d.cancelled) as cancelled, sum(d.profit_delivered_minor) as profit,
             (select jsonb_object_agg(k, v) from (select e.key as k, sum(e.value::integer) as v from public.product_scorecard_daily d2, jsonb_each_text(d2.refusal_reasons) e
                where (d2.store_code, d2.listing_id) = (p_store, st.listing_id) and d2.day > current_date - p_days group by e.key) z) as reasons
        from public.product_scorecard_daily d where (d.store_code, d.listing_id) = (p_store, st.listing_id) and d.day > current_date - p_days) a on true
$$;
revoke all on function public.scorecard_window(text, integer) from public, anon, authenticated;
grant execute on function public.scorecard_window(text, integer) to service_role;

-- Owner: the scorecards behind the morning brief (product and source totals for the window, searches with no result).
create function public.brain_scorecards(p_store text, p_days integer default 14) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_days not between 1 and 90 then raise exception 'invalid_days' using errcode = '22023'; end if;
  return jsonb_build_object('days', p_days,
    'per_usd', (select per_usd from public.store_commerce_facts where store_code = p_store),
    'minor_digits', (select minor_digits from public.stores where code = p_store),
    'products', coalesce((select jsonb_agg(to_jsonb(w) order by (w.counts->>'views')::bigint desc, w.slug) from public.scorecard_window(p_store, p_days) w), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(to_jsonb(x) order by x.visits desc) from (
        select source, medium, campaign, sum(visits) as visits, sum(product_views) as product_views, sum(add_to_cart) as add_to_cart, sum(checkout_starts) as checkout_starts,
               sum(orders) as orders, sum(delivered) as delivered, sum(undelivered) as undelivered, sum(profit_delivered_minor) as profit_delivered_minor
          from public.source_scorecard_daily where store_code = p_store and day > current_date - p_days group by 1, 2, 3) x), '[]'::jsonb),
    'search_gaps', coalesce((select jsonb_agg(to_jsonb(g) order by g.searches desc) from (
        select query, sum(searches) as searches from public.search_gaps_daily where store_code = p_store and day > current_date - p_days group by 1 order by 2 desc limit 30) g), '[]'::jsonb),
    'orders', (select jsonb_build_object('placed', count(*), 'delivered', count(*) filter (where status = 'delivered'), 'refused', count(*) filter (where status = 'refused'),
        'returned', count(*) filter (where status = 'returned'), 'unreachable', count(*) filter (where status = 'unreachable'), 'cancelled', count(*) filter (where status = 'cancelled'),
        'open', count(*) filter (where status in ('placed','confirmed','shipped')), 'unknown_status', count(*) filter (where status = 'unknown'),
        'profit_delivered_minor', coalesce(sum(profit_minor) filter (where status = 'delivered'), 0))
        from public.order_tracking where store_code = p_store and placed_at > now() - make_interval(days => p_days)),
    'order_sync', (select to_jsonb(y) - 'store_code' from public.order_sync_state y where y.store_code = p_store));
end $$;
revoke all on function public.brain_scorecards(text, integer) from public, anon;
grant execute on function public.brain_scorecards(text, integer) to authenticated;
