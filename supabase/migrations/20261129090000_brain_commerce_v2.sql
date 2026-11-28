-- Brain commerce v2 (29 Nov 2026): Taager's quantity / add-on / sale prices, stock history, and a complete
-- free-delivery system. Everything a visitor can see is still owner-approved and re-checked on every read.
--
--   * store_commerce_facts.taager_discounts_proven: one owner switch per market. OFF (default): every offer must be
--     profitable at the FULL Taager cost of every piece. ON (only after G1 proved Taager applies its quantity and
--     add-on prices to our WooCommerce orders): Taager's own price is used. Both figures are always reported.
--   * taager_stock_history: one reading per SKU when its stock bucket changes (demand signal across syncs).
--   * store_offers gains kinds 'sale' (time-limited price tied to a Taager sale's real end date) and
--     'delivery_included' (single product whose price carries the delivery fee), plus start / end dates.
--   * Free delivery: a basket threshold counted over ELIGIBLE products only. A product is eligible while its own
--     margin at Taager's current cost is at least the rule's minimum margin, so no eligible basket can lose money;
--     thin products are excluded and marked, automatically, on every read.
--   * Sets may hold 2-4 pieces (brain-made themed bundles) with a theme and tagline.
--   * Picture rule: the brain's picture order (clean pictures first, promo artwork dropped) is applied at publish.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Owner switch per market
alter table public.store_commerce_facts
  add column taager_discounts_proven boolean not null default false,
  -- Smallest profit a free-delivery order must keep after we pay the fee (about US$1), in minor units.
  add column free_delivery_keep_minor bigint not null default 0 check (free_delivery_keep_minor >= 0);
update public.store_commerce_facts set free_delivery_keep_minor = round(per_usd * power(10::numeric, (select minor_digits from public.stores s where s.code = store_code)))::bigint;

create table public.store_commerce_facts_log (
  id bigint generated always as identity primary key,
  store_code text not null references public.stores(code),
  field text not null, value text not null,
  changed_by uuid, changed_at timestamptz not null default now()
);
alter table public.store_commerce_facts_log enable row level security;
revoke all on public.store_commerce_facts_log from public, anon, authenticated;

create function public.brain_set_discounts_proven(p_store text, p_proven boolean) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.store_commerce_facts set taager_discounts_proven = coalesce(p_proven, false) where store_code = p_store;
  if not found then raise exception 'unknown_store' using errcode = '22023'; end if;
  insert into public.store_commerce_facts_log(store_code, field, value, changed_by) values (p_store, 'taager_discounts_proven', coalesce(p_proven, false)::text, auth.uid());
  return coalesce(p_proven, false);
end $$;
revoke all on function public.brain_set_discounts_proven(text, boolean) from public, anon;
grant execute on function public.brain_set_discounts_proven(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Stock history (sales-velocity signal): one row when a SKU's stock bucket changes, or once a day at most.
create function public.taager_stock_low(p_bucket text) returns integer
language sql immutable set search_path = '' as $$
  select case
    when p_bucket ~ '^from_[0-9]+_to_[0-9]+$' then substring(p_bucket from '^from_([0-9]+)_to_')::integer
    when p_bucket ~ '^less_than_[0-9]+$' then 0
    when p_bucket ~ '^(more_than|above)_[0-9]+$' then substring(p_bucket from '_([0-9]+)$')::integer
    when p_bucket = 'not_available' then 0 end
$$;
create table public.taager_stock_history (
  market text not null check (market in ('sa','ae','om','eg','iq')),
  sku text not null,
  observed_at timestamptz not null default now(),
  stock_bucket text not null,
  stock_low integer not null,
  primary key (market, sku, observed_at)
);
create index taager_stock_history_time_idx on public.taager_stock_history (market, observed_at);
alter table public.taager_stock_history enable row level security;
revoke all on public.taager_stock_history from public, anon, authenticated;

create function public.taager_record_stock() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_bucket text := new.listing->'stockAvailability'->>'stockBucket'; v_low integer; v_last record;
begin
  v_low := public.taager_stock_low(v_bucket);
  if v_low is null then return new; end if;
  select h.stock_bucket, h.observed_at into v_last from public.taager_stock_history h
   where h.market = new.market and h.sku = new.sku order by h.observed_at desc limit 1;
  if v_last.stock_bucket is null or v_last.stock_bucket <> v_bucket or v_last.observed_at < now() - interval '20 hours' then
    insert into public.taager_stock_history(market, sku, observed_at, stock_bucket, stock_low)
      values (new.market, new.sku, clock_timestamp(), v_bucket, v_low) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger taager_catalog_stock_history after insert or update of listing on public.taager_catalog
  for each row execute function public.taager_record_stock();
create function public.taager_trim_stock_history() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.taager_stock_history where observed_at < now() - interval '90 days';
  return null;
end $$;
create trigger taager_sync_batches_trim after insert on public.taager_sync_batches
  for each statement execute function public.taager_trim_stock_history();
revoke all on function public.taager_stock_low(text), public.taager_record_stock(), public.taager_trim_stock_history() from public, anon, authenticated;

-- Pieces per day leaving the supplier's stock in the last 14 days (rises = restocks are ignored; needs 2 readings a day apart).
create function public.taager_stock_velocity(p_store text)
returns table(sku text, per_day numeric)
language sql stable security definer set search_path = '' as $$
  with h as (
    select x.sku, x.observed_at, x.stock_low, lag(x.stock_low) over (partition by x.sku order by x.observed_at) as prev
    from public.taager_stock_history x where x.market = p_store and x.observed_at > now() - interval '14 days'
  )
  select h.sku, round(sum(greatest(coalesce(h.prev, h.stock_low) - h.stock_low, 0)) / (extract(epoch from max(h.observed_at) - min(h.observed_at)) / 86400.0), 2)
  from h group by h.sku having max(h.observed_at) - min(h.observed_at) >= interval '1 day'
$$;
revoke all on function public.taager_stock_velocity(text) from public, anon, authenticated;

alter table public.brain_cost_ledger drop constraint brain_cost_ledger_step_check;
alter table public.brain_cost_ledger add constraint brain_cost_ledger_step_check check (step in ('field_mapping','research','content','pictures','other'));

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Taager's own quantity, add-on and sale prices (private helpers)
create function public.taager_tiers(p_financials jsonb, p_digits smallint) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('quantity', x.q, 'price_minor', x.price, 'cost_minor', x.price - x.profit) order by x.q), '[]'::jsonb)
  from (
    select (t->>'quantity')::numeric::integer as q, public.taager_minor(t->'price', p_digits) as price,
           round((t->>'profit')::numeric * power(10::numeric, p_digits))::bigint as profit
    from jsonb_array_elements(case when jsonb_typeof(p_financials->'tieredPricing') = 'array' then p_financials->'tieredPricing' else '[]'::jsonb end) t
    where jsonb_typeof(t->'quantity') = 'number' and jsonb_typeof(t->'profit') = 'number' and jsonb_typeof(t->'price') = 'number'
  ) x
  where x.q between 2 and 10 and x.price is not null and x.profit >= 0 and x.price - x.profit > 0
$$;
-- One discount of the given type from the detailed financials: {price_minor, cost_minor, starts_at, expires_at}. Taager times are UTC.
create function public.taager_discount(p_detail jsonb, p_type text, p_digits smallint) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('price_minor', public.taager_minor(d->'price', p_digits),
           'cost_minor', public.taager_minor(d->'price', p_digits) - round((d->>'profit')::numeric * power(10::numeric, p_digits))::bigint,
           'starts_at', d->>'startsAt', 'expires_at', d->>'expiresAt')
  from jsonb_array_elements(case when jsonb_typeof(p_detail->'variant'->'financials'->'discounts') = 'array'
                                 then p_detail->'variant'->'financials'->'discounts' else '[]'::jsonb end) d
  where d->>'type' = p_type and jsonb_typeof(d->'profit') = 'number' and (d->>'profit')::numeric >= 0
    and public.taager_minor(d->'price', p_digits) - round((d->>'profit')::numeric * power(10::numeric, p_digits))::bigint > 0
  limit 1
$$;
create function public.taager_utc(p_text text) returns timestamptz
language sql immutable set search_path = '' as $$
  select case when p_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?$' then (p_text || 'Z')::timestamptz
              when p_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:?[0-9]{2})$' then p_text::timestamptz end
$$;
revoke all on function public.taager_tiers(jsonb, smallint), public.taager_discount(jsonb, text, smallint), public.taager_utc(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Offers table: new kinds, dates, meta; the listing price's start time (for honest "was" prices)
alter table public.store_offers drop constraint store_offers_kind_check;
alter table public.store_offers add constraint store_offers_kind_check check (kind in ('quantity', 'bundle', 'free_delivery', 'sale', 'delivery_included'));
alter table public.store_offers
  add column starts_at timestamptz,
  add column ends_at timestamptz,
  add column meta jsonb not null default '{}'::jsonb,
  add constraint store_offers_dates_check check (ends_at is null or starts_at is null or ends_at > starts_at),
  add constraint store_offers_sale_check check (kind <> 'sale' or (listing_id is not null and ends_at is not null)),
  add constraint store_offers_included_check check (kind <> 'delivery_included' or listing_id is not null);
create unique index store_offers_sale_key on public.store_offers(store_code, listing_id) where kind = 'sale';
create unique index store_offers_included_key on public.store_offers(store_code, listing_id) where kind = 'delivery_included';

alter table public.brain_listings add column price_since timestamptz not null default now();
update public.brain_listings set price_since = published_at;
create function public.brain_listing_price_since() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.price_minor is distinct from old.price_minor then new.price_since := now(); end if;
  return new;
end $$;
create trigger brain_listings_price_since before update of price_minor on public.brain_listings
  for each row execute function public.brain_listing_price_since();

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Listing costs with Taager's quantity / add-on / sale figures (private)
drop function public.brain_offer_inputs(text);
drop function public.store_offer_state(text) cascade;
drop function public.store_listing_costs(text);
create function public.store_listing_costs(p_store text)
returns table(listing_id uuid, slug text, title text, price_minor bigint, cost_minor bigint, floor_minor bigint,
              category text, image text, visible boolean, is_bundle boolean, score numeric, quantity_offers jsonb,
              sku text, tiers jsonb, addon jsonb, sale jsonb, price_since timestamptz, positioning text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select st.listing_id, st.slug, st.title, st.price_minor,
         public.taager_minor(t.financials->'originalPrice', s.minor_digits),
         public.taager_minor(t.financials->'price', s.minor_digits),
         st.category, st.image, st.hidden_reason is null,
         jsonb_array_length(coalesce(b.extras->'bundle', '[]'::jsonb)) > 0 or coalesce(t.item_type, '') = 'bundle',
         a.score, coalesce(b.extras->'quantity_offers', '[]'::jsonb),
         b.sku, public.taager_tiers(t.financials, s.minor_digits),
         public.taager_discount(t.detail, 'second_placement', s.minor_digits),
         (select d from (select public.taager_discount(t.detail, 'sale', s.minor_digits) as d) x
           where (public.taager_utc(x.d->>'starts_at') is null or public.taager_utc(x.d->>'starts_at') <= now())
             and (x.d->>'expires_at' is null or public.taager_utc(x.d->>'expires_at') > now())),
         b.price_since, a.decision->>'positioning', public.taager_utc(t.listing->>'createdAt')
  from public.brain_listing_state(p_store) st
  join public.stores s on s.code = p_store
  join public.brain_listings b on (b.store_code, b.listing_id) = (p_store, st.listing_id)
  left join public.taager_catalog t on (t.market, t.sku) = (p_store, st.sku)
  left join public.brain_product_analysis a
    on (a.run_id, a.store_code, a.product_id, a.variation_id) = (b.run_id, p_store, b.taager_product_id, b.taager_variant_id)
$$;

-- Current state of every offer. profit_minor is the figure the never-a-loss rule uses: FULL cost unless the market's
-- Taager discounts are proven. profit_full_minor / profit_taager_minor are both always reported to the owner.
create function public.store_offer_state(p_store text)
returns table(id uuid, kind text, status text, listing_id uuid, quantity integer, price_minor bigint, slug text, title text,
              items jsonb, profit_minor bigint, profit_if_split_minor bigint, separate_minor bigint, problem text, detail text,
              profit_full_minor bigint, profit_taager_minor bigint, starts_at timestamptz, ends_at timestamptz, meta jsonb,
              free_delivery_eligible boolean, was_price_minor bigint)
language sql stable security definer set search_path = '' as $$
  with f as (select * from public.store_commerce_facts where store_code = p_store),
  c as (select * from public.store_listing_costs(p_store)),
  timing as (
    select o.id, case when o.starts_at is not null and o.starts_at > now() then 'not_started'
                      when o.ends_at is not null and o.ends_at <= now() then 'ended' end as problem
    from public.store_offers o where o.store_code = p_store
  ),
  -- ---- quantity offers
  q0 as (
    select o.*, coalesce(o.title, c.title) as shown_title, c.listing_id as found, c.visible, c.cost_minor as unit_cost, c.price_minor as unit_price, c.floor_minor as unit_floor,
           public.store_profit(o.price_minor, o.quantity * c.cost_minor, null::bigint, f.vat_added_profit_bps) as p_full,
           (select public.store_profit(o.price_minor, (x->>'cost_minor')::bigint, (x->>'price_minor')::bigint, f.vat_added_profit_bps)
              from jsonb_array_elements(c.tiers) x
             where (x->>'quantity')::integer = o.quantity and (x->>'cost_minor')::bigint < o.quantity * c.cost_minor limit 1) as p_tier,
           f.taager_discounts_proven as proven, f.vat_added_profit_bps as vat
    from public.store_offers o cross join f left join c on c.listing_id = o.listing_id
    where o.store_code = p_store and o.kind = 'quantity'
  ),
  q as (
    select q0.id, q0.kind, q0.status, q0.listing_id, q0.quantity, q0.price_minor, q0.slug, q0.shown_title as title, q0.items,
           case when q0.proven then coalesce(q0.p_tier, q0.p_full) else q0.p_full end as profit,
           null::bigint as split, q0.quantity * q0.unit_price as separate,
           coalesce(t.problem,
             case when q0.found is null or not q0.visible then 'product_not_shown'
                  when q0.unit_cost is null then 'no_supplier_cost'
                  when q0.price_minor >= q0.quantity * q0.unit_price then 'not_cheaper_than_singles'
                  when (case when q0.proven then coalesce(q0.p_tier, q0.p_full) else q0.p_full end) <= 0 then 'loss'
                  when (case when q0.proven then coalesce(q0.p_tier, q0.p_full) else q0.p_full end)
                       < public.store_profit(q0.unit_price, q0.unit_cost, q0.unit_floor, q0.vat) then 'earns_less_than_one_single'
             end) as problem, null::text as detail,
           q0.p_full as p_full, coalesce(q0.p_tier, q0.p_full) as p_taager, q0.starts_at, q0.ends_at, q0.meta
    from q0 join timing t on t.id = q0.id
  ),
  -- ---- sets (2-4 pieces)
  parts as (
    select o.id, (i.value->>'listing_id')::uuid as part_id, greatest((i.value->>'quantity')::integer, 1) as n
    from public.store_offers o, jsonb_array_elements(o.items) i
    where o.store_code = p_store and o.kind = 'bundle'
  ),
  agg as (
    select p.id, count(*) as pieces, count(c.listing_id) as found,
           bool_and(coalesce(c.visible, false)) as all_visible, bool_or(coalesce(c.is_bundle, false)) as has_supplier_bundle,
           bool_or(c.cost_minor is null) as cost_missing,
           sum(p.n * c.cost_minor)::bigint as cost, sum(p.n * c.price_minor)::bigint as separate,
           count(distinct p.part_id) as distinct_parts,
           -- If Taager applies its add-on price: every piece with one counts at it, except one piece that stays the "first" product.
           (sum(p.n * greatest(c.cost_minor - coalesce((c.addon->>'cost_minor')::bigint, c.cost_minor), 0))
             - case when bool_and(coalesce((c.addon->>'cost_minor')::bigint, c.cost_minor) < c.cost_minor)
                    then min(p.n * greatest(c.cost_minor - coalesce((c.addon->>'cost_minor')::bigint, c.cost_minor), 0)) else 0 end)::bigint as addon_saving
    from parts p left join c on c.listing_id = p.part_id group by p.id
  ),
  b0 as (
    select o.*, a.id as agg_id, a.pieces, a.found, a.all_visible, a.distinct_parts, a.has_supplier_bundle, a.cost_missing, a.separate,
           public.store_profit(o.price_minor, a.cost, null::bigint, f.vat_added_profit_bps) as p_full,
           public.store_profit(o.price_minor, a.cost - coalesce(a.addon_saving, 0), null::bigint, f.vat_added_profit_bps) as p_taager,
           f.taager_discounts_proven as proven, f.delivery_fee_minor as fee
    from public.store_offers o cross join f left join agg a on a.id = o.id
    where o.store_code = p_store and o.kind = 'bundle'
  ),
  b as (
    select b0.id, b0.kind, b0.status, b0.listing_id, b0.quantity, b0.price_minor, b0.slug, b0.title, b0.items,
           case when b0.proven then b0.p_taager else b0.p_full end as profit,
           (case when b0.proven then b0.p_taager else b0.p_full end) - b0.fee as split, b0.separate,
           coalesce(t.problem,
             case when b0.agg_id is null or b0.found < b0.pieces or not b0.all_visible then 'piece_not_shown'
                  when b0.pieces > 4 then 'too_many_pieces'
                  when b0.distinct_parts < b0.pieces then 'repeated_piece'
                  when b0.has_supplier_bundle then 'piece_is_supplier_bundle'
                  when b0.cost_missing then 'no_supplier_cost'
                  when b0.price_minor >= b0.separate then 'not_cheaper_than_singles'
                  when (case when b0.proven then b0.p_taager else b0.p_full end) <= 0 then 'loss'
                  when (case when b0.proven then b0.p_taager else b0.p_full end) - b0.fee <= 0 then 'loss_if_two_parcels'
             end) as problem, null::text as detail,
           b0.p_full, b0.p_taager, b0.starts_at, b0.ends_at, b0.meta
    from b0 join timing t on t.id = b0.id
  ),
  -- ---- time-limited sale prices (tied to the supplier sale's real end date, 3 days of safety)
  s0 as (
    select o.*, c.listing_id as found, c.visible, c.title as c_title, c.cost_minor as unit_cost, c.floor_minor as unit_floor, c.price_minor as unit_price, c.sale, c.price_since,
           public.store_profit(o.price_minor, c.cost_minor, c.floor_minor, f.vat_added_profit_bps) as p_full,
           public.store_profit(o.price_minor, coalesce((c.sale->>'cost_minor')::bigint, c.cost_minor), coalesce((c.sale->>'price_minor')::bigint, c.floor_minor), f.vat_added_profit_bps) as p_taager,
           f.taager_discounts_proven as proven
    from public.store_offers o cross join f left join c on c.listing_id = o.listing_id
    where o.store_code = p_store and o.kind = 'sale'
  ),
  s as (
    select s0.id, s0.kind, s0.status, s0.listing_id, s0.quantity, s0.price_minor, s0.slug, coalesce(s0.title, s0.c_title) as title, s0.items,
           case when s0.proven then s0.p_taager else s0.p_full end as profit, null::bigint as split, s0.unit_price as separate,
           coalesce(t.problem,
             case when s0.found is null or not s0.visible then 'product_not_shown'
                  when s0.unit_cost is null then 'no_supplier_cost'
                  when s0.price_minor >= s0.unit_price then 'not_cheaper_than_singles'
                  when s0.sale is null then 'supplier_sale_over'
                  when public.taager_utc(s0.sale->>'expires_at') is null or public.taager_utc(s0.sale->>'expires_at') < s0.ends_at + interval '3 days' then 'supplier_sale_ends_sooner'
                  when (case when s0.proven then s0.p_taager else s0.p_full end) <= 0 then 'loss'
             end) as problem, null::text as detail,
           s0.p_full, s0.p_taager, s0.starts_at, s0.ends_at, s0.meta,
           -- A crossed-out price is honest only if the product was on the visible store at that price for a day before the offer.
           case when s0.decided_at is not null and s0.price_since <= s0.decided_at - interval '1 day'
                 and exists (select 1 from public.catalog_release_log l where l.store_code = p_store and l.enabled and l.changed_at <= s0.decided_at - interval '1 day')
                then s0.unit_price end as was_price
    from s0 join timing t on t.id = s0.id
  ),
  live_sale as (select s.listing_id, s.price_minor, s.profit from s where s.status = 'approved' and s.problem is null),
  -- ---- delivery included in a single product's price (we pay the fee on every order of it)
  d as (
    select o.id, o.kind, o.status, o.listing_id, o.quantity, o.price_minor, o.slug, coalesce(o.title, c.title) as title, o.items,
           coalesce(ls.profit, public.store_profit(c.price_minor, c.cost_minor, c.floor_minor, f.vat_added_profit_bps)) - f.delivery_fee_minor as profit,
           null::bigint as split, null::bigint as separate,
           coalesce(t.problem,
             case when c.listing_id is null or not c.visible then 'product_not_shown'
                  when c.cost_minor is null then 'no_supplier_cost'
                  when o.price_minor <> c.price_minor then 'price_changed'
                  when coalesce(ls.profit, public.store_profit(c.price_minor, c.cost_minor, c.floor_minor, f.vat_added_profit_bps)) - f.delivery_fee_minor < f.free_delivery_keep_minor then 'loss_after_delivery'
             end) as problem, null::text as detail,
           coalesce(ls.profit, public.store_profit(c.price_minor, c.cost_minor, c.floor_minor, f.vat_added_profit_bps)) - f.delivery_fee_minor as p_full,
           coalesce(ls.profit, public.store_profit(c.price_minor, c.cost_minor, c.floor_minor, f.vat_added_profit_bps)) - f.delivery_fee_minor as p_taager,
           o.starts_at, o.ends_at, o.meta
    from public.store_offers o cross join f
    join timing t on t.id = o.id
    left join c on c.listing_id = o.listing_id
    left join live_sale ls on ls.listing_id = o.listing_id
    where o.store_code = p_store and o.kind = 'delivery_included'
  ),
  -- ---- free delivery above a basket of ELIGIBLE products
  singles as (
    select c.listing_id, c.title, coalesce(ls.price_minor, c.price_minor) as price,
           coalesce(ls.profit, public.store_profit(c.price_minor, c.cost_minor, c.floor_minor, f.vat_added_profit_bps)) as profit
    from c cross join f left join live_sale ls on ls.listing_id = c.listing_id
    where c.visible and c.cost_minor is not null
  ),
  fd0 as (
    select o.*, coalesce(nullif(o.meta->>'min_margin_bps', '')::integer, 10000) as min_bps, f.delivery_fee_minor as fee, f.free_delivery_keep_minor as keep,
           (select count(*) from singles x where x.profit * 10000 >= coalesce(nullif(o.meta->>'min_margin_bps', '')::integer, 10000)::bigint * x.price) as eligible,
           (select count(*) from singles) as shown,
           (select x.title from singles x where x.profit * 10000 >= coalesce(nullif(o.meta->>'min_margin_bps', '')::integer, 10000)::bigint * x.price
             order by x.profit::numeric / x.price asc, x.title limit 1) as thinnest
    from public.store_offers o cross join f
    where o.store_code = p_store and o.kind = 'free_delivery'
  ),
  fd as (
    select fd0.id, fd0.kind, fd0.status, fd0.listing_id, fd0.quantity, fd0.price_minor, fd0.slug, fd0.title, fd0.items,
           (floor(fd0.price_minor::numeric * fd0.min_bps / 10000) - fd0.fee)::bigint as profit, null::bigint as split, null::bigint as separate,
           coalesce(t.problem,
             case when fd0.shown = 0 then 'no_products_shown'
                  when fd0.eligible = 0 then 'no_eligible_products'
                  when floor(fd0.price_minor::numeric * fd0.min_bps / 10000) - fd0.fee < fd0.keep then 'loss_on_thinnest_basket' end) as problem,
           fd0.thinnest || ' · ' || fd0.eligible || '/' || fd0.shown as detail,
           (floor(fd0.price_minor::numeric * fd0.min_bps / 10000) - fd0.fee)::bigint as p_full,
           (floor(fd0.price_minor::numeric * fd0.min_bps / 10000) - fd0.fee)::bigint as p_taager, fd0.starts_at, fd0.ends_at, fd0.meta
    from fd0 join timing t on t.id = fd0.id
  ),
  rule as (select coalesce(nullif(fd.meta->>'min_margin_bps', '')::integer, 10000) as min_bps from fd where fd.status = 'approved' and fd.problem is null limit 1)
  select q.id, q.kind, q.status, q.listing_id, q.quantity, q.price_minor, q.slug, q.title, q.items, q.profit, q.split, q.separate, q.problem, q.detail,
         q.p_full, q.p_taager, q.starts_at, q.ends_at, q.meta,
         coalesce((select q.profit * 10000 >= r.min_bps::bigint * q.price_minor from rule r), false), null::bigint from q
  union all
  select b.id, b.kind, b.status, b.listing_id, b.quantity, b.price_minor, b.slug, b.title, b.items, b.profit, b.split, b.separate, b.problem, b.detail,
         b.p_full, b.p_taager, b.starts_at, b.ends_at, b.meta,
         -- A set counts toward free delivery only if it still clears the margin after a possible second parcel.
         coalesce((select b.split * 10000 >= r.min_bps::bigint * b.price_minor from rule r), false), null::bigint from b
  union all
  select s.id, s.kind, s.status, s.listing_id, s.quantity, s.price_minor, s.slug, s.title, s.items, s.profit, s.split, s.separate, s.problem, s.detail,
         s.p_full, s.p_taager, s.starts_at, s.ends_at, s.meta,
         coalesce((select s.profit * 10000 >= r.min_bps::bigint * s.price_minor from rule r), false), s.was_price from s
  union all
  select d.id, d.kind, d.status, d.listing_id, d.quantity, d.price_minor, d.slug, d.title, d.items, d.profit, d.split, d.separate, d.problem, d.detail,
         d.p_full, d.p_taager, d.starts_at, d.ends_at, d.meta, false, null::bigint from d
  union all
  select fd.id, fd.kind, fd.status, fd.listing_id, fd.quantity, fd.price_minor, fd.slug, fd.title, fd.items, fd.profit, fd.split, fd.separate, fd.problem, fd.detail,
         fd.p_full, fd.p_taager, fd.starts_at, fd.ends_at, fd.meta, false, null::bigint from fd
$$;
revoke all on function public.store_listing_costs(text), public.store_offer_state(text) from public, anon, authenticated;

-- Per listing: what a visitor may be told right now (private; the public functions below expose only flags and prices).
create function public.store_listing_perks(p_store text)
returns table(listing_id uuid, sale_price_minor bigint, sale_ends_at timestamptz, was_price_minor bigint,
              free_delivery boolean, delivery_included boolean, is_new boolean, trending boolean)
language sql stable security definer set search_path = '' as $$
  with st as (select * from public.store_offer_state(p_store)),
  f as (select * from public.store_commerce_facts where store_code = p_store),
  c as (select * from public.store_listing_costs(p_store)),
  rule as (select coalesce(nullif(st.meta->>'min_margin_bps', '')::integer, 10000) as min_bps from st where st.kind = 'free_delivery' and st.status = 'approved' and st.problem is null limit 1),
  sale as (select st.listing_id, st.price_minor, st.ends_at, st.was_price_minor, st.profit_minor from st where st.kind = 'sale' and st.status = 'approved' and st.problem is null),
  v as (select x.sku, x.per_day, percent_rank() over (order by x.per_day) as pr from public.taager_stock_velocity(p_store) x where x.per_day > 0)
  select c.listing_id, sale.price_minor, sale.ends_at, sale.was_price_minor,
         coalesce((select coalesce(sale.profit_minor, public.store_profit(c.price_minor, c.cost_minor, c.floor_minor, f.vat_added_profit_bps)) * 10000
                          >= r.min_bps::bigint * coalesce(sale.price_minor, c.price_minor) from rule r), false),
         exists (select 1 from st where st.kind = 'delivery_included' and st.listing_id = c.listing_id and st.status = 'approved' and st.problem is null),
         coalesce(c.created_at > now() - interval '30 days', false),
         -- "In demand": top fifth of stock movement at the supplier, at least 3 pieces a day.
         coalesce(v.pr >= 0.8 and v.per_day >= 3, false)
  from c cross join f
  left join sale on sale.listing_id = c.listing_id
  left join v on v.sku = c.sku
  where c.visible and c.cost_minor is not null
$$;
revoke all on function public.store_listing_perks(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. PUBLIC: approved and currently safe offers only. No costs, no profit, no supplier identity.
create or replace function public.public_store_offers(p_store text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with st as (select * from public.store_offer_state(p_store) o where o.status = 'approved' and o.problem is null)
  select jsonb_build_object('market', p_store, 'release', 'owner_approved',
    'free_delivery', (select jsonb_build_object('threshold_minor', o.price_minor, 'ends_at', o.ends_at) from st o where o.kind = 'free_delivery' limit 1),
    'delivery_included', coalesce((select jsonb_agg(o.listing_id order by o.listing_id) from st o where o.kind = 'delivery_included'), '[]'::jsonb),
    'bundles', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'slug', o.slug, 'title', o.title, 'price_minor', o.price_minor,
                           'tagline', o.meta->>'tagline', 'theme', o.meta->>'theme', 'free_delivery', o.free_delivery_eligible, 'ends_at', o.ends_at,
                           'items', (select jsonb_agg(jsonb_build_object('listing_id', i.value->>'listing_id', 'quantity', greatest((i.value->>'quantity')::integer, 1)))
                                     from jsonb_array_elements(o.items) i)) order by o.slug)
                         from st o where o.kind = 'bundle'), '[]'::jsonb))
  where exists (select 1 from public.stores s where s.code = p_store and s.catalog_release_enabled)
$$;

create or replace function public.public_product_page(p_store text,p_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('listing_id',c.listing_id,'market',p_store,'release','public_approved',
   'category',b.category,'page',b.page,'images',b.media,
   'videos',coalesce(b.extras->'videos','[]'::jsonb),
   'bundle',coalesce(b.extras->'bundle','[]'::jsonb),
   'quantity_offers',coalesce((select jsonb_agg(jsonb_build_object('quantity',o.quantity,'price_minor',o.price_minor,'free_delivery',o.free_delivery_eligible) order by o.quantity)
      from public.store_offer_state(p_store) o
      where o.kind='quantity' and o.listing_id=c.listing_id and o.status='approved' and o.problem is null),'[]'::jsonb),
   'sale',case when k.sale_price_minor is not null then jsonb_build_object('price_minor',k.sale_price_minor,'ends_at',k.sale_ends_at,'was_price_minor',k.was_price_minor) end,
   'free_delivery',coalesce(k.free_delivery,false),'delivery_included',coalesce(k.delivery_included,false),
   'stock_signal',case when t.detail->'variant'->>'availability'='available_with_low_qty' then 'low' end)
 from public.current_catalog_release(p_store) c
 join public.brain_listings b on (b.store_code,b.listing_id)=(p_store,c.listing_id)
 left join public.taager_catalog t on (t.market,t.sku)=(b.store_code,b.sku)
 left join public.store_listing_perks(p_store) k on k.listing_id=c.listing_id
 where c.slug=p_slug limit 1
$$;

drop function public.public_catalog(text,integer,integer);
create function public.public_catalog(p_store text,p_limit integer default 50,p_offset integer default 0)
returns table(listing_id uuid,slug text,title text,price_minor text,currency text,approved_category_slugs text[],category_release text,image text,
              rank integer,kind text,offer boolean,sale_price_minor bigint,sale_ends_at timestamptz,was_price_minor bigint,
              free_delivery boolean,delivery_included boolean,is_new boolean,trending boolean)
language sql stable security definer set search_path='' as $$
 with shown as (
  select c.listing_id,c.slug,c.title,c.price_minor,c.currency,b.category,b.media->0->>'id' as image,
   -- The brain's order: its score, lifted by stock movement at the supplier (pieces a day, capped).
   (row_number() over (order by (a.score is null),a.score*(1+least(coalesce(v.per_day,0),20)/20*0.3) desc,c.slug))::integer as rank,
   case when jsonb_array_length(coalesce(b.extras->'bundle','[]'::jsonb))>0 then 'bundle' end as kind
  from public.current_catalog_release(p_store) c
  left join public.brain_listings b on (b.store_code,b.listing_id)=(p_store,c.listing_id)
  left join public.brain_product_analysis a on (a.run_id,a.store_code,a.product_id,a.variation_id)=(b.run_id,p_store,b.taager_product_id,b.taager_variant_id)
  left join public.taager_stock_velocity(p_store) v on v.sku=b.sku
 ), offered as (
  select distinct o.listing_id from public.store_offer_state(p_store) o where o.kind='quantity' and o.status='approved' and o.problem is null
 ), k as (select * from public.store_listing_perks(p_store))
 select s.listing_id,s.slug,s.title,s.price_minor,s.currency,
  case when s.category is null then '{}'::text[] else array[s.category] end,'owner_approved',s.image,
  s.rank,s.kind,exists(select 1 from offered f where f.listing_id=s.listing_id),
  k.sale_price_minor,k.sale_ends_at,k.was_price_minor,coalesce(k.free_delivery,false),coalesce(k.delivery_included,false),coalesce(k.is_new,false),coalesce(k.trending,false)
 from shown s left join k on k.listing_id=s.listing_id
 order by s.slug,s.listing_id limit least(greatest(coalesce(p_limit,50),1),100) offset least(greatest(coalesce(p_offset,0),0),10000)
$$;
revoke all on function public.public_catalog(text,integer,integer) from public;
grant execute on function public.public_catalog(text,integer,integer) to anon,authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. OWNER functions
create function public.brain_offer_inputs(p_store text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'facts', (select to_jsonb(f) - 'store_code' from public.store_commerce_facts f where f.store_code = p_store),
    'listings', coalesce((select jsonb_agg(jsonb_build_object('listing_id', c.listing_id, 'slug', c.slug, 'title', c.title, 'category', c.category,
        'price_minor', c.price_minor, 'cost_minor', c.cost_minor, 'floor_minor', c.floor_minor, 'image', c.image, 'is_bundle', c.is_bundle,
        'rank', c.rank, 'quantity_offers', c.quantity_offers, 'tiers', c.tiers, 'addon_cost_minor', (c.addon->>'cost_minor')::bigint,
        'sale', c.sale, 'positioning', c.positioning) order by c.rank)
      from (select x.*, row_number() over (order by (x.score is null), x.score desc, x.slug) as rank
            from public.store_listing_costs(p_store) x where x.visible and x.cost_minor is not null) c), '[]'::jsonb));
end $$;

create or replace function public.brain_offers_save(p_store text, p_proposals jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare p jsonb; v_kind text; v_price bigint; v_changed integer := 0; v_rows integer; v_starts timestamptz; v_ends timestamptz; v_meta jsonb;
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  if jsonb_typeof(p_proposals) <> 'array' or jsonb_array_length(p_proposals) > 400 then raise exception 'invalid_proposals' using errcode = '22023'; end if;
  for p in select * from jsonb_array_elements(p_proposals) loop
    v_kind := p->>'kind';
    if jsonb_typeof(p->'price_minor') <> 'number' then raise exception 'invalid_price' using errcode = '22023'; end if;
    v_price := (p->>'price_minor')::numeric::bigint;
    v_starts := nullif(p->>'starts_at', '')::timestamptz; v_ends := nullif(p->>'ends_at', '')::timestamptz;
    v_meta := case when jsonb_typeof(p->'meta') = 'object' then p->'meta' else '{}'::jsonb end;
    if v_kind = 'quantity' then
      insert into public.store_offers(store_code, kind, listing_id, quantity, price_minor)
        values (p_store, 'quantity', (p->>'listing_id')::uuid, (p->>'quantity')::integer, v_price)
      on conflict (store_code, listing_id, quantity) where kind = 'quantity' do update
        set price_minor = excluded.price_minor, status = 'proposed', proposed_at = now(), decided_by = null, decided_at = null
        where public.store_offers.price_minor <> excluded.price_minor;
    elsif v_kind = 'bundle' then
      insert into public.store_offers(store_code, kind, slug, title, items, price_minor, meta)
        values (p_store, 'bundle', p->>'slug', left(btrim(p->>'title'), 300),
                (select jsonb_agg(jsonb_build_object('listing_id', (i.value->>'listing_id')::uuid, 'quantity', (i.value->>'quantity')::integer)) from jsonb_array_elements(p->'items') i), v_price,
                jsonb_strip_nulls(jsonb_build_object('theme', left(v_meta->>'theme', 40), 'tagline', left(v_meta->>'tagline', 200))))
      on conflict (store_code, slug) where kind = 'bundle' do update
        set price_minor = excluded.price_minor, title = excluded.title, items = excluded.items, meta = excluded.meta, status = 'proposed', proposed_at = now(), decided_by = null, decided_at = null
        where public.store_offers.price_minor <> excluded.price_minor or public.store_offers.items <> excluded.items;
    elsif v_kind = 'free_delivery' then
      if coalesce((v_meta->>'min_margin_bps')::integer, 0) not between 1 and 10000 then raise exception 'invalid_min_margin' using errcode = '22023'; end if;
      insert into public.store_offers(store_code, kind, price_minor, starts_at, ends_at, meta)
        values (p_store, 'free_delivery', v_price, v_starts, v_ends, jsonb_build_object('min_margin_bps', (v_meta->>'min_margin_bps')::integer))
      on conflict (store_code) where kind = 'free_delivery' do update
        set price_minor = excluded.price_minor, starts_at = excluded.starts_at, ends_at = excluded.ends_at, meta = excluded.meta,
            status = 'proposed', proposed_at = now(), decided_by = null, decided_at = null
        where public.store_offers.price_minor <> excluded.price_minor or public.store_offers.meta <> excluded.meta
           or public.store_offers.starts_at is distinct from excluded.starts_at or public.store_offers.ends_at is distinct from excluded.ends_at;
    elsif v_kind = 'sale' then
      if v_ends is null or v_ends <= now() then raise exception 'sale_needs_a_future_end' using errcode = '22023'; end if;
      insert into public.store_offers(store_code, kind, listing_id, price_minor, ends_at)
        values (p_store, 'sale', (p->>'listing_id')::uuid, v_price, v_ends)
      on conflict (store_code, listing_id) where kind = 'sale' do update
        set price_minor = excluded.price_minor, ends_at = excluded.ends_at, starts_at = null, status = 'proposed', proposed_at = now(), decided_by = null, decided_at = null
        where public.store_offers.price_minor <> excluded.price_minor or public.store_offers.ends_at <> excluded.ends_at;
    elsif v_kind = 'delivery_included' then
      insert into public.store_offers(store_code, kind, listing_id, price_minor, starts_at, ends_at)
        values (p_store, 'delivery_included', (p->>'listing_id')::uuid, v_price, v_starts, v_ends)
      on conflict (store_code, listing_id) where kind = 'delivery_included' do update
        set price_minor = excluded.price_minor, starts_at = excluded.starts_at, ends_at = excluded.ends_at, status = 'proposed', proposed_at = now(), decided_by = null, decided_at = null
        where public.store_offers.price_minor <> excluded.price_minor;
    else
      raise exception 'invalid_kind' using errcode = '22023';
    end if;
    get diagnostics v_rows = row_count;
    v_changed := v_changed + v_rows;
  end loop;
  return jsonb_build_object('saved', v_changed);
end $$;

create or replace function public.brain_offers_list(p_store text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'kind', o.kind, 'status', o.status, 'listing_id', o.listing_id, 'quantity', o.quantity,
      'price_minor', o.price_minor, 'slug', o.slug, 'title', o.title, 'items', o.items, 'separate_minor', o.separate_minor,
      'profit_minor', o.profit_minor, 'profit_usd', round(o.profit_minor / power(10::numeric, s.minor_digits) / f.per_usd, 2),
      'profit_full_minor', o.profit_full_minor, 'profit_full_usd', round(o.profit_full_minor / power(10::numeric, s.minor_digits) / f.per_usd, 2),
      'profit_taager_minor', o.profit_taager_minor, 'profit_taager_usd', round(o.profit_taager_minor / power(10::numeric, s.minor_digits) / f.per_usd, 2),
      'profit_if_split_minor', o.profit_if_split_minor, 'profit_if_split_usd', round(o.profit_if_split_minor / power(10::numeric, s.minor_digits) / f.per_usd, 2),
      'price_usd', round(o.price_minor / power(10::numeric, s.minor_digits) / f.per_usd, 2),
      'starts_at', o.starts_at, 'ends_at', o.ends_at, 'meta', o.meta, 'was_price_minor', o.was_price_minor,
      'taager_discounts_proven', f.taager_discounts_proven,
      'problem', o.problem, 'detail', o.detail, 'shown', o.status = 'approved' and o.problem is null and s.catalog_release_enabled)
      order by o.kind, o.title, o.quantity)
    from public.store_offer_state(p_store) o
    join public.stores s on s.code = p_store
    join public.store_commerce_facts f on f.store_code = p_store), '[]'::jsonb);
end $$;

-- Approving a sale stamps its start (the "was" price rule looks at what was charged before this moment).
create or replace function public.brain_offer_decide(p_store text, p_offer uuid, p_decision text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_problem text; v_found boolean := false;
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'rejected', 'proposed') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  select true, o.problem into v_found, v_problem from public.store_offer_state(p_store) o where o.id = p_offer;
  if not coalesce(v_found, false) then raise exception 'unknown_offer' using errcode = '22023'; end if;
  if p_decision = 'approved' and v_problem is not null and v_problem <> 'not_started' then raise exception 'offer_not_safe: %', v_problem using errcode = '22023'; end if;
  update public.store_offers set status = p_decision, decided_by = case when p_decision = 'proposed' then null else auth.uid() end,
         decided_at = case when p_decision = 'proposed' then null else now() end
   where store_code = p_store and id = p_offer;
  return jsonb_build_object('id', p_offer, 'status', p_decision);
end $$;

-- Which shown products the approved free-delivery rule leaves out, and why (owner view).
create function public.brain_free_delivery_report(p_store text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  return (
    with f as (select * from public.store_commerce_facts where store_code = p_store),
    o as (select * from public.store_offers where store_code = p_store and kind = 'free_delivery' limit 1),
    c as (select x.*, public.store_profit(x.price_minor, x.cost_minor, x.floor_minor, f.vat_added_profit_bps) as profit
          from public.store_listing_costs(p_store) x cross join f where x.visible and x.cost_minor is not null)
    select jsonb_build_object('threshold_minor', o.price_minor, 'min_margin_bps', (o.meta->>'min_margin_bps')::integer,
      'eligible', (select count(*) from c where c.profit * 10000 >= (o.meta->>'min_margin_bps')::bigint * c.price_minor),
      'excluded', coalesce((select jsonb_agg(jsonb_build_object('listing_id', c.listing_id, 'title', c.title, 'margin_bps', floor(c.profit * 10000.0 / c.price_minor)) order by c.profit::numeric / c.price_minor)
                            from c where c.profit * 10000 < (o.meta->>'min_margin_bps')::bigint * c.price_minor), '[]'::jsonb))
    from o);
end $$;

revoke all on function public.brain_offer_inputs(text), public.brain_offers_save(text, jsonb), public.brain_offers_list(text), public.brain_offer_decide(text, uuid, text), public.brain_free_delivery_report(text) from public, anon;
grant execute on function public.brain_offer_inputs(text), public.brain_offers_save(text, jsonb), public.brain_offers_list(text), public.brain_offer_decide(text, uuid, text), public.brain_free_delivery_report(text) to authenticated;
revoke all on function public.public_store_offers(text), public.public_product_page(text, text) from public;
grant execute on function public.public_store_offers(text), public.public_product_page(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 8. Picture rule at publish: the brain's order (clean pictures first, promo artwork dropped) is applied to the page media.
alter function public.brain_publish_approved(text, uuid) rename to brain_publish_approved_core;
revoke all on function public.brain_publish_approved_core(text, uuid) from public, anon, authenticated;
create function public.brain_publish_approved(p_store text, p_run uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  v_result := public.brain_publish_approved_core(p_store, p_run);
  update public.brain_listings b
     set media = x.media
    from (
      select bl.listing_id,
             (select jsonb_agg(m.value order by ord.n)
                from jsonb_array_elements(bl.media) m
                join jsonb_array_elements_text(a.content->'pictures'->'order') with ordinality ord(id, n) on ord.id = m.value->>'id') as media
      from public.brain_listings bl
      join public.brain_product_analysis a
        on (a.run_id, a.store_code, a.product_id, a.variation_id) = (bl.run_id, p_store, bl.taager_product_id, bl.taager_variant_id)
      where bl.store_code = p_store and bl.run_id = p_run and jsonb_typeof(a.content->'pictures'->'order') = 'array'
    ) x
   where b.store_code = p_store and b.listing_id = x.listing_id and x.media is not null and jsonb_array_length(x.media) > 0 and x.media <> b.media;
  return v_result;
end $$;
revoke all on function public.brain_publish_approved(text, uuid) from public, anon;
grant execute on function public.brain_publish_approved(text, uuid) to authenticated;

notify pgrst, 'reload schema';
