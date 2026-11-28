-- WhatsApp assistant support (session 3, step 10). One WhatsApp Business number for the five stores.
-- Nothing here stores a phone number or a message: incoming message ids are remembered for a week (so a delivery
-- Meta retries is answered once), an order is found only by its number TOGETHER WITH the keyed hash of the phone
-- that wrote, and the confirmation tap the order-quality filter asks for is recorded per order.
-- The adapter is behind a flag (WHATSAPP_ENABLED) and no number is configured.

create table public.whatsapp_seen (
  message_id text primary key check (length(message_id) between 1 and 200),
  seen_at timestamptz not null default now()
);
-- Orders waiting for the customer's WhatsApp confirmation (one undelivered order in the last 90 days).
create table public.order_confirmations (
  store_code text not null references public.stores(code),
  order_ref text not null check (length(order_ref) between 1 and 120),
  phone_hash text not null check (phone_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'awaiting' check (status in ('awaiting', 'confirmed', 'expired')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  primary key (store_code, order_ref)
);
alter table public.whatsapp_seen enable row level security;
alter table public.order_confirmations enable row level security;
revoke all on public.whatsapp_seen, public.order_confirmations from public, anon, authenticated;
grant select, insert, update, delete on public.whatsapp_seen, public.order_confirmations to service_role;

-- True the first time a message id is seen; false for a repeat. Old ids are cleaned as it goes.
create function public.whatsapp_seen_once(p_message_id text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  delete from public.whatsapp_seen where seen_at < now() - interval '7 days';
  insert into public.whatsapp_seen(message_id) values (left(p_message_id, 200)) on conflict do nothing;
  return found;
end $$;

-- An order's state for the phone that placed it (any store). Null when the number and the phone do not belong together.
create function public.order_status_lookup(p_order_number text, p_phone_hash text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('store', o.store_code, 'status', o.status, 'order_number', o.order_number)
    from public.order_tracking o
   where o.phone_hash = p_phone_hash and (o.order_number = p_order_number or o.woo_order_id::text = p_order_number)
   order by o.placed_at desc limit 1
$$;

-- The confirmation tap: only the phone the order was placed with can confirm it, once, within 3 days.
create function public.order_whatsapp_confirm(p_order_ref text, p_phone_hash text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_store text;
begin
  update public.order_confirmations set status = 'expired' where status = 'awaiting' and created_at < now() - interval '3 days';
  update public.order_confirmations set status = 'confirmed', confirmed_at = now()
   where order_ref = p_order_ref and phone_hash = p_phone_hash and status = 'awaiting' returning store_code into v_store;
  return jsonb_build_object('confirmed', v_store is not null, 'store', v_store);
end $$;

-- order_gate now also opens the confirmation it asks for (same decisions as before).
create or replace function public.order_gate(p_store text, p_phone_hash text, p_browser_hash text, p_basket_hash text, p_order_ref text, p_name_problem text, p_summary jsonb default '{}'::jsonb)
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
  elsif v_action = 'confirm_whatsapp' then
    insert into public.order_confirmations(store_code, order_ref, phone_hash) values (p_store, left(p_order_ref, 120), p_phone_hash)
    on conflict (store_code, order_ref) do nothing;
  end if;
  delete from public.order_attempts where created_at < now() - interval '7 days';
  return jsonb_build_object('action', v_action, 'reasons', to_jsonb(v_reasons), 'undelivered_90d', v_undelivered);
end $$;
revoke all on function public.whatsapp_seen_once(text), public.order_status_lookup(text, text), public.order_whatsapp_confirm(text, text), public.order_gate(text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.whatsapp_seen_once(text), public.order_status_lookup(text, text), public.order_whatsapp_confirm(text, text), public.order_gate(text, text, text, text, text, text, jsonb) to service_role;
