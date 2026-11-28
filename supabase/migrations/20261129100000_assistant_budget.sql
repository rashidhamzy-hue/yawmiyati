-- Shopping assistant: a hard daily budget in US dollars per market and the measured cost of every paid call
-- (29 Nov 2026). Paid answers stay OFF: every policy row keeps enabled = false and a zero budget until the owner
-- switches a market on in /admin. Nothing about a visitor is stored: only per-day totals.
alter table public.shopping_assistant_policy
  drop constraint shopping_assistant_policy_daily_request_cap_check,
  add constraint shopping_assistant_policy_daily_request_cap_check check (daily_request_cap between 0 and 20000),
  add column daily_budget_microusd bigint not null default 0 check (daily_budget_microusd between 0 and 20000000),
  add column model text not null default 'claude-haiku-5-5' check (model in ('claude-haiku-5-5', 'claude-sonnet-5-5')),
  -- SHA-256 (hex) of a one-off test token: lets the builder test paid answers while visitors stay off. Null = no testing.
  add column eval_token_sha256 text check (eval_token_sha256 is null or eval_token_sha256 ~ '^[0-9a-f]{64}$'),
  add column updated_at timestamptz not null default now(),
  add column updated_by uuid;

create table public.shopping_assistant_spend (
  store_code text not null references public.stores(code),
  usage_day date not null,
  calls integer not null default 0 check (calls >= 0),
  discarded integer not null default 0 check (discarded >= 0),
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  reserved_microusd bigint not null default 0 check (reserved_microusd >= 0),
  cost_microusd bigint not null default 0 check (cost_microusd >= 0),
  primary key (store_code, usage_day)
);
alter table public.shopping_assistant_spend enable row level security;
revoke all on public.shopping_assistant_spend from public, anon, authenticated;

-- Reserve the worst-case cost of one answer before calling the model. Returns {ok, model} or {ok:false, reason}.
-- p_eval = true is the builder's test path: it needs a budget but not the visitor switch, and skips the request caps.
create function public.assistant_reserve(p_store text, p_estimate_microusd bigint, p_eval boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare p public.shopping_assistant_policy%rowtype; d date := (now() at time zone 'UTC')::date; s public.shopping_assistant_spend%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception using errcode = '42501', message = 'Unauthorized'; end if;
  if p_store is null or p_store not in ('sa','ae','om','eg','iq') or p_estimate_microusd is null or p_estimate_microusd <= 0 or p_estimate_microusd > 100000 then
    return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  perform pg_advisory_xact_lock(hashtext('yawmiyati_assistant_budget'), hashtext(p_store));
  select * into p from public.shopping_assistant_policy where store_code = p_store;
  if not found or p.daily_budget_microusd <= 0 then return jsonb_build_object('ok', false, 'reason', 'no_budget'); end if;
  if not coalesce(p_eval, false) then
    if not p.enabled then return jsonb_build_object('ok', false, 'reason', 'disabled'); end if;
    if not public.reserve_shopping_assistant_request(p_store) then return jsonb_build_object('ok', false, 'reason', 'request_cap'); end if;
  end if;
  insert into public.shopping_assistant_spend(store_code, usage_day) values (p_store, d) on conflict do nothing;
  select * into s from public.shopping_assistant_spend where store_code = p_store and usage_day = d for update;
  if s.cost_microusd + s.reserved_microusd + p_estimate_microusd > p.daily_budget_microusd then return jsonb_build_object('ok', false, 'reason', 'budget_spent'); end if;
  update public.shopping_assistant_spend set reserved_microusd = reserved_microusd + p_estimate_microusd where store_code = p_store and usage_day = d;
  return jsonb_build_object('ok', true, 'model', p.model, 'day', d);
end $$;

-- Record what the call really cost and release its reservation (always called, also after a failed or discarded answer).
create function public.assistant_settle(p_store text, p_day date, p_estimate_microusd bigint, p_input_tokens bigint, p_output_tokens bigint, p_cost_microusd bigint, p_discarded boolean default false) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception using errcode = '42501', message = 'Unauthorized'; end if;
  update public.shopping_assistant_spend
     set reserved_microusd = greatest(reserved_microusd - greatest(p_estimate_microusd, 0), 0),
         calls = calls + 1, discarded = discarded + case when coalesce(p_discarded, false) then 1 else 0 end,
         input_tokens = input_tokens + greatest(coalesce(p_input_tokens, 0), 0), output_tokens = output_tokens + greatest(coalesce(p_output_tokens, 0), 0),
         cost_microusd = cost_microusd + greatest(coalesce(p_cost_microusd, 0), 0)
   where store_code = p_store and usage_day = p_day;
end $$;

create function public.assistant_eval_allowed(p_store text, p_token_sha256 text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.role() = 'service_role' and exists (select 1 from public.shopping_assistant_policy p
    where p.store_code = p_store and p.eval_token_sha256 is not null and p.eval_token_sha256 = lower(p_token_sha256))
$$;
revoke all on function public.assistant_reserve(text, bigint, boolean), public.assistant_settle(text, date, bigint, bigint, bigint, bigint, boolean), public.assistant_eval_allowed(text, text) from public, anon, authenticated;
grant execute on function public.assistant_reserve(text, bigint, boolean), public.assistant_settle(text, date, bigint, bigint, bigint, bigint, boolean), public.assistant_eval_allowed(text, text) to service_role;

-- OWNER: the switch, the caps, and what was spent (last 30 days, US dollars).
create function public.assistant_owner_status(p_store text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select jsonb_build_object('enabled', p.enabled, 'daily_budget_usd', round(p.daily_budget_microusd / 1000000.0, 2), 'daily_request_cap', p.daily_request_cap,
      'minute_request_cap', p.minute_request_cap, 'model', p.model,
      'days', coalesce((select jsonb_agg(jsonb_build_object('day', s.usage_day, 'calls', s.calls, 'discarded', s.discarded,
                 'cost_usd', round(s.cost_microusd / 1000000.0, 4), 'input_tokens', s.input_tokens, 'output_tokens', s.output_tokens) order by s.usage_day desc)
               from public.shopping_assistant_spend s where s.store_code = p_store and s.usage_day > current_date - 30), '[]'::jsonb))
    from public.shopping_assistant_policy p where p.store_code = p_store);
end $$;
create function public.assistant_owner_set(p_store text, p_enabled boolean, p_daily_budget_usd numeric) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_daily_budget_usd is null or p_daily_budget_usd < 0 or p_daily_budget_usd > 20 then raise exception 'budget_must_be_0_to_20_usd' using errcode = '22023'; end if;
  if coalesce(p_enabled, false) and p_daily_budget_usd <= 0 then raise exception 'a_budget_is_needed_to_switch_on' using errcode = '22023'; end if;
  update public.shopping_assistant_policy
     set enabled = coalesce(p_enabled, false), daily_budget_microusd = round(p_daily_budget_usd * 1000000)::bigint,
         -- Request caps follow the budget: about 2,500 answers per dollar at the cheapest model, never more than 20 a minute.
         daily_request_cap = least(20000, greatest(case when p_daily_budget_usd > 0 then 50 else 0 end, round(p_daily_budget_usd * 2500)::integer)),
         minute_request_cap = case when p_daily_budget_usd > 0 then 20 else 0 end,
         updated_at = now(), updated_by = auth.uid()
   where store_code = p_store;
  return public.assistant_owner_status(p_store);
end $$;
revoke all on function public.assistant_owner_status(text), public.assistant_owner_set(text, boolean, numeric) from public, anon;
grant execute on function public.assistant_owner_status(text), public.assistant_owner_set(text, boolean, numeric) to authenticated;
notify pgrst, 'reload schema';
