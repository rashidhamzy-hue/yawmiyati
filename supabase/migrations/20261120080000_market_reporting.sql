create function public.dashboard_market_performance(p_store text,p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare start_at timestamptz; result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members m where m.user_id=auth.uid() and m.store_code=p_store) then
  raise exception using errcode='42501',message='Access denied';
 end if;
 if p_days is null or p_days not between 1 and 365 then raise exception 'Invalid reporting window'; end if;
 start_at:=now()-make_interval(days=>p_days);
 select jsonb_build_object(
  'store',p_store,'currency',s.currency,'window_days',p_days,
  'orders',(select jsonb_build_object(
   'recorded',count(*),'delivered',count(*) filter(where status='delivered'),
   'failed',count(*) filter(where status='failed'),'cancelled',count(*) filter(where status='cancelled'),
   'returned',count(*) filter(where status='returned'),'unknown',count(*) filter(where status='unknown'),
   'booked_total_minor',coalesce(sum(total_minor),0)::text
  ) from public.orders where store_code=p_store and created_at>=start_at),
  'ledger',(select jsonb_build_object('entries',count(*),'recorded_net_minor',coalesce(sum(amount_minor),0)::text)
   from public.financial_entries where store_code=p_store and occurred_at>=start_at),
  'marketing_observations',(select jsonb_build_object(
   'records',count(*),'impressions',coalesce(sum(impressions),0)::text,
   'clicks',coalesce(sum(clicks),0)::text,'submitted_orders',coalesce(sum(submitted_orders),0)::text,
   'delivered_orders',coalesce(sum(delivered_orders),0)::text,'spend_minor',coalesce(sum(spend_minor),0)::text)
   from public.marketing_observations where store_code=p_store and observed_at>=start_at),
  'warnings',jsonb_build_array('Order statuses do not establish cash settlement','Marketing observations may overlap or be incomplete','Recorded ledger net is not verified profit','No live checkout or dispatch is enabled')
 ) into result from public.stores s where s.code=p_store;
 return result;
end $$;
revoke all on function public.dashboard_market_performance(text,integer) from public,anon;
grant execute on function public.dashboard_market_performance(text,integer) to authenticated;
