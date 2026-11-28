-- Customer blacklist and order-quality filter (session 3, step 7).
-- The ONLY customer-related data the brain keeps: a keyed one-way hash of the normalised phone number with counts of
-- undelivered orders (refused, returned, unreachable) taken from order_tracking, plus the owner's unblock time.
-- No name, address, raw phone or browsing history. The hash key lives in the edge functions' secrets (BLACKLIST_HASH_KEY).
--   1 undelivered order in 90 days  → the next order needs a WhatsApp confirmation tap
--   2 or more                       → the order form politely refuses (the owner can unblock in /admin)
-- Order-quality filter before an order may reach the supplier: duplicate basket, invalid name, too many attempts per
-- phone or per browser in an hour → the order waits in an /admin queue. order_gate is called by the order form's
-- server step (G3); nothing here submits an order.

create table public.customer_risk (
  phone_hash text primary key check (phone_hash ~ '^[0-9a-f]{64}$'),
  unblocked_at timestamptz,
  unblocked_by uuid,
  note text check (length(note) <= 200),
  updated_at timestamptz not null default now()
);
-- Attempts of the last days, for rate limits and duplicate detection (hashes only; cleaned after 7 days).
create table public.order_attempts (
  id bigint generated always as identity primary key,
  store_code text not null references public.stores(code),
  phone_hash text not null check (phone_hash ~ '^[0-9a-f]{64}$'),
  browser_hash text check (browser_hash ~ '^[0-9a-f]{64}$'),
  basket_hash text not null check (basket_hash ~ '^[0-9a-f]{64}$'),
  decision text not null,
  created_at timestamptz not null default now()
);
create index order_attempts_phone on public.order_attempts(phone_hash, created_at);
create index order_attempts_browser on public.order_attempts(browser_hash, created_at) where browser_hash is not null;
-- Orders waiting for the owner. order_ref points at the pending order kept by the order form's own table (G3).
create table public.order_quality_queue (
  id uuid primary key default gen_random_uuid(),
  store_code text not null references public.stores(code),
  order_ref text not null check (length(order_ref) between 1 and 120),
  phone_hash text not null check (phone_hash ~ '^[0-9a-f]{64}$'),
  reasons text[] not null check (cardinality(reasons) between 1 and 6),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),  -- items and total only
  status text not null default 'waiting' check (status in ('waiting', 'released', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_by uuid, decided_at timestamptz,
  unique (store_code, order_ref)
);
alter table public.customer_risk enable row level security;
alter table public.order_attempts enable row level security;
alter table public.order_quality_queue enable row level security;
revoke all on public.customer_risk, public.order_attempts, public.order_quality_queue from public, anon, authenticated;
grant select, insert, update, delete on public.customer_risk, public.order_attempts, public.order_quality_queue to service_role;

-- Undelivered orders of one phone hash in the last 90 days, across all five stores, since the owner's last unblock.
create function public.customer_undelivered(p_phone_hash text) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.order_tracking o
   where o.phone_hash = p_phone_hash and o.status in ('refused', 'returned', 'unreachable')
     and coalesce(o.closed_at, o.modified_at) > now() - interval '90 days'
     and coalesce(o.closed_at, o.modified_at) > coalesce((select r.unblocked_at from public.customer_risk r where r.phone_hash = p_phone_hash), '-infinity'::timestamptz)
$$;

-- Service role: one decision for an order attempt. p_name_problem and the phone's validity come from the same pure
-- rules in the server code (order-quality.ts); counts and the blacklist come from here. Every attempt is recorded
-- (hashes only), and a held order is queued for the owner.
create function public.order_gate(p_store text, p_phone_hash text, p_browser_hash text, p_basket_hash text, p_order_ref text, p_name_problem text, p_summary jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_undelivered integer; v_phone integer; v_browser integer; v_same integer; v_reasons text[] := '{}'; v_action text;
begin
  if not exists (select 1 from public.stores where code = p_store) then raise exception 'unknown_store' using errcode = '22023'; end if;
  v_undelivered := public.customer_undelivered(p_phone_hash);
  select count(*) into v_phone from public.order_attempts a where a.phone_hash = p_phone_hash and a.created_at > now() - interval '1 hour';
  select count(*) into v_browser from public.order_attempts a where p_browser_hash is not null and a.browser_hash = p_browser_hash and a.created_at > now() - interval '1 hour';
  select count(*) into v_same from public.order_attempts a where a.phone_hash = p_phone_hash and a.basket_hash = p_basket_hash and a.store_code = p_store
     and a.created_at > now() - interval '24 hours' and a.decision in ('allow', 'confirm_whatsapp', 'hold');
  if v_undelivered >= 2 then v_action := 'refuse';
  else
    if p_name_problem is not null then v_reasons := array_append(v_reasons, 'invalid_name'); end if;
    if v_same > 0 then v_reasons := array_append(v_reasons, 'duplicate_order'); end if;
    if v_phone >= 3 then v_reasons := array_append(v_reasons, 'too_many_orders_phone'); end if;
    if v_browser >= 4 then v_reasons := array_append(v_reasons, 'too_many_orders_browser'); end if;
    v_action := case when cardinality(v_reasons) > 0 then 'hold' when v_undelivered = 1 then 'confirm_whatsapp' else 'allow' end;
  end if;
  insert into public.order_attempts(store_code, phone_hash, browser_hash, basket_hash, decision) values (p_store, p_phone_hash, p_browser_hash, p_basket_hash, v_action);
  if v_action = 'hold' then
    insert into public.order_quality_queue(store_code, order_ref, phone_hash, reasons, summary)
    values (p_store, left(p_order_ref, 120), p_phone_hash, v_reasons, coalesce(p_summary, '{}'::jsonb) - 'name' - 'phone' - 'address' - 'email')
    on conflict (store_code, order_ref) do update set reasons = excluded.reasons, summary = excluded.summary;
  end if;
  delete from public.order_attempts where created_at < now() - interval '7 days';
  return jsonb_build_object('action', v_action, 'reasons', to_jsonb(v_reasons), 'undelivered_90d', v_undelivered);
end $$;
revoke all on function public.order_gate(text, text, text, text, text, text, jsonb), public.customer_undelivered(text) from public, anon, authenticated;
grant execute on function public.order_gate(text, text, text, text, text, text, jsonb), public.customer_undelivered(text) to service_role;

-- Owner: numbers that currently need a confirmation or are refused (hash prefix only), and the orders waiting.
create function public.brain_order_quality(p_store text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'queue', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'order_ref', q.order_ref, 'reasons', to_jsonb(q.reasons), 'summary', q.summary, 'created_at', q.created_at,
                 'customer', left(q.phone_hash, 8), 'undelivered_90d', public.customer_undelivered(q.phone_hash)) order by q.created_at)
               from public.order_quality_queue q where q.store_code = p_store and q.status = 'waiting'), '[]'::jsonb),
    'blacklist', coalesce((select jsonb_agg(to_jsonb(b) order by b.undelivered_90d desc, b.last_at desc) from (
        select left(o.phone_hash, 8) as customer, o.phone_hash as key, public.customer_undelivered(o.phone_hash) as undelivered_90d, max(coalesce(o.closed_at, o.modified_at)) as last_at,
               count(*) filter (where o.status = 'delivered') as delivered_all_time, bool_or(o.store_code = p_store) as this_store
          from public.order_tracking o where o.phone_hash is not null and o.status in ('refused', 'returned', 'unreachable', 'delivered')
         group by o.phone_hash having public.customer_undelivered(o.phone_hash) >= 1 limit 500) b where b.this_store), '[]'::jsonb),
    'rule', jsonb_build_object('window_days', 90, 'confirm_at', 1, 'refuse_at', 2));
end $$;
-- Owner: let a number order again. Counting restarts from now; nothing is deleted from the order history.
create function public.brain_customer_unblock(p_store text, p_phone_hash text, p_note text default null) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_phone_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_customer' using errcode = '22023'; end if;
  if not exists (select 1 from public.order_tracking o where o.phone_hash = p_phone_hash and o.store_code = p_store) then raise exception 'unknown_customer' using errcode = '22023'; end if;
  insert into public.customer_risk(phone_hash, unblocked_at, unblocked_by, note) values (p_phone_hash, now(), auth.uid(), left(p_note, 200))
  on conflict (phone_hash) do update set unblocked_at = now(), unblocked_by = auth.uid(), note = left(p_note, 200), updated_at = now();
  return true;
end $$;
-- Owner: release a held order to the normal flow, or cancel it. The order form's server step (G3) reads the status.
create function public.brain_order_queue_decide(p_store text, p_id uuid, p_decision text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_ref text;
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_decision not in ('released', 'cancelled') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  update public.order_quality_queue set status = p_decision, decided_by = auth.uid(), decided_at = now()
   where store_code = p_store and id = p_id and status = 'waiting' returning order_ref into v_ref;
  if v_ref is null then raise exception 'unknown_or_decided' using errcode = '22023'; end if;
  return jsonb_build_object('order_ref', v_ref, 'status', p_decision);
end $$;
revoke all on function public.brain_order_quality(text), public.brain_customer_unblock(text, text, text), public.brain_order_queue_decide(text, uuid, text) from public, anon;
grant execute on function public.brain_order_quality(text), public.brain_customer_unblock(text, text, text), public.brain_order_queue_decide(text, uuid, text) to authenticated;
