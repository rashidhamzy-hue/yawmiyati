alter table public.catalog_import_candidates add column supplier_snapshot jsonb not null default '{}'::jsonb;
create function public.stage_sa_supplier_candidates(p_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members where user_id=auth.uid() and store_code='sa') then
  raise exception using errcode='42501',message='Access denied';
 end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or octet_length(p_rows::text)>1500000 then raise exception 'Invalid batch'; end if;
 if jsonb_array_length(p_rows) not between 1 and 20 then raise exception 'Invalid batch size'; end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as x(woo_product_id bigint,supplier_sku text,title text,observed_price_minor bigint,observed_stock text,observed_at timestamptz,supplier_snapshot jsonb)
 where x.woo_product_id is null or x.woo_product_id<=0 or x.supplier_sku is null or length(btrim(x.supplier_sku)) not between 1 and 200 or x.title is null or length(btrim(x.title)) not between 1 and 500
 or x.observed_price_minor<0 or x.observed_stock is null or x.observed_stock not in ('unknown','unavailable')
 or x.observed_at is null or x.observed_at not between now()-interval '5 minutes' and now()+interval '30 seconds'
 or jsonb_typeof(x.supplier_snapshot) is distinct from 'object' or octet_length(x.supplier_snapshot::text)>70000) then raise exception 'Invalid candidate'; end if;
 insert into public.catalog_import_candidates as c(store_code,woo_product_id,woo_variation_id,supplier_sku,title,observed_price_minor,observed_stock,observed_at,supplier_snapshot)
 select 'sa',x.woo_product_id,0,x.supplier_sku,x.title,x.observed_price_minor,x.observed_stock,x.observed_at,x.supplier_snapshot
 from jsonb_to_recordset(p_rows) as x(woo_product_id bigint,supplier_sku text,title text,observed_price_minor bigint,observed_stock text,observed_at timestamptz,supplier_snapshot jsonb)
 on conflict(store_code,woo_product_id,woo_variation_id) do update set supplier_sku=excluded.supplier_sku,title=excluded.title,observed_price_minor=excluded.observed_price_minor,observed_stock=excluded.observed_stock,observed_at=excluded.observed_at,supplier_snapshot=excluded.supplier_snapshot
 where excluded.observed_at>c.observed_at;
 get diagnostics affected=row_count;
 return affected;
end $$;
revoke all on function public.stage_sa_supplier_candidates(jsonb) from public,anon,authenticated;
grant execute on function public.stage_sa_supplier_candidates(jsonb) to authenticated;
create function public.dashboard_import_candidates(p_store text,p_limit integer default 50)
returns table(woo_product_id bigint,supplier_sku text,title text,observed_price_minor text,observed_stock text,observed_at timestamptz,source_stock_status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members where user_id=auth.uid() and store_code=p_store) then raise exception using errcode='42501',message='Access denied'; end if;
 return query select c.woo_product_id,c.supplier_sku,c.title,c.observed_price_minor::text,c.observed_stock,c.observed_at,c.supplier_snapshot->>'stock_status' from public.catalog_import_candidates c where c.store_code=p_store order by c.observed_at desc,c.woo_product_id limit least(greatest(coalesce(p_limit,50),1),100);
end $$;
revoke all on function public.dashboard_import_candidates(text,integer) from public,anon,authenticated;
grant execute on function public.dashboard_import_candidates(text,integer) to authenticated;
