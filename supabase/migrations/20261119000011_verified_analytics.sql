create function public.ingest_verified_order_event(p_store text,p_event uuid,p_order uuid,p_type text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_type is null or p_type not in ('order_submitted','order_delivered') then raise exception 'Invalid event'; end if;
 if not exists(select 1 from public.orders where store_code=p_store and id=p_order and (p_type='order_submitted' or status='delivered')) then raise exception 'Order not verified'; end if;
 insert into public.commerce_analytics_events(store_code,event_id,event_type,order_id,occurred_at)
 values(p_store,p_event,p_type,p_order,now()) on conflict(store_code,event_id) do nothing;
end $$;
revoke all on function public.ingest_verified_order_event(text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ingest_verified_order_event(text,uuid,uuid,text) to service_role;
