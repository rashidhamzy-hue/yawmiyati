-- Autopilot auto-approval (session 4, step 6). OFF in every market; only the owner can switch it on, in /admin.
-- When it is on, the daily loop approves by itself, with the SAME never-a-loss checks the owner's buttons use:
--   * price changes that still earn the floor at Taager's current cost, and that move a price by at most 15% in one day;
--   * retirements the brain proposed (taking a weak or vanished product off the store);
--   * offers that are safe right now (no problem reported by the database) and earn the floor at full Taager cost.
-- It never approves a product batch: a new product is built and comes back for the owner's review as before.
-- It never publishes, never switches a flag, never spends. Everything it approves is written to a log and to the brief.
alter table public.brain_settings add column autopilot_since timestamptz, add column autopilot_by uuid;

create table public.brain_autopilot_log (
  id bigint generated always as identity primary key,
  store_code text not null references public.stores(code),
  day date not null default (now() at time zone 'utc')::date,
  kind text not null check (kind in ('price_change', 'retire_product', 'offer', 'left_for_owner')),
  ref text not null,
  title text not null default '',
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  created_at timestamptz not null default now()
);
create index brain_autopilot_log_day_idx on public.brain_autopilot_log (store_code, day);
alter table public.brain_autopilot_log enable row level security;
revoke all on public.brain_autopilot_log from public, anon, authenticated;

-- The one switch. Owner only; the settings patch below can no longer touch it.
create function public.brain_set_autopilot(p_store text, p_on boolean) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.brain_settings set autopilot_enabled = coalesce(p_on, false), autopilot_since = case when coalesce(p_on, false) then now() end,
         autopilot_by = auth.uid(), updated_at = now() where store_code = p_store;
  if not found then raise exception 'unknown_store' using errcode = '22023'; end if;
  return coalesce(p_on, false);
end $$;

create or replace function public.brain_update_settings(p_store text, p_patch jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
 if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
 update public.brain_settings set
  daily_budget_microusd = coalesce((p_patch->>'daily_budget_microusd')::bigint, daily_budget_microusd),
  shortlist_size = coalesce((p_patch->>'shortlist_size')::integer, shortlist_size),
  selection_size = coalesce((p_patch->>'selection_size')::integer, selection_size),
  updated_at = now()
 where store_code = p_store;
 return (select to_jsonb(s) - 'store_code' from public.brain_settings s where s.store_code = p_store);
end $$;

-- Called by the daily loop (service role). Does nothing unless the owner switched autopilot on for this market.
create function public.brain_autopilot_apply(p_store text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  f public.store_commerce_facts; p record; o record; v_cost bigint; v_floor bigint; v_old bigint;
  v_prices integer := 0; v_retired integer := 0; v_offers integer := 0; v_left integer := 0;
begin
  if not coalesce((select autopilot_enabled from public.brain_settings where store_code = p_store), false) then
    return jsonb_build_object('enabled', false);
  end if;
  select * into f from public.store_commerce_facts where store_code = p_store;
  if not found then raise exception 'unknown_store' using errcode = '22023'; end if;

  -- 1. Price changes: the owner button's own check, plus a 15% limit on one day's move.
  for p in select x.* from public.brain_reprice_proposals x where x.store_code = p_store and x.status = 'proposed' and x.action = 'change' for update loop
    select c.cost_minor, c.floor_minor into v_cost, v_floor from public.store_listing_costs(p_store) c where c.listing_id = p.listing_id;
    select b.price_minor into v_old from public.brain_listings b where b.store_code = p_store and b.listing_id = p.listing_id;
    if p.new_price_minor is null or v_cost is null or v_old is null
       or public.store_profit(p.new_price_minor, v_cost, v_floor, f.vat_added_profit_bps) - f.undelivered_cost_minor < f.margin_floor_minor
       or abs(p.new_price_minor - v_old) * 100 > v_old * 15 then
      v_left := v_left + 1;
      insert into public.brain_autopilot_log(store_code, kind, ref, detail) values (p_store, 'left_for_owner', p.id::text,
        jsonb_build_object('what', 'price_change', 'old_price_minor', v_old, 'new_price_minor', p.new_price_minor,
          'why', case when v_cost is null or p.new_price_minor is null then 'no cost or price' when abs(p.new_price_minor - coalesce(v_old, 0)) * 100 > coalesce(v_old, 0) * 15 then 'moves the price by more than 15%' else 'would not earn the floor' end));
      continue;
    end if;
    update public.brain_listings b set price_minor = p.new_price_minor, pricing = p.pricing, updated_at = now() where b.store_code = p_store and b.listing_id = p.listing_id;
    update public.listing_variants v set price_minor = p.new_price_minor
      from public.brain_listings b where b.store_code = p_store and b.listing_id = p.listing_id and (v.store_code, v.id) = (b.store_code, b.variant_id);
    update public.brain_reprice_proposals set status = 'approved', decided_by = null, decided_at = now() where id = p.id;
    insert into public.brain_autopilot_log(store_code, kind, ref, detail) values (p_store, 'price_change', p.listing_id::text,
      jsonb_build_object('old_price_minor', v_old, 'new_price_minor', p.new_price_minor, 'reason', p.reason));
    v_prices := v_prices + 1;
  end loop;

  -- 2. Retirements the brain proposed.
  for p in select x.* from public.brain_daily_proposals x where x.store_code = p_store and x.status = 'proposed' and x.kind = 'retire_product' for update loop
    update public.country_listings l set status = 'suspended'
     where l.store_code = p_store and l.id::text = p.ref and l.status = 'published'
       and exists (select 1 from public.brain_listings b where (b.store_code, b.listing_id) = (l.store_code, l.id));
    update public.brain_daily_proposals set status = 'done', decided_by = null, decided_at = now() where id = p.id;
    insert into public.brain_autopilot_log(store_code, kind, ref, title, detail) values (p_store, 'retire_product', p.ref, p.title, jsonb_build_object('why', p.why));
    v_retired := v_retired + 1;
  end loop;

  -- 3. Offers that are safe right now and earn the floor at full Taager cost.
  for o in select s.id, s.kind, s.title, s.problem, s.profit_full_minor, s.price_minor from public.store_offer_state(p_store) s where s.status = 'proposed' loop
    if o.problem is null and (o.kind = 'free_delivery' or coalesce(o.profit_full_minor, -1) >= f.margin_floor_minor) then
      update public.store_offers set status = 'approved', decided_by = null, decided_at = now() where store_code = p_store and id = o.id and status = 'proposed';
      insert into public.brain_autopilot_log(store_code, kind, ref, title, detail) values (p_store, 'offer', o.id::text, coalesce(o.title, ''),
        jsonb_build_object('offer_kind', o.kind, 'price_minor', o.price_minor, 'profit_full_minor', o.profit_full_minor));
      v_offers := v_offers + 1;
    else
      v_left := v_left + 1;
      insert into public.brain_autopilot_log(store_code, kind, ref, title, detail) values (p_store, 'left_for_owner', o.id::text, coalesce(o.title, ''),
        jsonb_build_object('what', 'offer', 'why', coalesce(o.problem, 'earns under the floor at full cost')));
    end if;
  end loop;

  return jsonb_build_object('enabled', true, 'price_changes', v_prices, 'retired', v_retired, 'offers', v_offers, 'left_for_owner', v_left,
    'new_products_waiting', (select count(*) from public.brain_daily_proposals where store_code = p_store and status = 'proposed' and kind = 'add_product'));
end $$;

-- The loop adds what autopilot did to the day's brief (the brief itself is written before autopilot runs).
create function public.brain_brief_merge(p_store text, p_day date, p_patch jsonb) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'invalid_payload' using errcode = '22023'; end if;
  update public.brain_briefs set brief = brief || p_patch where (store_code, day) = (p_store, p_day);
  return found;
end $$;

-- Owner view of what autopilot did.
create function public.brain_autopilot_log_list(p_store text, p_days integer default 7) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('day', l.day, 'kind', l.kind, 'ref', l.ref, 'title', l.title, 'detail', l.detail, 'at', l.created_at) order by l.created_at desc)
    from public.brain_autopilot_log l where l.store_code = p_store and l.day >= (now() at time zone 'utc')::date - least(greatest(coalesce(p_days, 7), 1), 60)), '[]'::jsonb);
end $$;

revoke all on function public.brain_set_autopilot(text, boolean), public.brain_autopilot_apply(text), public.brain_brief_merge(text, date, jsonb), public.brain_autopilot_log_list(text, integer) from public, anon, authenticated;
grant execute on function public.brain_set_autopilot(text, boolean), public.brain_autopilot_log_list(text, integer) to authenticated;
grant execute on function public.brain_autopilot_apply(text), public.brain_brief_merge(text, date, jsonb) to service_role;
