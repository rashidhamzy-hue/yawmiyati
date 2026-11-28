-- Order-value offers with owner approval (28 Nov 2026):
--   quantity offers ("2 for X"), our own sets of two published products, and a free-delivery threshold.
-- Rules enforced here, on every read:
--   * nothing is shown to visitors until the owner approved that exact offer in /admin;
--   * never a loss per delivered order: FULL Taager cost of every piece, Saudi VAT on what is above Taager's
--     minimum, and the delivery fee whenever we are the ones paying it;
--   * our own sets use only published, in-stock single products (never a supplier bundle as a piece);
--   * a set must stay cheaper than its pieces and must still earn money if it ships as two parcels;
--   * free delivery is sized on the LEAST profitable thing a shopper can buy, not the typical one.
-- Also: merchandising rank / bundle flag / offer flag on public_catalog, the supplier's own low-stock signal on
-- the product page, and low-quantity items count as in stock (they are orderable at the supplier).

create table public.store_commerce_facts (
  store_code text primary key references public.stores(code),
  -- Highest delivery fee we could have to pay per parcel (Egypt's dearest band).
  delivery_fee_minor bigint not null check (delivery_fee_minor > 0),
  -- Share of profit above Taager's minimum price that Taager deducts as VAT (Saudi only).
  vat_added_profit_bps integer not null default 0 check (vat_added_profit_bps between 0 and 10000),
  -- Approximate local currency per 1 US dollar, for owner reporting only.
  per_usd numeric not null check (per_usd > 0)
);
insert into public.store_commerce_facts(store_code, delivery_fee_minor, vat_added_profit_bps, per_usd) values
  ('sa', 2800, 1500, 3.75), ('ae', 1900, 0, 3.6725), ('om', 3000, 0, 0.3845), ('eg', 10500, 0, 48), ('iq', 7000000, 0, 1310)
on conflict (store_code) do nothing;

create table public.store_offers (
  id uuid primary key default gen_random_uuid(),
  store_code text not null references public.stores(code),
  kind text not null check (kind in ('quantity', 'bundle', 'free_delivery')),
  listing_id uuid,
  quantity integer,
  -- quantity: price for all N pieces; bundle: price of the set; free_delivery: basket threshold.
  price_minor bigint not null check (price_minor > 0),
  slug text,
  title text,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected')),
  proposed_at timestamptz not null default now(),
  decided_by uuid,
  decided_at timestamptz,
  check (kind <> 'quantity' or (listing_id is not null and quantity between 2 and 5)),
  check (kind <> 'bundle' or (slug ~ '^[a-z0-9][a-z0-9-]{2,119}$' and length(btrim(coalesce(title, ''))) between 1 and 300
                              and jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 2 and 5)),
  foreign key (store_code, listing_id) references public.country_listings(store_code, id)
);
create unique index store_offers_quantity_key on public.store_offers(store_code, listing_id, quantity) where kind = 'quantity';
create unique index store_offers_bundle_key on public.store_offers(store_code, slug) where kind = 'bundle';
create unique index store_offers_free_delivery_key on public.store_offers(store_code) where kind = 'free_delivery';
alter table public.store_commerce_facts enable row level security;
alter table public.store_offers enable row level security;
revoke all on public.store_commerce_facts, public.store_offers from public, anon, authenticated;

-- Low-quantity items are in stock and orderable at the supplier; only "not available" and pre-order are hidden.
create or replace function public.taager_row_orderable(p_listing jsonb, p_detail jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_detail->>'active', 'true') <> 'false'
     and coalesce(p_detail->'variant'->'merchantInfo'->>'orderable', 'true') <> 'false'
     and coalesce(p_detail->'variant'->>'availability', 'available') in ('available', 'limited', 'available_with_low_qty')
     and coalesce(p_listing->'stockAvailability'->>'stockRange', '') <> 'not_available'
$$;

-- Delivered profit of pieces sold for one price: price - full cost - VAT on what is above the supplier minimum
-- (no minimum known: all profit is treated as added, the cautious case).
create function public.store_profit(p_price bigint, p_cost bigint, p_floor bigint, p_vat_bps integer) returns bigint
language sql immutable set search_path = '' as $$
  select p_price - p_cost - ceil(greatest(0, p_price - coalesce(p_floor, p_cost))::numeric * p_vat_bps / 10000)::bigint
$$;

-- Every published brain listing with the supplier's CURRENT cost and minimum (private: never exposed to visitors).
create function public.store_listing_costs(p_store text)
returns table(listing_id uuid, slug text, title text, price_minor bigint, cost_minor bigint, floor_minor bigint,
              category text, image text, visible boolean, is_bundle boolean, score numeric, quantity_offers jsonb)
language sql stable security definer set search_path = '' as $$
  select st.listing_id, st.slug, st.title, st.price_minor,
         public.taager_minor(t.financials->'originalPrice', s.minor_digits),
         public.taager_minor(t.financials->'price', s.minor_digits),
         st.category, st.image, st.hidden_reason is null,
         jsonb_array_length(coalesce(b.extras->'bundle', '[]'::jsonb)) > 0 or coalesce(t.item_type, '') = 'bundle',
         a.score, coalesce(b.extras->'quantity_offers', '[]'::jsonb)
  from public.brain_listing_state(p_store) st
  join public.stores s on s.code = p_store
  join public.brain_listings b on (b.store_code, b.listing_id) = (p_store, st.listing_id)
  left join public.taager_catalog t on (t.market, t.sku) = (p_store, st.sku)
  left join public.brain_product_analysis a
    on (a.run_id, a.store_code, a.product_id, a.variation_id) = (b.run_id, p_store, b.taager_product_id, b.taager_variant_id)
$$;

-- Current state of every offer: profit now, and the reason it is unsafe to show (null = safe).
-- Multi-piece prices (quantity offers and sets) are checked with VAT on ALL of their profit: how the supplier
-- computes VAT for several pieces in one order is unproven until the first test order, so the lowest case is used.
create function public.store_offer_state(p_store text)
returns table(id uuid, kind text, status text, listing_id uuid, quantity integer, price_minor bigint, slug text, title text,
              items jsonb, profit_minor bigint, profit_if_split_minor bigint, separate_minor bigint, problem text, detail text)
language sql stable security definer set search_path = '' as $$
  with f as (select * from public.store_commerce_facts where store_code = p_store),
  c as (select * from public.store_listing_costs(p_store)),
  q as (
    select o.id, o.kind, o.status, o.listing_id, o.quantity, o.price_minor, o.slug, coalesce(o.title, c.title) as title, o.items,
           public.store_profit(o.price_minor, o.quantity * c.cost_minor, null::bigint, f.vat_added_profit_bps) as profit,
           null::bigint as split, o.quantity * c.price_minor as separate,
           case when c.listing_id is null or not c.visible then 'product_not_shown'
                when c.cost_minor is null then 'no_supplier_cost'
                when o.price_minor >= o.quantity * c.price_minor then 'not_cheaper_than_singles'
                when public.store_profit(o.price_minor, o.quantity * c.cost_minor, null::bigint, f.vat_added_profit_bps) <= 0 then 'loss'
                when public.store_profit(o.price_minor, o.quantity * c.cost_minor, null::bigint, f.vat_added_profit_bps)
                     < public.store_profit(c.price_minor, c.cost_minor, c.floor_minor, f.vat_added_profit_bps) then 'earns_less_than_one_single'
           end as problem, null::text as detail
    from public.store_offers o cross join f
    left join c on c.listing_id = o.listing_id
    where o.store_code = p_store and o.kind = 'quantity'
  ),
  parts as (
    select o.id, (i.value->>'listing_id')::uuid as part_id, greatest((i.value->>'quantity')::integer, 1) as n
    from public.store_offers o, jsonb_array_elements(o.items) i
    where o.store_code = p_store and o.kind = 'bundle'
  ),
  agg as (
    select p.id, count(*) as pieces, count(c.listing_id) as found,
           bool_and(coalesce(c.visible, false)) as all_visible, bool_or(coalesce(c.is_bundle, false)) as has_supplier_bundle,
           bool_or(c.cost_minor is null) as cost_missing, bool_or(c.floor_minor is null) as floor_missing,
           sum(p.n * c.cost_minor)::bigint as cost, sum(p.n * c.floor_minor)::bigint as floor, sum(p.n * c.price_minor)::bigint as separate,
           count(distinct p.part_id) as distinct_parts
    from parts p left join c on c.listing_id = p.part_id group by p.id
  ),
  b as (
    select o.id, o.kind, o.status, o.listing_id, o.quantity, o.price_minor, o.slug, o.title, o.items,
           public.store_profit(o.price_minor, a.cost, null::bigint, f.vat_added_profit_bps) as profit,
           public.store_profit(o.price_minor, a.cost, null::bigint, f.vat_added_profit_bps) - f.delivery_fee_minor as split,
           a.separate,
           case when a.id is null or a.found < a.pieces or not a.all_visible then 'piece_not_shown'
                when a.distinct_parts < a.pieces then 'repeated_piece'
                when a.has_supplier_bundle then 'piece_is_supplier_bundle'
                when a.cost_missing then 'no_supplier_cost'
                when o.price_minor >= a.separate then 'not_cheaper_than_singles'
                when public.store_profit(o.price_minor, a.cost, null::bigint, f.vat_added_profit_bps) <= 0 then 'loss'
                when public.store_profit(o.price_minor, a.cost, null::bigint, f.vat_added_profit_bps) - f.delivery_fee_minor <= 0 then 'loss_if_two_parcels'
           end as problem, null::text as detail
    from public.store_offers o cross join f
    left join agg a on a.id = o.id
    where o.store_code = p_store and o.kind = 'bundle'
  ),
  -- Everything a shopper can put in a basket: shown singles, plus approved and safe quantity offers and sets.
  points as (
    select c.title, c.price_minor as price, public.store_profit(c.price_minor, c.cost_minor, c.floor_minor, f.vat_added_profit_bps) as profit
      from c cross join f where c.visible and c.cost_minor is not null
    union all select q.title, q.price_minor, q.profit from q where q.status = 'approved' and q.problem is null
    union all select b.title, b.price_minor, b.profit from b where b.status = 'approved' and b.problem is null
  ),
  worst as (select title, profit::numeric / price as margin from points order by profit::numeric / price asc, title limit 1),
  fd as (
    select o.id, o.kind, o.status, o.listing_id, o.quantity, o.price_minor, o.slug, o.title, o.items,
           (floor(o.price_minor * w.margin) - f.delivery_fee_minor)::bigint as profit, null::bigint as split, null::bigint as separate,
           case when w.title is null then 'no_products_shown'
                when floor(o.price_minor * w.margin) - f.delivery_fee_minor <= 0 then 'loss_on_thinnest_basket' end as problem,
           w.title as detail
    from public.store_offers o cross join f
    left join worst w on true
    where o.store_code = p_store and o.kind = 'free_delivery'
  )
  select * from q union all select * from b union all select * from fd
$$;
revoke all on function public.store_profit(bigint, bigint, bigint, integer), public.store_listing_costs(text), public.store_offer_state(text) from public, anon, authenticated;

-- PUBLIC: approved and currently safe offers only. No costs, no profit, no supplier identity.
create function public.public_store_offers(p_store text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('market', p_store, 'release', 'owner_approved',
    'free_delivery', (select jsonb_build_object('threshold_minor', o.price_minor) from public.store_offer_state(p_store) o
                      where o.kind = 'free_delivery' and o.status = 'approved' and o.problem is null limit 1),
    'bundles', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'slug', o.slug, 'title', o.title, 'price_minor', o.price_minor,
                           'items', (select jsonb_agg(jsonb_build_object('listing_id', i.value->>'listing_id', 'quantity', greatest((i.value->>'quantity')::integer, 1)))
                                     from jsonb_array_elements(o.items) i)) order by o.slug)
                         from public.store_offer_state(p_store) o
                         where o.kind = 'bundle' and o.status = 'approved' and o.problem is null), '[]'::jsonb))
  where exists (select 1 from public.stores s where s.code = p_store and s.catalog_release_enabled)
$$;
revoke all on function public.public_store_offers(text) from public;
grant execute on function public.public_store_offers(text) to anon, authenticated;

-- Product page: quantity offers now need the owner's approval of that exact offer; low-stock note from the supplier's own signal.
create or replace function public.public_product_page(p_store text,p_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('listing_id',c.listing_id,'market',p_store,'release','public_approved',
   'category',b.category,'page',b.page,'images',b.media,
   'videos',coalesce(b.extras->'videos','[]'::jsonb),
   'bundle',coalesce(b.extras->'bundle','[]'::jsonb),
   'quantity_offers',coalesce((select jsonb_agg(jsonb_build_object('quantity',o.quantity,'price_minor',o.price_minor) order by o.quantity)
      from public.store_offer_state(p_store) o
      where o.kind='quantity' and o.listing_id=c.listing_id and o.status='approved' and o.problem is null),'[]'::jsonb),
   'stock_signal',case when t.detail->'variant'->>'availability'='available_with_low_qty' then 'low' end)
 from public.current_catalog_release(p_store) c
 join public.brain_listings b on (b.store_code,b.listing_id)=(p_store,c.listing_id)
 left join public.taager_catalog t on (t.market,t.sku)=(b.store_code,b.sku)
 where c.slug=p_slug limit 1
$$;

-- Catalogue rows gain the brain's order, a bundle flag and an "approved quantity offer" flag.
drop function public.public_catalog(text,integer,integer);
create function public.public_catalog(p_store text,p_limit integer default 50,p_offset integer default 0)
returns table(listing_id uuid,slug text,title text,price_minor text,currency text,approved_category_slugs text[],category_release text,image text,
              rank integer,kind text,offer boolean)
language sql stable security definer set search_path='' as $$
 with shown as (
  select c.listing_id,c.slug,c.title,c.price_minor,c.currency,b.category,b.media->0->>'id' as image,
   (row_number() over (order by (a.score is null),a.score desc,c.slug))::integer as rank,
   case when jsonb_array_length(coalesce(b.extras->'bundle','[]'::jsonb))>0 then 'bundle' end as kind
  from public.current_catalog_release(p_store) c
  left join public.brain_listings b on (b.store_code,b.listing_id)=(p_store,c.listing_id)
  left join public.brain_product_analysis a on (a.run_id,a.store_code,a.product_id,a.variation_id)=(b.run_id,p_store,b.taager_product_id,b.taager_variant_id)
 ), offered as (
  select distinct o.listing_id from public.store_offer_state(p_store) o where o.kind='quantity' and o.status='approved' and o.problem is null
 )
 select s.listing_id,s.slug,s.title,s.price_minor,s.currency,
  case when s.category is null then '{}'::text[] else array[s.category] end,'owner_approved',s.image,
  s.rank,s.kind,exists(select 1 from offered f where f.listing_id=s.listing_id)
 from shown s
 order by s.slug,s.listing_id limit least(greatest(coalesce(p_limit,50),1),100) offset least(greatest(coalesce(p_offset,0),0),10000)
$$;
revoke all on function public.public_catalog(text,integer,integer) from public;
grant execute on function public.public_catalog(text,integer,integer) to anon,authenticated;

-- OWNER: inputs for proposals (costs stay behind owner membership).
create function public.brain_offer_inputs(p_store text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'facts', (select to_jsonb(f) - 'store_code' from public.store_commerce_facts f where f.store_code = p_store),
    'listings', coalesce((select jsonb_agg(jsonb_build_object('listing_id', c.listing_id, 'slug', c.slug, 'title', c.title, 'category', c.category,
        'price_minor', c.price_minor, 'cost_minor', c.cost_minor, 'floor_minor', c.floor_minor, 'image', c.image, 'is_bundle', c.is_bundle,
        'rank', c.rank, 'quantity_offers', c.quantity_offers) order by c.rank)
      from (select x.*, row_number() over (order by (x.score is null), x.score desc, x.slug) as rank
            from public.store_listing_costs(p_store) x where x.visible and x.cost_minor is not null) c), '[]'::jsonb));
end $$;

-- OWNER: store the brain's proposals. A changed price sends an offer back to "proposed"; the owner's earlier
-- decisions on unchanged offers are kept. Nothing here makes an offer visible.
create function public.brain_offers_save(p_store text, p_proposals jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare p jsonb; v_kind text; v_price bigint; v_changed integer := 0; v_rows integer;
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  if jsonb_typeof(p_proposals) <> 'array' or jsonb_array_length(p_proposals) > 400 then raise exception 'invalid_proposals' using errcode = '22023'; end if;
  for p in select * from jsonb_array_elements(p_proposals) loop
    v_kind := p->>'kind';
    if jsonb_typeof(p->'price_minor') <> 'number' then raise exception 'invalid_price' using errcode = '22023'; end if;
    v_price := (p->>'price_minor')::numeric::bigint;
    if v_kind = 'quantity' then
      insert into public.store_offers(store_code, kind, listing_id, quantity, price_minor)
        values (p_store, 'quantity', (p->>'listing_id')::uuid, (p->>'quantity')::integer, v_price)
      on conflict (store_code, listing_id, quantity) where kind = 'quantity' do update
        set price_minor = excluded.price_minor, status = 'proposed', proposed_at = now(), decided_by = null, decided_at = null
        where public.store_offers.price_minor <> excluded.price_minor;
    elsif v_kind = 'bundle' then
      insert into public.store_offers(store_code, kind, slug, title, items, price_minor)
        values (p_store, 'bundle', p->>'slug', left(btrim(p->>'title'), 300),
                (select jsonb_agg(jsonb_build_object('listing_id', (i.value->>'listing_id')::uuid, 'quantity', (i.value->>'quantity')::integer)) from jsonb_array_elements(p->'items') i), v_price)
      on conflict (store_code, slug) where kind = 'bundle' do update
        set price_minor = excluded.price_minor, title = excluded.title, items = excluded.items, status = 'proposed', proposed_at = now(), decided_by = null, decided_at = null
        where public.store_offers.price_minor <> excluded.price_minor or public.store_offers.items <> excluded.items;
    elsif v_kind = 'free_delivery' then
      insert into public.store_offers(store_code, kind, price_minor) values (p_store, 'free_delivery', v_price)
      on conflict (store_code) where kind = 'free_delivery' do update
        set price_minor = excluded.price_minor, status = 'proposed', proposed_at = now(), decided_by = null, decided_at = null
        where public.store_offers.price_minor <> excluded.price_minor;
    else
      raise exception 'invalid_kind' using errcode = '22023';
    end if;
    get diagnostics v_rows = row_count;
    v_changed := v_changed + v_rows;
  end loop;
  return jsonb_build_object('saved', v_changed);
end $$;

-- OWNER: every offer with what it earns per delivered order, in local money and US dollars.
create function public.brain_offers_list(p_store text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'kind', o.kind, 'status', o.status, 'listing_id', o.listing_id, 'quantity', o.quantity,
      'price_minor', o.price_minor, 'slug', o.slug, 'title', o.title, 'items', o.items, 'separate_minor', o.separate_minor,
      'profit_minor', o.profit_minor, 'profit_usd', round(o.profit_minor / power(10::numeric, s.minor_digits) / f.per_usd, 2),
      'profit_if_split_minor', o.profit_if_split_minor, 'profit_if_split_usd', round(o.profit_if_split_minor / power(10::numeric, s.minor_digits) / f.per_usd, 2),
      'price_usd', round(o.price_minor / power(10::numeric, s.minor_digits) / f.per_usd, 2),
      'problem', o.problem, 'detail', o.detail, 'shown', o.status = 'approved' and o.problem is null and s.catalog_release_enabled)
      order by o.kind, o.title, o.quantity)
    from public.store_offer_state(p_store) o
    join public.stores s on s.code = p_store
    join public.store_commerce_facts f on f.store_code = p_store), '[]'::jsonb);
end $$;

-- OWNER: approve, reject or un-decide one offer. An offer that would lose money cannot be approved.
create function public.brain_offer_decide(p_store text, p_offer uuid, p_decision text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_problem text; v_found boolean := false;
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'rejected', 'proposed') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  select true, o.problem into v_found, v_problem from public.store_offer_state(p_store) o where o.id = p_offer;
  if not coalesce(v_found, false) then raise exception 'unknown_offer' using errcode = '22023'; end if;
  if p_decision = 'approved' and v_problem is not null then raise exception 'offer_not_safe: %', v_problem using errcode = '22023'; end if;
  update public.store_offers set status = p_decision, decided_by = case when p_decision = 'proposed' then null else auth.uid() end,
         decided_at = case when p_decision = 'proposed' then null else now() end
   where store_code = p_store and id = p_offer;
  return jsonb_build_object('id', p_offer, 'status', p_decision);
end $$;

revoke all on function public.brain_offer_inputs(text), public.brain_offers_save(text, jsonb), public.brain_offers_list(text), public.brain_offer_decide(text, uuid, text) from public, anon;
grant execute on function public.brain_offer_inputs(text), public.brain_offers_save(text, jsonb), public.brain_offers_list(text), public.brain_offer_decide(text, uuid, text) to authenticated;
notify pgrst, 'reload schema';
