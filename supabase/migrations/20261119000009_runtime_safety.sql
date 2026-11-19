create function public.reserve_ai_job(p_store text,p_task text,p_key text,p_estimate bigint)
returns uuid language plpgsql security invoker set search_path='' as $$
declare pol public.ai_market_policy%rowtype; used numeric; job_id uuid;
begin
 if p_estimate is null or p_estimate<=0 or p_key is null or length(p_key) not between 1 and 128 then raise exception 'Invalid reservation'; end if;
 select * into pol from public.ai_market_policy where store_code=p_store for update;
 if not found or not pol.enabled or pol.daily_budget_microusd=0 then raise exception 'AI disabled'; end if;
 if exists(select 1 from public.ai_jobs where store_code=p_store and dedupe_key=p_key) then raise exception 'Duplicate job'; end if;
 select coalesce(sum(greatest(reserved_microusd,coalesce(actual_microusd,0))),0) into used from public.ai_jobs where store_code=p_store and (created_at>=date_trunc('day',now(),'UTC') or state in ('queued','running'));
 if used+p_estimate>pol.daily_budget_microusd then raise exception 'Budget exceeded'; end if;
 insert into public.ai_jobs(store_code,task,dedupe_key,state,reserved_microusd) values(p_store,p_task,p_key,'queued',p_estimate) returning id into job_id;
 return job_id;
end $$;
revoke all on function public.reserve_ai_job(text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.reserve_ai_job(text,text,text,bigint) to service_role;
create function public.dashboard_ai_policy(p_store text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members where user_id=auth.uid() and store_code=p_store) then raise exception using errcode='42501',message='Access denied'; end if;
 return (select to_jsonb(p) from public.ai_market_policy p where store_code=p_store);
end $$;
create function public.pause_market_ai(p_store text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members where user_id=auth.uid() and store_code=p_store) then raise exception using errcode='42501',message='Access denied'; end if;
 update public.ai_market_policy set enabled=false,auto_pricing_enabled=false,auto_publish_enabled=false where store_code=p_store;
 update public.ai_jobs set state='blocked' where store_code=p_store and state='queued';
end $$;
revoke all on function public.dashboard_ai_policy(text),public.pause_market_ai(text) from public,anon;
grant execute on function public.dashboard_ai_policy(text),public.pause_market_ai(text) to authenticated;
create table public.commerce_analytics_events (
 store_code text not null references public.stores(code),
 event_id uuid not null, event_type text not null check(event_type in ('product_view','add_to_cart','checkout_start','order_submitted','order_delivered')),
 listing_id uuid, order_id uuid, campaign_code text check(length(campaign_code)<=100),
 occurred_at timestamptz not null, primary key(store_code,event_id),
 foreign key(store_code,listing_id) references public.country_listings(store_code,id),
 foreign key(store_code,order_id) references public.orders(store_code,id)
);
alter table public.commerce_analytics_events enable row level security;
revoke all on public.commerce_analytics_events from anon,authenticated;
