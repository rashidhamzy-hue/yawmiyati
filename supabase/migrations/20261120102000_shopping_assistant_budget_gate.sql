-- Public shopping assistant: explicit opt-in for paid model use, separate from owner content AI.
-- Defaults disable paid provider calls for every market.
create table public.shopping_assistant_policy (
 store_code text primary key references public.stores(code),
 enabled boolean not null default false,
 daily_request_cap integer not null default 0 check(daily_request_cap between 0 and 500),
 minute_request_cap integer not null default 0 check(minute_request_cap between 0 and 30)
);
insert into public.shopping_assistant_policy(store_code) select code from public.stores;
create table public.shopping_assistant_day_usage (
 store_code text not null references public.stores(code),
 usage_day date not null,
 request_count integer not null default 0 check(request_count>=0),
 primary key(store_code,usage_day)
);
create table public.shopping_assistant_minute_usage (
 store_code text not null references public.stores(code),
 bucket timestamptz not null,
 request_count integer not null default 0 check(request_count>=0),
 primary key(store_code,bucket)
);
alter table public.shopping_assistant_policy enable row level security;
alter table public.shopping_assistant_day_usage enable row level security;
alter table public.shopping_assistant_minute_usage enable row level security;
revoke all on public.shopping_assistant_policy,public.shopping_assistant_day_usage,public.shopping_assistant_minute_usage from public,anon,authenticated;
create function public.reserve_shopping_assistant_request(p_store text)
returns boolean language plpgsql security definer set search_path='' as $$
declare p public.shopping_assistant_policy%rowtype; current_day date := (now() at time zone 'UTC')::date; current_minute timestamptz := date_trunc('minute',now()); n_day integer; n_minute integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception using errcode='42501',message='Unauthorized'; end if;
 if p_store is null or p_store not in ('sa','ae','om','eg','iq') then return false; end if;
 perform pg_advisory_xact_lock(hashtext('yawmiyati_assistant'),hashtext(p_store));
 select * into p from public.shopping_assistant_policy where store_code=p_store;
 if not found or not p.enabled or p.daily_request_cap<=0 or p.minute_request_cap<=0 then return false; end if;
 select request_count into n_day from public.shopping_assistant_day_usage where store_code=p_store and usage_day=current_day;
 select request_count into n_minute from public.shopping_assistant_minute_usage where store_code=p_store and bucket=current_minute;
 if coalesce(n_day,0)>=p.daily_request_cap or coalesce(n_minute,0)>=p.minute_request_cap then return false; end if;
 insert into public.shopping_assistant_day_usage(store_code,usage_day,request_count) values(p_store,current_day,1)
 on conflict(store_code,usage_day) do update set request_count=public.shopping_assistant_day_usage.request_count+1;
 insert into public.shopping_assistant_minute_usage(store_code,bucket,request_count) values(p_store,current_minute,1)
 on conflict(store_code,bucket) do update set request_count=public.shopping_assistant_minute_usage.request_count+1;
 return true;
end $$;
revoke all on function public.reserve_shopping_assistant_request(text) from public,anon,authenticated;
grant execute on function public.reserve_shopping_assistant_request(text) to service_role;
-- Never enable policy automatically. Owner approval and model-price verification required.
