-- Yawmiyati Brain, stage A (26 Nov 2026, owner-authorized):
-- supplier catalogue ingestion (Taager via WooCommerce), capability audit,
-- AI research and decisions with a per-step cost ledger, owner review.
-- Additive and market-isolated. Service role writes; owners read and decide
-- through membership-checked RPCs. Nothing here publishes products, changes
-- release flags, submits orders or spends outside the per-store daily cap.

create table public.brain_settings (
 store_code text primary key references public.stores(code),
 autopilot_enabled boolean not null default false,
 -- Owner approved $10/day while testing (26 Nov 2026).
 daily_budget_microusd bigint not null default 10000000 check (daily_budget_microusd between 0 and 100000000),
 research_model text not null default 'claude-haiku-5-5',
 content_model text not null default 'claude-sonnet-5-5',
 shortlist_size integer not null default 80 check (shortlist_size between 1 and 400),
 selection_size integer not null default 50 check (selection_size between 1 and 200),
 max_searches_per_product integer not null default 3 check (max_searches_per_product between 1 and 5),
 delivery_rate_bps integer check (delivery_rate_bps between 1000 and 10000),
 field_mapping jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
insert into public.brain_settings(store_code) select code from public.stores on conflict do nothing;

create table public.brain_runs (
 id uuid primary key default gen_random_uuid(),
 store_code text not null references public.stores(code),
 stage text not null default 'ingest' check (stage in ('ingest','audit','prefilter','research','decide','content','merchandise','review')),
 status text not null default 'running' check (status in ('running','paused_budget','awaiting_review','done','failed','cancelled')),
 cursor jsonb not null default '{}'::jsonb,
 progress jsonb not null default '{}'::jsonb,
 summary jsonb not null default '{}'::jsonb,
 error text,
 locked_until timestamptz,
 started_by uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 finished_at timestamptz
);
create index brain_runs_store_created on public.brain_runs(store_code, created_at desc);
-- One active run per store.
create unique index brain_runs_one_active on public.brain_runs(store_code) where status in ('running','paused_budget');

create table public.brain_cost_ledger (
 id bigint generated always as identity primary key,
 run_id uuid not null references public.brain_runs(id) on delete cascade,
 store_code text not null references public.stores(code),
 step text not null check (step in ('field_mapping','research','content','other')),
 item_ref text,
 model text not null,
 input_tokens bigint not null default 0 check (input_tokens >= 0),
 output_tokens bigint not null default 0 check (output_tokens >= 0),
 cache_read_tokens bigint not null default 0 check (cache_read_tokens >= 0),
 cache_write_tokens bigint not null default 0 check (cache_write_tokens >= 0),
 web_searches integer not null default 0 check (web_searches >= 0),
 cost_microusd bigint not null check (cost_microusd >= 0),
 created_at timestamptz not null default now()
);
create index brain_cost_store_day on public.brain_cost_ledger(store_code, created_at);
create index brain_cost_run on public.brain_cost_ledger(run_id);

-- Every Taager offer exactly as WooCommerce reports it (M11 ProviderOffer).
create table public.supplier_offers (
 store_code text not null references public.stores(code),
 provider text not null default 'taager_woo' check (provider in ('taager_woo')),
 product_id bigint not null check (product_id > 0),
 variation_id bigint not null default 0 check (variation_id >= 0),
 parent_id bigint,
 product_type text not null,
 status text,
 sku text,
 title text not null,
 currency text not null,
 price_minor bigint,
 regular_price_minor bigint,
 sale_price_minor bigint,
 stock_status text,
 stock_quantity integer,
 categories jsonb not null default '[]'::jsonb,
 attributes jsonb not null default '[]'::jsonb,
 images jsonb not null default '[]'::jsonb,
 videos jsonb not null default '[]'::jsonb,
 meta jsonb not null default '{}'::jsonb,
 description text,
 short_description text,
 raw jsonb not null,
 revision text not null,
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 last_run_id uuid references public.brain_runs(id) on delete set null,
 primary key (store_code, provider, product_id, variation_id)
);
create index supplier_offers_run on public.supplier_offers(store_code, last_run_id);

create table public.supplier_capability_reports (
 run_id uuid primary key references public.brain_runs(id) on delete cascade,
 store_code text not null references public.stores(code),
 report jsonb not null,
 created_at timestamptz not null default now()
);

create table public.brain_product_analysis (
 run_id uuid not null references public.brain_runs(id) on delete cascade,
 store_code text not null references public.stores(code),
 product_id bigint not null,
 variation_id bigint not null default 0,
 title text not null,
 family_key text,
 offer_kind text not null,
 category text,
 stage text not null check (stage in ('excluded','killed','shortlisted','researched','selected','not_selected')),
 prefilter_score numeric,
 score numeric,
 economics jsonb not null default '{}'::jsonb,
 research jsonb,
 decision jsonb,
 content jsonb,
 merchandising jsonb,
 reasons jsonb not null default '[]'::jsonb,
 flags jsonb not null default '[]'::jsonb,
 cost_microusd bigint not null default 0,
 owner_decision text check (owner_decision in ('approved','rejected')),
 decided_by uuid,
 decided_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key (run_id, product_id, variation_id)
);
create index brain_analysis_stage on public.brain_product_analysis(run_id, stage, score desc);

alter table public.brain_settings enable row level security;
alter table public.brain_runs enable row level security;
alter table public.brain_cost_ledger enable row level security;
alter table public.supplier_offers enable row level security;
alter table public.supplier_capability_reports enable row level security;
alter table public.brain_product_analysis enable row level security;
revoke all on public.brain_settings, public.brain_runs, public.brain_cost_ledger, public.supplier_offers,
 public.supplier_capability_reports, public.brain_product_analysis from anon, authenticated;

create function public.brain_is_member(p_store text) returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists(select 1 from public.dashboard_members where user_id = auth.uid() and store_code = p_store)
$$;

-- Today's spend (UTC day) for the budget gate; service role only.
create function public.brain_spent_today(p_store text) returns bigint
language sql stable security definer set search_path = '' as $$
 select coalesce(sum(cost_microusd), 0)::bigint from public.brain_cost_ledger
 where store_code = p_store and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'
$$;

-- Owner overview: settings, latest runs, today's spend, capability report, cost totals.
create function public.brain_dashboard(p_store text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_run uuid; result jsonb;
begin
 if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
 select id into v_run from public.brain_runs where store_code = p_store order by created_at desc limit 1;
 select jsonb_build_object(
  'settings', (select to_jsonb(s) - 'store_code' from public.brain_settings s where s.store_code = p_store),
  'spent_today_microusd', public.brain_spent_today(p_store),
  'runs', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'stage', r.stage, 'status', r.status, 'progress', r.progress,
     'summary', r.summary, 'error', r.error, 'created_at', r.created_at, 'finished_at', r.finished_at) order by r.created_at desc)
    from (select * from public.brain_runs where store_code = p_store order by created_at desc limit 5) r), '[]'::jsonb),
  'latest_run_id', v_run,
  'capability', (select report from public.supplier_capability_reports where run_id = v_run),
  'cost', (select jsonb_build_object('total_microusd', coalesce(sum(cost_microusd), 0), 'web_searches', coalesce(sum(web_searches), 0),
     'by_step', coalesce((select jsonb_object_agg(step, total) from (select step, sum(cost_microusd) total from public.brain_cost_ledger where run_id = v_run group by step) x), '{}'::jsonb))
    from public.brain_cost_ledger where run_id = v_run),
  'counts', coalesce((select jsonb_object_agg(stage, n) from (select stage, count(*) n from public.brain_product_analysis where run_id = v_run group by stage) c), '{}'::jsonb)
 ) into result;
 return result;
end $$;

create function public.brain_analysis_page(p_store text, p_run uuid, p_stage text default null, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
 if p_offset < 0 or p_offset > 100000 then raise exception 'invalid offset'; end if;
 return coalesce((select jsonb_agg(to_jsonb(a) - 'store_code' - 'run_id' order by a.score desc nulls last, a.prefilter_score desc nulls last)
  from (select * from public.brain_product_analysis
        where run_id = p_run and store_code = p_store and (p_stage is null or stage = p_stage)
        order by score desc nulls last, prefilter_score desc nulls last limit 50 offset p_offset) a), '[]'::jsonb);
end $$;

-- Approve or reject the brain's selected products (all, or a list). Records only: nothing is published here.
create function public.brain_decide(p_store text, p_run uuid, p_decision text, p_items jsonb default null)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare n integer;
begin
 if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
 update public.brain_product_analysis a set owner_decision = p_decision, decided_by = auth.uid(), decided_at = now(), updated_at = now()
 where a.run_id = p_run and a.store_code = p_store and a.stage = 'selected'
   and (p_items is null or exists (select 1 from jsonb_array_elements(p_items) i
        where (i->>'product_id')::bigint = a.product_id and coalesce((i->>'variation_id')::bigint, 0) = a.variation_id));
 get diagnostics n = row_count;
 update public.brain_runs set status = 'done', finished_at = coalesce(finished_at, now()), updated_at = now()
 where id = p_run and store_code = p_store and status = 'awaiting_review'
   and not exists (select 1 from public.brain_product_analysis where run_id = p_run and stage = 'selected' and owner_decision is null);
 return n;
end $$;

-- Owner settings the dashboard may change. Autopilot stays a recorded preference until the scheduler ships.
create function public.brain_update_settings(p_store text, p_patch jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
 if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
 update public.brain_settings set
  autopilot_enabled = coalesce((p_patch->>'autopilot_enabled')::boolean, autopilot_enabled),
  daily_budget_microusd = coalesce((p_patch->>'daily_budget_microusd')::bigint, daily_budget_microusd),
  shortlist_size = coalesce((p_patch->>'shortlist_size')::integer, shortlist_size),
  selection_size = coalesce((p_patch->>'selection_size')::integer, selection_size),
  updated_at = now()
 where store_code = p_store;
 return (select to_jsonb(s) - 'store_code' from public.brain_settings s where s.store_code = p_store);
end $$;

revoke all on function public.brain_is_member(text), public.brain_spent_today(text), public.brain_dashboard(text),
 public.brain_analysis_page(text, uuid, text, integer), public.brain_decide(text, uuid, text, jsonb),
 public.brain_update_settings(text, jsonb) from public, anon;
grant execute on function public.brain_is_member(text), public.brain_dashboard(text), public.brain_analysis_page(text, uuid, text, integer),
 public.brain_decide(text, uuid, text, jsonb), public.brain_update_settings(text, jsonb) to authenticated;
grant execute on function public.brain_spent_today(text) to service_role;
revoke all on function public.brain_spent_today(text) from authenticated; -- default grant removed: spend gate is service-only
