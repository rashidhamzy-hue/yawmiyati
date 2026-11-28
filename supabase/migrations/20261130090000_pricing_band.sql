-- Margin band and automatic pause (owner decision, 28 Nov 2026).
-- Margin = profit per delivered order after Taager's cost, Saudi VAT and the expected cost of undelivered orders.
-- Normal band 15-50% of the selling price (planning rule, applied by the brain; exceptions carry a written reason).
-- Hard floor: about US$2 per delivered order on every listing. The floor is enforced HERE on every public read:
-- a listing whose price no longer earns the floor at Taager's current cost is hidden with reason 'margin_below_floor'.
-- Re-pricing proposals wait for the owner (autopilot stays off). Nothing here changes a release flag or publishes.

alter table public.store_commerce_facts
  add column margin_floor_minor bigint,
  add column margin_min_bps integer not null default 1500 check (margin_min_bps between 0 and 10000),
  add column margin_max_bps integer not null default 5000 check (margin_max_bps between 0 and 10000),
  -- Expected cost of undelivered orders carried by each delivered one (Egypt's refusal charge at the planning rate).
  add column undelivered_cost_minor bigint not null default 0 check (undelivered_cost_minor >= 0);
update public.store_commerce_facts f
   set margin_floor_minor = round(2 * f.per_usd * power(10::numeric, s.minor_digits))::bigint
  from public.stores s where s.code = f.store_code;
-- Egypt: 5 EGP per refusal at a 65% planning delivery rate = ceil(500 * 35 / 65).
update public.store_commerce_facts set undelivered_cost_minor = 270 where store_code = 'eg';
alter table public.store_commerce_facts alter column margin_floor_minor set not null,
  add constraint store_commerce_facts_floor_check check (margin_floor_minor > 0),
  add constraint store_commerce_facts_band_check check (margin_min_bps < margin_max_bps);

-- The brain's latest pricing record for a listing (band exception reason, delivery-included pricing, competitor position).
alter table public.brain_listings add column pricing jsonb;
alter table public.brain_listings add constraint brain_listings_pricing_object check (pricing is null or jsonb_typeof(pricing) = 'object');

create or replace function public.brain_listing_state(p_store text)
returns table(listing_id uuid, slug text, title text, description text, price_minor bigint, currency text,
              category text, image text, sku text, hidden_reason text)
language sql stable security definer set search_path = '' as $$
  select l.id, l.slug, l.title, b.page->>'description', b.price_minor, s.currency, b.category, b.media->0->>'id', b.sku,
    case
      when l.status <> 'published' then 'unpublished'
      when v.price_minor <> b.price_minor then 'price_mismatch'
      when t.sku is null then 'missing_from_catalogue'
      when t.synced_at < now() - make_interval(hours => bs.stock_max_age_hours) then 'stale_sync'
      when not public.taager_row_orderable(t.listing, t.detail) then 'out_of_stock'
      when public.taager_minor(t.financials->'originalPrice', s.minor_digits) is null then 'no_supplier_cost'
      when b.price_minor <= public.taager_minor(t.financials->'originalPrice', s.minor_digits) then 'below_supplier_cost'
      when f.store_code is not null
       and public.store_profit(b.price_minor, public.taager_minor(t.financials->'originalPrice', s.minor_digits),
             public.taager_minor(t.financials->'price', s.minor_digits), f.vat_added_profit_bps) - f.undelivered_cost_minor < f.margin_floor_minor
        then 'margin_below_floor'
    end
  from public.brain_listings b
  join public.stores s on s.code = b.store_code
  join public.brain_settings bs on bs.store_code = b.store_code
  join public.country_listings l on (l.store_code, l.id) = (b.store_code, b.listing_id)
  join public.listing_variants v on (v.store_code, v.id, v.listing_id) = (b.store_code, b.variant_id, b.listing_id)
  left join public.store_commerce_facts f on f.store_code = b.store_code
  left join public.taager_catalog t on (t.market, t.sku) = (b.store_code, b.sku)
  where b.store_code = p_store
$$;

-- Re-pricing proposals: written by the brain (service role) after a Taager sync or new shop prices; decided by the owner.
create table public.brain_reprice_proposals (
  id uuid primary key default gen_random_uuid(),
  store_code text not null,
  listing_id uuid not null,
  action text not null check (action in ('change', 'pause')),
  old_price_minor bigint not null check (old_price_minor > 0),
  new_price_minor bigint check (new_price_minor > 0),
  reason text not null check (length(reason) between 3 and 500),
  pricing jsonb not null default '{}'::jsonb check (jsonb_typeof(pricing) = 'object'),
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'superseded')),
  created_at timestamptz not null default now(),
  decided_by uuid, decided_at timestamptz,
  foreign key (store_code, listing_id) references public.brain_listings(store_code, listing_id) on delete cascade
);
create unique index brain_reprice_open_key on public.brain_reprice_proposals(store_code, listing_id) where status = 'proposed';
alter table public.brain_reprice_proposals enable row level security;
revoke all on public.brain_reprice_proposals from public, anon, authenticated;

-- Service role: replace the open proposal of each listing (idempotent per listing).
create function public.brain_reprice_save(p_store text, p_rows jsonb) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare r jsonb; n integer := 0; v_old bigint;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then raise exception 'invalid_rows' using errcode = '22023'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    select b.price_minor into v_old from public.brain_listings b where b.store_code = p_store and b.listing_id = (r->>'listing_id')::uuid;
    if v_old is null then continue; end if;
    update public.brain_reprice_proposals set status = 'superseded'
     where store_code = p_store and listing_id = (r->>'listing_id')::uuid and status = 'proposed';
    if r->>'action' in ('change', 'pause') and (r->>'new_price_minor' is null or (r->>'new_price_minor')::bigint <> v_old) then
      insert into public.brain_reprice_proposals(store_code, listing_id, action, old_price_minor, new_price_minor, reason, pricing)
      values (p_store, (r->>'listing_id')::uuid, r->>'action', v_old, (r->>'new_price_minor')::bigint, left(r->>'reason', 500), coalesce(r->'pricing', '{}'::jsonb));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.brain_reprice_save(text, jsonb) from public, anon, authenticated;
grant execute on function public.brain_reprice_save(text, jsonb) to service_role;

-- Owner: open proposals with what each price earns now and after, in the store's currency and US dollars.
create function public.brain_reprice_list(p_store text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'listing_id', p.listing_id, 'title', c.title, 'slug', c.slug, 'action', p.action,
        'old_price_minor', p.old_price_minor, 'new_price_minor', p.new_price_minor, 'reason', p.reason, 'pricing', p.pricing, 'created_at', p.created_at,
        'hidden_now', not c.visible,
        'profit_now_minor', public.store_profit(p.old_price_minor, c.cost_minor, c.floor_minor, f.vat_added_profit_bps) - f.undelivered_cost_minor,
        'profit_new_minor', case when p.new_price_minor is not null then public.store_profit(p.new_price_minor, c.cost_minor, c.floor_minor, f.vat_added_profit_bps) - f.undelivered_cost_minor end,
        'per_usd', f.per_usd) order by p.action desc, p.created_at)
    from public.brain_reprice_proposals p
    join public.store_commerce_facts f on f.store_code = p.store_code
    left join public.store_listing_costs(p_store) c on c.listing_id = p.listing_id
    where p.store_code = p_store and p.status = 'proposed'), '[]'::jsonb);
end $$;

-- Owner: approve (the new price goes live on listing and variant together; never at or under Taager's current cost
-- and never under the floor) or reject. p_ids null = every open proposal that has a new price.
create function public.brain_reprice_decide(p_store text, p_ids uuid[], p_decision text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare p record; v_cost bigint; v_floor bigint; n integer := 0; skipped integer := 0; f public.store_commerce_facts;
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  select * into f from public.store_commerce_facts where store_code = p_store;
  for p in select * from public.brain_reprice_proposals x
            where x.store_code = p_store and x.status = 'proposed' and (p_ids is null or x.id = any(p_ids)) for update loop
    if p_decision = 'approved' then
      select c.cost_minor, c.floor_minor into v_cost, v_floor from public.store_listing_costs(p_store) c where c.listing_id = p.listing_id;
      if p.new_price_minor is null or v_cost is null
         or public.store_profit(p.new_price_minor, v_cost, v_floor, f.vat_added_profit_bps) - f.undelivered_cost_minor < f.margin_floor_minor then
        skipped := skipped + 1; continue;
      end if;
      update public.brain_listings b set price_minor = p.new_price_minor, pricing = p.pricing, updated_at = now()
       where b.store_code = p_store and b.listing_id = p.listing_id;
      update public.listing_variants v set price_minor = p.new_price_minor
        from public.brain_listings b where b.store_code = p_store and b.listing_id = p.listing_id and (v.store_code, v.id) = (b.store_code, b.variant_id);
    end if;
    update public.brain_reprice_proposals set status = p_decision, decided_by = auth.uid(), decided_at = now() where id = p.id;
    n := n + 1;
  end loop;
  return jsonb_build_object('decided', n, 'skipped_unsafe', skipped, 'decision', p_decision);
end $$;
revoke all on function public.brain_reprice_list(text), public.brain_reprice_decide(text, uuid[], text) from public, anon;
grant execute on function public.brain_reprice_list(text), public.brain_reprice_decide(text, uuid[], text) to authenticated;

-- Offer inputs: say which products the brain priced with delivery included, and the floor the proposals must respect.
create or replace function public.brain_offer_inputs(p_store text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'facts', (select to_jsonb(f) - 'store_code' from public.store_commerce_facts f where f.store_code = p_store),
    'listings', coalesce((select jsonb_agg(jsonb_build_object('listing_id', c.listing_id, 'slug', c.slug, 'title', c.title, 'category', c.category,
        'price_minor', c.price_minor, 'cost_minor', c.cost_minor, 'floor_minor', c.floor_minor, 'image', c.image, 'is_bundle', c.is_bundle,
        'rank', c.rank, 'quantity_offers', c.quantity_offers, 'tiers', c.tiers, 'addon_cost_minor', (c.addon->>'cost_minor')::bigint,
        'sale', c.sale, 'positioning', c.positioning,
        'priced_with_delivery', coalesce((c.pricing->>'delivery_included')::boolean, false),
        'band_exception', c.pricing->'band_exception'->>'reason') order by c.rank)
      from (select x.*, row_number() over (order by (x.score is null), x.score desc, x.slug) as rank,
                   coalesce(b.pricing, a.decision) as pricing
            from public.store_listing_costs(p_store) x
            join public.brain_listings b on (b.store_code, b.listing_id) = (p_store, x.listing_id)
            left join public.brain_product_analysis a
              on (a.run_id, a.store_code, a.product_id, a.variation_id) = (b.run_id, p_store, b.taager_product_id, b.taager_variant_id)
            where x.visible and x.cost_minor is not null) c), '[]'::jsonb));
end $$;
