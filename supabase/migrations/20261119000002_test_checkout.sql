create function public.create_commerce_order(p_store text,p_key text,p_lines jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_total bigint; v_count integer; v_existing jsonb; v_requested jsonb;
begin
 if p_key is null or length(p_key) not between 16 and 128 then raise exception 'invalid checkout key'; end if;
 if p_lines is null or jsonb_typeof(p_lines) <> 'array' then raise exception 'invalid lines'; end if;
 if jsonb_array_length(p_lines) not between 1 and 50 then raise exception 'invalid line count'; end if;
 if exists(select 1 from jsonb_to_recordset(p_lines) as x(variant_id uuid,quantity integer) where variant_id is null or quantity is null or quantity not between 1 and 20) then raise exception 'invalid lines'; end if;
 if (select count(distinct variant_id) from jsonb_to_recordset(p_lines) as x(variant_id uuid,quantity integer)) <> jsonb_array_length(p_lines) then raise exception 'duplicate variant'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_store || ':' || p_key,0));
 select id into v_id from public.orders where store_code=p_store and checkout_key=p_key;
 if found then
   select jsonb_agg(jsonb_build_object('variant_id',variant_id,'quantity',quantity) order by variant_id) into v_existing from public.order_lines where store_code=p_store and order_id=v_id;
   select jsonb_agg(jsonb_build_object('variant_id',variant_id,'quantity',quantity) order by variant_id) into v_requested from jsonb_to_recordset(p_lines) as x(variant_id uuid,quantity integer);
   if v_existing is distinct from v_requested then raise exception 'checkout key conflict'; end if;
   return v_id;
 end if;
 perform 1 from public.stores where code=p_store and checkout_enabled and not fulfillment_enabled for share;
 if not found then raise exception 'test checkout disabled'; end if;
 perform 1 from public.listing_variants v join public.country_listings l on l.store_code=v.store_code and l.id=v.listing_id join jsonb_to_recordset(p_lines) as x(variant_id uuid,quantity integer) on x.variant_id=v.id where v.store_code=p_store order by v.id for share of v,l;
 select count(*),sum(v.price_minor*x.quantity) into v_count,v_total
 from jsonb_to_recordset(p_lines) as x(variant_id uuid,quantity integer)
 join public.listing_variants v on v.id=x.variant_id and v.store_code=p_store
 join public.country_listings l on l.store_code=v.store_code and l.id=v.listing_id
 where l.status='published' and v.stock_state='available' and v.stock_checked_at between now()-interval '15 minutes' and now();
 if v_count <> jsonb_array_length(p_lines) then raise exception 'unavailable item'; end if;
 insert into public.orders(store_code,checkout_key,total_minor) values(p_store,p_key,v_total) returning id into v_id;
 insert into public.order_lines(store_code,order_id,variant_id,quantity,unit_minor)
 select p_store,v_id,v.id,x.quantity,v.price_minor from jsonb_to_recordset(p_lines) as x(variant_id uuid,quantity integer) join public.listing_variants v on v.id=x.variant_id and v.store_code=p_store;
 insert into public.commerce_outbox(store_code,order_id,event_type,status) values(p_store,v_id,'test_order_created','quarantined');
 return v_id;
end $$;
revoke all on function public.create_commerce_order(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_commerce_order(text,text,jsonb) to service_role;
