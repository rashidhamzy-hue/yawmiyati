create function public.dashboard_catalog(p_store text,p_limit integer default 50,p_offset integer default 0)
returns table(listing_id uuid,slug text,title text,listing_status text,variant_count bigint,available_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members m where m.user_id=auth.uid() and m.store_code=p_store) then
 raise exception using errcode='42501',message='Access denied';
 end if;
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 100000 then raise exception 'Invalid pagination'; end if;
 return query select l.id,l.slug,l.title,l.status,count(v.id),count(v.id) filter(where v.stock_state='available' and v.stock_checked_at between now()-interval '15 minutes' and now())
 from public.country_listings l left join public.listing_variants v on v.store_code=l.store_code and v.listing_id=l.id
 where l.store_code=p_store group by l.id,l.slug,l.title,l.status order by l.slug,l.id limit p_limit offset p_offset;
end $$;
revoke all on function public.dashboard_catalog(text,integer,integer) from public,anon;
grant execute on function public.dashboard_catalog(text,integer,integer) to authenticated;
