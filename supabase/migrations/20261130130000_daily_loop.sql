-- The brain's daily loop and morning brief (session 3, step 6).
-- Every morning, per market, the loop reads yesterday (orders, visits, Taager's sync), re-prices, pauses products
-- that are being refused, proposes products to add and to retire, and writes one brief for the owner in /admin.
-- It PROPOSES. Publishing, offers, prices and new products go live only after the owner approves (one Approve all).
-- The only thing it does by itself is protective and reversible: hiding a product (floor, stock, refusals).
-- brain_settings.autopilot_enabled exists and stays off; no automatic approval is built on it.

alter table public.brain_settings add column daily_loop_enabled boolean not null default true;
alter table public.brain_cost_ledger alter column run_id drop not null;  -- daily-loop spend is not part of a build run

-- A product the brain or the owner paused: hidden on the next read, with the reason, until resumed.
alter table public.brain_listings add column paused jsonb check (paused is null or jsonb_typeof(paused) = 'object');

create or replace function public.brain_listing_state(p_store text)
returns table(listing_id uuid, slug text, title text, description text, price_minor bigint, currency text,
              category text, image text, sku text, hidden_reason text)
language sql stable security definer set search_path = '' as $$
  select l.id, l.slug, l.title, b.page->>'description', b.price_minor, s.currency, b.category, b.media->0->>'id', b.sku,
    case
      when l.status <> 'published' then 'unpublished'
      when b.paused is not null then 'paused'
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

create table public.brain_briefs (
  store_code text not null references public.stores(code),
  day date not null,
  brief jsonb not null check (jsonb_typeof(brief) = 'object'),
  created_at timestamptz not null default now(),
  primary key (store_code, day)
);
create table public.brain_daily_proposals (
  id uuid primary key default gen_random_uuid(),
  store_code text not null references public.stores(code),
  day date not null,
  kind text not null check (kind in ('add_product', 'retire_product')),
  ref text not null check (length(ref) between 1 and 120),      -- add: Taager SKU; retire: listing id
  title text not null default '',
  why text not null check (length(why) between 3 and 600),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'superseded', 'done')),
  created_at timestamptz not null default now(),
  decided_by uuid, decided_at timestamptz
);
create unique index brain_daily_open_key on public.brain_daily_proposals(store_code, kind, ref) where status = 'proposed';
create index brain_daily_day on public.brain_daily_proposals(store_code, day);
alter table public.brain_briefs enable row level security;
alter table public.brain_daily_proposals enable row level security;
revoke all on public.brain_briefs, public.brain_daily_proposals from public, anon, authenticated;
grant select, insert, update, delete on public.brain_briefs, public.brain_daily_proposals to service_role;

-- Service role: what the loop needs about every listing (current price, Taager's current cost and minimum, the
-- pricing record, why it is hidden) in one read.
create function public.brain_daily_listings(p_store text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('listing_id', st.listing_id, 'sku', st.sku, 'slug', st.slug, 'title', st.title, 'category', st.category, 'image', st.image,
      'price_minor', st.price_minor, 'hidden_reason', st.hidden_reason,
      'cost_minor', public.taager_minor(t.financials->'originalPrice', s.minor_digits), 'floor_minor', public.taager_minor(t.financials->'price', s.minor_digits),
      'pricing', coalesce(b.pricing, a.decision, '{}'::jsonb), 'has_video', jsonb_array_length(coalesce(b.extras->'videos', '[]'::jsonb)) > 0,
      'published_at', b.published_at, 'synced_at', t.synced_at) order by st.slug), '[]'::jsonb)
    from public.brain_listing_state(p_store) st
    join public.stores s on s.code = p_store
    join public.brain_listings b on (b.store_code, b.listing_id) = (p_store, st.listing_id)
    left join public.taager_catalog t on (t.market, t.sku) = (p_store, st.sku)
    left join public.brain_product_analysis a
      on (a.run_id, a.store_code, a.product_id, a.variation_id) = (b.run_id, p_store, b.taager_product_id, b.taager_variant_id)
$$;

-- Service role: catalogue rows worth looking at as NEW products: in stock, synced recently, not on the store, never
-- rejected by the owner; newest and fastest-moving first.
create function public.brain_daily_candidates(p_store text, p_limit integer default 60) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(x) - 'rn'), '[]'::jsonb) from (
    select t.market, t.sku, t.product_id, t.variant_id, t.item_type, t.name, t.listing, t.detail, t.alternatives, t.financials, t.synced_at, t.price_changed_at,
           coalesce(v.per_day, 0) as stock_per_day,
           row_number() over (order by (public.taager_utc(t.listing->>'createdAt') > now() - interval '30 days') desc nulls last, coalesce(v.per_day, 0) desc, t.first_seen_at desc) as rn
      from public.taager_catalog t
      join public.brain_settings bs on bs.store_code = p_store
      left join public.taager_stock_velocity(p_store) v on v.sku = t.sku
     where t.market = p_store
       and t.synced_at > now() - make_interval(hours => bs.stock_max_age_hours)
       and public.taager_row_orderable(t.listing, t.detail)
       and not exists (select 1 from public.brain_listings b where (b.store_code, b.sku) = (p_store, t.sku))
       and not exists (select 1 from public.brain_product_analysis a where a.store_code = p_store and a.product_id = t.product_id and a.owner_decision = 'rejected')
       and not exists (select 1 from public.brain_daily_proposals p where p.store_code = p_store and p.kind = 'add_product' and p.ref = t.sku and p.status = 'rejected')
  ) x where x.rn <= least(greatest(p_limit, 1), 200)
$$;

-- Service role: hide a product now, with the reason shown to the owner. Reversible by the owner.
create function public.brain_pause_listing(p_store text, p_listing uuid, p_reason text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.brain_listings set paused = jsonb_build_object('by', 'brain', 'reason', left(p_reason, 400), 'at', now()), updated_at = now()
   where store_code = p_store and listing_id = p_listing and paused is null;
  return found;
end $$;

-- Service role: save the morning brief and the day's proposals (idempotent: running the loop twice replaces the day's work).
create function public.brain_daily_save(p_store text, p_day date, p_brief jsonb, p_proposals jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare r jsonb; n integer := 0;
begin
  if jsonb_typeof(p_brief) <> 'object' or jsonb_typeof(coalesce(p_proposals, '[]'::jsonb)) <> 'array' then raise exception 'invalid_payload' using errcode = '22023'; end if;
  insert into public.brain_briefs(store_code, day, brief) values (p_store, p_day, p_brief)
  on conflict (store_code, day) do update set brief = excluded.brief, created_at = now();
  update public.brain_daily_proposals set status = 'superseded' where store_code = p_store and status = 'proposed';
  for r in select * from jsonb_array_elements(coalesce(p_proposals, '[]'::jsonb)) loop
    if r->>'kind' in ('add_product', 'retire_product') and length(coalesce(r->>'ref', '')) between 1 and 120 then
      insert into public.brain_daily_proposals(store_code, day, kind, ref, title, why, data)
      values (p_store, p_day, r->>'kind', r->>'ref', left(coalesce(r->>'title', ''), 300), left(coalesce(r->>'why', 'proposed'), 600), coalesce(r->'data', '{}'::jsonb))
      on conflict do nothing;
      n := n + 1;
    end if;
  end loop;
  return jsonb_build_object('proposals', n);
end $$;
revoke all on function public.brain_daily_listings(text), public.brain_daily_candidates(text, integer), public.brain_pause_listing(text, uuid, text), public.brain_daily_save(text, date, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.brain_daily_listings(text), public.brain_daily_candidates(text, integer), public.brain_pause_listing(text, uuid, text), public.brain_daily_save(text, date, jsonb, jsonb),
  public.brain_reprice_save(text, jsonb), public.scorecard_window(text, integer), public.brain_spent_today(text) to service_role;

-- Owner: the latest brief (or one day's) with everything waiting for a decision.
create function public.brain_brief(p_store text, p_day date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_day date;
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(p_day, max(day)) into v_day from public.brain_briefs where store_code = p_store;
  return jsonb_build_object('day', v_day,
    'brief', (select b.brief from public.brain_briefs b where (b.store_code, b.day) = (p_store, v_day)),
    'created_at', (select b.created_at from public.brain_briefs b where (b.store_code, b.day) = (p_store, v_day)),
    'days', coalesce((select jsonb_agg(d.day order by d.day desc) from (select day from public.brain_briefs where store_code = p_store order by day desc limit 14) d), '[]'::jsonb),
    'proposals', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'kind', p.kind, 'ref', p.ref, 'title', p.title, 'why', p.why, 'data', p.data, 'status', p.status, 'day', p.day) order by p.kind, p.created_at)
                            from public.brain_daily_proposals p where p.store_code = p_store and p.status in ('proposed', 'approved')), '[]'::jsonb),
    'price_changes_waiting', (select count(*) from public.brain_reprice_proposals r where r.store_code = p_store and r.status = 'proposed'),
    'offers_waiting', (select count(*) from public.store_offers o where o.store_code = p_store and o.status = 'proposed'),
    'paused', coalesce((select jsonb_agg(jsonb_build_object('listing_id', b.listing_id, 'title', l.title, 'reason', b.paused->>'reason', 'by', b.paused->>'by', 'at', b.paused->>'at') order by b.paused->>'at' desc)
                         from public.brain_listings b join public.country_listings l on (l.store_code, l.id) = (b.store_code, b.listing_id)
                        where b.store_code = p_store and b.paused is not null), '[]'::jsonb),
    'autopilot_enabled', (select autopilot_enabled from public.brain_settings where store_code = p_store),
    'daily_loop_enabled', (select daily_loop_enabled from public.brain_settings where store_code = p_store));
end $$;

-- Owner: decide the day's product proposals (p_ids null = all open ones). Approving a retirement takes the product off
-- the store; approving an addition marks it for the next build (the product still goes through research, pricing,
-- its page and the owner's approval of the batch before anything is published).
create function public.brain_daily_decide(p_store text, p_ids uuid[], p_decision text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare p record; n integer := 0; retired integer := 0; adds jsonb := '[]'::jsonb;
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  for p in select * from public.brain_daily_proposals x where x.store_code = p_store and x.status = 'proposed' and (p_ids is null or x.id = any(p_ids)) for update loop
    if p_decision = 'approved' and p.kind = 'retire_product' then
      update public.country_listings l set status = 'suspended'
       where l.store_code = p_store and l.id::text = p.ref and l.status = 'published'
         and exists (select 1 from public.brain_listings b where (b.store_code, b.listing_id) = (l.store_code, l.id));
      if found then retired := retired + 1; end if;
    elsif p_decision = 'approved' and p.kind = 'add_product' then
      adds := adds || jsonb_build_array(coalesce((p.data->>'product_id')::bigint, 0));
    end if;
    update public.brain_daily_proposals set status = case when p_decision = 'approved' and p.kind = 'retire_product' then 'done' else p_decision end,
           decided_by = auth.uid(), decided_at = now() where id = p.id;
    n := n + 1;
  end loop;
  return jsonb_build_object('decided', n, 'retired', retired, 'add_product_ids', adds, 'decision', p_decision);
end $$;

-- Owner: put a paused product back (it still has to pass every automatic check), or pause one by hand.
create function public.brain_set_paused(p_store text, p_listing uuid, p_paused boolean, p_reason text default null) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.brain_listings set paused = case when p_paused then jsonb_build_object('by', 'owner', 'reason', left(coalesce(p_reason, 'Paused by the owner'), 400), 'at', now()) end, updated_at = now()
   where store_code = p_store and listing_id = p_listing;
  return found;
end $$;

-- Owner: the per-market loop switch. Autopilot is deliberately NOT settable here: it stays off until G2.
create function public.brain_set_daily_loop(p_store text, p_enabled boolean) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.brain_settings set daily_loop_enabled = p_enabled, updated_at = now() where store_code = p_store;
  return found;
end $$;
revoke all on function public.brain_brief(text, date), public.brain_daily_decide(text, uuid[], text), public.brain_set_paused(text, uuid, boolean, text), public.brain_set_daily_loop(text, boolean) from public, anon;
grant execute on function public.brain_brief(text, date), public.brain_daily_decide(text, uuid[], text), public.brain_set_paused(text, uuid, boolean, text), public.brain_set_daily_loop(text, boolean) to authenticated;

-- Scheduler: every day at 03:20 UTC (06:20 Riyadh, 05:20 Cairo) call the daily function once per market whose loop is on.
-- It does nothing until two Vault secrets exist: yawmiyati_daily_url (the edge function's URL) and
-- yawmiyati_cron_secret (the same value as the function's CRON_SECRET). No secret is stored in a table or in this file.
create function public.brain_daily_kick() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare v_url text; v_secret text; s record; n integer := 0;
begin
  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'yawmiyati_daily_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'yawmiyati_cron_secret';
  exception when undefined_table or invalid_schema_name or insufficient_privilege then return 0; end;
  if v_url is null or v_secret is null or v_url !~ '^https://' then return 0; end if;
  for s in select bs.store_code from public.brain_settings bs where bs.daily_loop_enabled order by bs.store_code loop
    begin
      perform net.http_post(url := v_url, headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', v_secret),
                            body := jsonb_build_object('store', s.store_code, 'action', 'run'), timeout_milliseconds := 150000);
      n := n + 1;
    exception when undefined_function or invalid_schema_name then return n; end;
  end loop;
  return n;
end $$;
revoke all on function public.brain_daily_kick() from public, anon, authenticated;
select cron.schedule('yawmiyati-brain-daily', '20 3 * * *', $$select public.brain_daily_kick();$$);
