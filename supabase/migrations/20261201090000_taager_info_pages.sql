-- Taager's own information pages, put to work (session 4, step 2).
-- The owner-run sync (tools/taager/sync.js v5) reads each country's /info, /loyalty and linked help, policy and fee
-- pages. They are stored here privately, one row per market + page + version, so a change between two syncs is visible.
-- The facts that matter (delivery fees and zones, delivery times, COD rules, refusal and return fees, limits, loyalty
-- tiers, VAT) are stored as structured market facts with the page and the date they were read from.
--   agrees     the page says what we already plan with                    -> used
--   pending    the page contradicts our figure, or changed                -> waits for the owner
--   confirmed  the owner confirmed the page                               -> the page wins
--   rejected   the owner rejected it                                      -> ignored
-- "Never a loss" while something waits: a pending figure that would cost us MORE is already used by the price guards.
-- Nothing personal is stored: account, wallet, payment and order calls never reach the file, and this import refuses
-- account-like paths and any text that still carries an e-mail address.
-- Private tables: RLS on, no client policies. Nothing here switches a flag, publishes or changes a price.

create table public.taager_info_pages (
  id uuid primary key default gen_random_uuid(),
  market text not null check (market in ('sa','ae','om','eg','iq')),
  path text not null check (path ~ '^/[a-z]{2}/[A-Za-z0-9/_-]{1,120}$'),
  version integer not null check (version >= 1),
  title text not null default '',
  body text not null check (length(body) between 20 and 60000),
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  api jsonb not null default '[]'::jsonb check (jsonb_typeof(api) = 'array'),
  content_hash text not null,
  read_at timestamptz,
  imported_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  imported_by uuid,
  unique (market, path, version)
);
create table public.taager_market_facts (
  id uuid primary key default gen_random_uuid(),
  market text not null check (market in ('sa','ae','om','eg','iq')),
  fact_key text not null check (fact_key in ('delivery_fee','delivery_time','cod','confirmation','refusal_fee','return_fee','return_window','return_rules','order_limits','vat','payout','loyalty','other_rules')),
  value jsonb not null check (jsonb_typeof(value) = 'object'),
  summary text not null default '' check (length(summary) <= 600),
  quote text not null default '' check (length(quote) <= 300),
  source_path text not null,
  source_read_at timestamptz,
  confidence text not null default 'low' check (confidence in ('high','low')),
  decision text not null check (decision in ('agrees','pending','confirmed','rejected')),
  is_current boolean not null default true,
  previous_value jsonb,
  changed_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);
create unique index taager_market_facts_current_idx on public.taager_market_facts (market, fact_key) where is_current;
alter table public.taager_info_pages enable row level security;
alter table public.taager_market_facts enable row level security;
revoke all on public.taager_info_pages, public.taager_market_facts from public, anon, authenticated;
comment on table public.taager_info_pages is 'Text of Taager''s merchant information pages per market, versioned. Owner-run sync only; never shown to shoppers; no personal data.';
comment on table public.taager_market_facts is 'Structured facts read from taager_info_pages with source page and date. Customers see only public_market_facts().';

-- The figures we planned with before any page was read: what a rejected or withdrawn page fact falls back to.
alter table public.store_commerce_facts
  add column base_delivery_fee_minor bigint,
  add column base_vat_added_profit_bps integer,
  add column base_undelivered_cost_minor bigint,
  add column refusal_charge_minor bigint not null default 0 check (refusal_charge_minor >= 0),
  add column base_refusal_charge_minor bigint not null default 0;
update public.store_commerce_facts set base_delivery_fee_minor = delivery_fee_minor, base_vat_added_profit_bps = vat_added_profit_bps,
  base_undelivered_cost_minor = undelivered_cost_minor;
update public.store_commerce_facts set refusal_charge_minor = 500, base_refusal_charge_minor = 500 where store_code = 'eg';
alter table public.store_commerce_facts alter column base_delivery_fee_minor set not null, alter column base_vat_added_profit_bps set not null,
  alter column base_undelivered_cost_minor set not null;

-- Dearest delivery fee a delivery_fee fact names (one flat amount, or the dearest zone).
create function public.taager_fact_max_fee(p_value jsonb) returns bigint language sql immutable set search_path = '' as $$
  select nullif(greatest(
    case when (p_value->>'flat_minor') ~ '^[0-9]{1,15}$' then (p_value->>'flat_minor')::bigint else 0 end,
    coalesce((select max((z->>'fee_minor')::bigint) from jsonb_array_elements(case when jsonb_typeof(p_value->'zones') = 'array' then p_value->'zones' else '[]'::jsonb end) z
               where (z->>'fee_minor') ~ '^[0-9]{1,15}$'), 0)), 0)
$$;

-- Re-derive the price guards' figures from the baseline and the stored facts. A figure far outside what is plausible
-- (a misread page) is ignored here and stays in the owner's list.
create function public.taager_facts_apply(p_store text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.store_commerce_facts;
  v_fee bigint; v_vat integer; v_ref bigint; v_und bigint; x bigint; v_rate integer;
begin
  select * into c from public.store_commerce_facts where store_code = p_store for update;
  if not found then raise exception 'unknown_store' using errcode = '22023'; end if;
  v_fee := c.base_delivery_fee_minor; v_vat := c.base_vat_added_profit_bps; v_ref := c.base_refusal_charge_minor;
  -- Used facts replace ours. When the newest reading waits or was rejected, the last one the owner confirmed stays in force.
  select public.taager_fact_max_fee(value) into x from public.taager_market_facts where market = p_store and fact_key = 'delivery_fee' and decision in ('agrees','confirmed') and (is_current or decision = 'confirmed')
   order by is_current desc, last_seen_at desc limit 1;
  if x is not null and x between c.base_delivery_fee_minor / 5 and c.base_delivery_fee_minor * 5 then v_fee := x; end if;
  x := null;
  select (value->>'on_added_profit_bps')::bigint into x from public.taager_market_facts where market = p_store and fact_key = 'vat' and decision in ('agrees','confirmed') and (is_current or decision = 'confirmed')
     and (value->>'on_added_profit_bps') ~ '^[0-9]{1,5}$' order by is_current desc, last_seen_at desc limit 1;
  if x is not null and x <= 3000 then v_vat := x; end if;
  x := null;
  select max(v) into x from (
    select distinct on (fact_key) case fact_key when 'refusal_fee' then (value->>'fee_minor')::bigint else (value->>'shipped_minor')::bigint end as v
    from public.taager_market_facts where market = p_store and fact_key in ('refusal_fee','return_fee') and decision in ('agrees','confirmed') and (is_current or decision = 'confirmed')
      and (case fact_key when 'refusal_fee' then value->>'fee_minor' else value->>'shipped_minor' end) ~ '^[0-9]{1,15}$'
    order by fact_key, is_current desc, last_seen_at desc) t;
  if x is not null and x <= c.base_delivery_fee_minor then v_ref := x; end if;
  x := null;
  -- Waiting facts are used only where they cost us more.
  select public.taager_fact_max_fee(value) into x from public.taager_market_facts where market = p_store and fact_key = 'delivery_fee' and is_current and decision = 'pending';
  if x is not null and x > v_fee and x <= c.base_delivery_fee_minor * 5 then v_fee := x; end if;
  x := null;
  select (value->>'on_added_profit_bps')::bigint into x from public.taager_market_facts where market = p_store and fact_key = 'vat' and is_current and decision = 'pending' and (value->>'on_added_profit_bps') ~ '^[0-9]{1,5}$';
  if x is not null and x > v_vat and x <= 3000 then v_vat := x; end if;
  x := null;
  select max(case fact_key when 'refusal_fee' then (value->>'fee_minor')::bigint else (value->>'shipped_minor')::bigint end) into x from public.taager_market_facts
   where market = p_store and fact_key in ('refusal_fee','return_fee') and is_current and decision = 'pending'
     and (case fact_key when 'refusal_fee' then value->>'fee_minor' else value->>'shipped_minor' end) ~ '^[0-9]{1,15}$';
  if x is not null and x > v_ref and x <= c.base_delivery_fee_minor then v_ref := x; end if;
  -- Expected cost of undelivered orders carried by each delivered one. Unchanged charge: the baseline figure stays.
  if v_ref = c.base_refusal_charge_minor then v_und := c.base_undelivered_cost_minor;
  else
    select coalesce(delivery_rate_bps, 5000) into v_rate from public.brain_settings where store_code = p_store;
    v_rate := least(greatest(coalesce(v_rate, 5000), 1000), 10000);
    v_und := ceil(v_ref::numeric * (10000 - v_rate) / v_rate)::bigint;
  end if;
  if v_fee is distinct from c.delivery_fee_minor then insert into public.store_commerce_facts_log(store_code, field, value, changed_by) values (p_store, 'delivery_fee_minor', v_fee::text, auth.uid()); end if;
  if v_vat is distinct from c.vat_added_profit_bps then insert into public.store_commerce_facts_log(store_code, field, value, changed_by) values (p_store, 'vat_added_profit_bps', v_vat::text, auth.uid()); end if;
  if v_ref is distinct from c.refusal_charge_minor then insert into public.store_commerce_facts_log(store_code, field, value, changed_by) values (p_store, 'refusal_charge_minor', v_ref::text, auth.uid()); end if;
  update public.store_commerce_facts set delivery_fee_minor = v_fee, vat_added_profit_bps = v_vat, refusal_charge_minor = v_ref, undelivered_cost_minor = v_und where store_code = p_store;
  return jsonb_build_object('delivery_fee_minor', v_fee, 'vat_added_profit_bps', v_vat, 'refusal_charge_minor', v_ref, 'undelivered_cost_minor', v_und);
end $$;

-- Owner import: the cleaned pages of one market and the facts read from them (both prepared in the owner's browser).
create function public.taager_pages_import(p_store text, p_pages jsonb, p_facts jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  p jsonb; f jsonb; old public.taager_info_pages; cur public.taager_market_facts; c public.store_commerce_facts;
  v_new integer := 0; v_changed integer := 0; v_same integer := 0; v_fact_changed integer := 0; v_hash text; v_decision text; v_x bigint;
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  if jsonb_typeof(p_pages) is distinct from 'array' or jsonb_array_length(p_pages) > 12 or jsonb_typeof(coalesce(p_facts, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_facts, '[]'::jsonb)) > 20 then
    raise exception 'invalid_payload' using errcode = '22023'; end if;
  select * into c from public.store_commerce_facts where store_code = p_store;
  if not found then raise exception 'unknown_store' using errcode = '22023'; end if;
  for p in select * from jsonb_array_elements(p_pages) loop
    if coalesce(p->>'path', '') !~ ('^/' || p_store || '/[A-Za-z0-9/_-]{1,120}$')
       or p->>'path' ~* '(auth|token|login|logout|otp|password|wallet|payout|withdraw|payment|bank|transaction|kyc|profile|account|user|phone|email|notification|order)' then
      raise exception 'page_not_allowed: %', left(coalesce(p->>'path', ''), 80) using errcode = '22023'; end if;
    if length(coalesce(p->>'text', '')) not between 20 and 60000 then raise exception 'page_text_out_of_range' using errcode = '22023'; end if;
    if (p->>'text') ~ '[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' or coalesce(p->'api', '[]'::jsonb)::text ~ '[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' then
      raise exception 'personal_data_in_page' using errcode = '22023'; end if;
    v_hash := md5(p->>'text');
    select * into old from public.taager_info_pages where market = p_store and path = p->>'path' order by version desc limit 1;
    if found and old.content_hash = v_hash then
      update public.taager_info_pages set last_seen_at = now(), read_at = coalesce(nullif(p->>'read_at', '')::timestamptz, read_at) where id = old.id;
      v_same := v_same + 1;
    else
      insert into public.taager_info_pages(market, path, version, title, body, links, api, content_hash, read_at, imported_by)
      values (p_store, p->>'path', coalesce(old.version, 0) + 1, left(coalesce(p->>'title', ''), 200), p->>'text',
        case when jsonb_typeof(p->'links') = 'array' then p->'links' else '[]'::jsonb end, case when jsonb_typeof(p->'api') = 'array' then p->'api' else '[]'::jsonb end,
        v_hash, nullif(p->>'read_at', '')::timestamptz, auth.uid());
      if old.id is null then v_new := v_new + 1; else v_changed := v_changed + 1; end if;
    end if;
  end loop;
  for f in select * from jsonb_array_elements(coalesce(p_facts, '[]'::jsonb)) loop
    if jsonb_typeof(f->'value') is distinct from 'object' or coalesce(f->>'source_path', '') !~ ('^/' || p_store || '/') then raise exception 'invalid_fact' using errcode = '22023'; end if;
    v_decision := case when f->>'decision' = 'agrees' then 'agrees' else 'pending' end;
    -- The figures the price guards use are judged here, not by the browser: only the planning figure itself "agrees".
    if f->>'key' = 'delivery_fee' then v_decision := case when public.taager_fact_max_fee(f->'value') = c.base_delivery_fee_minor and v_decision = 'agrees' then 'agrees' else 'pending' end;
    elsif f->>'key' = 'vat' then v_decision := case when (f->'value'->>'on_added_profit_bps') = c.base_vat_added_profit_bps::text then 'agrees' else 'pending' end;
    elsif f->>'key' in ('refusal_fee', 'return_fee') then
      v_x := case when coalesce(f->'value'->>'fee_minor', f->'value'->>'shipped_minor', '') ~ '^[0-9]{1,15}$' then coalesce(f->'value'->>'fee_minor', f->'value'->>'shipped_minor')::bigint end;
      v_decision := case when v_x = c.base_refusal_charge_minor then 'agrees' else 'pending' end;
    end if;
    select * into cur from public.taager_market_facts where market = p_store and fact_key = f->>'key' and is_current;
    if found and cur.value = f->'value' then
      update public.taager_market_facts set last_seen_at = now(), source_read_at = coalesce(nullif(f->>'source_read_at', '')::timestamptz, source_read_at),
        source_path = f->>'source_path', summary = left(coalesce(f->>'summary', ''), 600), quote = left(coalesce(f->>'quote', ''), 300) where id = cur.id;
    else
      if found then update public.taager_market_facts set is_current = false where id = cur.id; v_fact_changed := v_fact_changed + 1; end if;
      insert into public.taager_market_facts(market, fact_key, value, summary, quote, source_path, source_read_at, confidence, decision, previous_value, changed_at)
      values (p_store, f->>'key', f->'value', left(coalesce(f->>'summary', ''), 600), left(coalesce(f->>'quote', ''), 300), f->>'source_path',
        nullif(f->>'source_read_at', '')::timestamptz, case when f->>'confidence' = 'high' then 'high' else 'low' end,
        -- A fact that changed since the last sync always waits for the owner, unless it went back to our own figure.
        case when cur.id is not null and v_decision = 'agrees' and f->>'key' not in ('delivery_fee','vat','refusal_fee','return_fee') then 'pending' else v_decision end,
        cur.value, case when cur.id is not null then now() end);
    end if;
  end loop;
  return jsonb_build_object('pages_new', v_new, 'pages_changed', v_changed, 'pages_unchanged', v_same, 'facts_changed', v_fact_changed,
    'waiting', (select count(*) from public.taager_market_facts where market = p_store and is_current and decision = 'pending'),
    'guards', public.taager_facts_apply(p_store));
end $$;

-- Owner decision on one current fact: the page wins (confirmed) or is ignored (rejected). Either can be changed later.
create function public.taager_fact_decide(p_store text, p_fact uuid, p_decision text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_decision not in ('confirmed', 'rejected') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  update public.taager_market_facts set decision = p_decision, decided_at = now(), decided_by = auth.uid()
   where id = p_fact and market = p_store and is_current;
  if not found then raise exception 'unknown_fact' using errcode = '22023'; end if;
  return public.taager_facts_apply(p_store);
end $$;

-- Owner view: current facts, the pages with their versions, and the figures the price guards use now.
create function public.taager_facts_overview(p_store text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'facts', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'key', f.fact_key, 'value', f.value, 'summary', f.summary, 'quote', f.quote, 'source_path', f.source_path,
        'source_read_at', f.source_read_at, 'confidence', f.confidence, 'decision', f.decision, 'previous_value', f.previous_value, 'changed_at', f.changed_at) order by f.fact_key)
      from public.taager_market_facts f where f.market = p_store and f.is_current), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'title', p.title, 'version', p.version, 'read_at', p.read_at, 'imported_at', p.imported_at,
        'last_seen_at', p.last_seen_at, 'characters', length(p.body)) order by p.path)
      from public.taager_info_pages p where p.market = p_store
        and p.version = (select max(q.version) from public.taager_info_pages q where q.market = p.market and q.path = p.path)), '[]'::jsonb),
    'guards', (select jsonb_build_object('delivery_fee_minor', c.delivery_fee_minor, 'base_delivery_fee_minor', c.base_delivery_fee_minor, 'vat_added_profit_bps', c.vat_added_profit_bps,
        'refusal_charge_minor', c.refusal_charge_minor, 'undelivered_cost_minor', c.undelivered_cost_minor) from public.store_commerce_facts c where c.store_code = p_store));
end $$;

-- Owner view: the two newest versions of one page, to see what changed.
create function public.taager_page_versions(p_store text, p_path text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by (x->>'version')::int desc) from (
    select jsonb_build_object('version', version, 'title', title, 'read_at', read_at, 'imported_at', imported_at, 'text', body) as x
    from public.taager_info_pages where market = p_store and path = p_path order by version desc limit 2) t), '[]'::jsonb);
end $$;

-- Shoppers and the storefront: only what is true for the customer, only facts in use, never who the supplier is.
create function public.public_market_facts(p_store text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'delivery_fee', (select jsonb_build_object('flat_minor', f.value->'flat_minor',
        'zones', (select jsonb_agg(jsonb_build_object('places', z->'places', 'fee_minor', z->'fee_minor')) from jsonb_array_elements(case when jsonb_typeof(f.value->'zones') = 'array' then f.value->'zones' else '[]'::jsonb end) z))
      from public.taager_market_facts f where f.market = p_store and f.fact_key = 'delivery_fee' and f.is_current and f.decision in ('agrees','confirmed')),
    'delivery_days', (select jsonb_build_object('min', f.value->'min_days', 'max', f.value->'max_days')
      from public.taager_market_facts f where f.market = p_store and f.fact_key = 'delivery_time' and f.is_current and f.decision in ('agrees','confirmed')),
    'returns', (select jsonb_build_object('days', f.value->'days', 'defect_only', coalesce(f.value->'defect_only', 'false'::jsonb))
      from public.taager_market_facts f where f.market = p_store and f.fact_key = 'return_window' and f.is_current and f.decision in ('agrees','confirmed')),
    'open_before_paying', (select f.value->'open_before_paying'
      from public.taager_market_facts f where f.market = p_store and f.fact_key = 'cod' and f.is_current and f.decision in ('agrees','confirmed')))
  where p_store in ('sa','ae','om','eg','iq')
$$;

revoke all on function public.taager_fact_max_fee(jsonb), public.taager_facts_apply(text), public.taager_pages_import(text, jsonb, jsonb), public.taager_fact_decide(text, uuid, text),
  public.taager_facts_overview(text), public.taager_page_versions(text, text), public.public_market_facts(text) from public, anon, authenticated;
grant execute on function public.taager_pages_import(text, jsonb, jsonb), public.taager_fact_decide(text, uuid, text), public.taager_facts_overview(text), public.taager_page_versions(text, text) to authenticated;
grant execute on function public.taager_facts_apply(text), public.taager_fact_max_fee(jsonb) to service_role;
grant execute on function public.public_market_facts(text) to anon, authenticated, service_role;
