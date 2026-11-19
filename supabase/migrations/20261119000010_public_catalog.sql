create function public.public_catalog(p_store text,p_limit integer default 50,p_offset integer default 0)
returns table(listing_id uuid,slug text,title text,price_minor text,currency text)
language sql stable security definer set search_path='' as $$
 select l.id,l.slug,l.title,min(v.price_minor)::text,s.currency from public.country_listings l join public.stores s on s.code=l.store_code join public.listing_variants v on v.store_code=l.store_code and v.listing_id=l.id
 where l.store_code=p_store and l.status='published' and v.stock_state='available' and v.stock_checked_at between now()-interval '15 minutes' and now()
 group by l.id,l.slug,l.title,s.currency order by l.slug,l.id limit least(greatest(coalesce(p_limit,50),1),100) offset least(greatest(coalesce(p_offset,0),0),10000)
$$;
revoke all on function public.public_catalog(text,integer,integer) from public;
grant execute on function public.public_catalog(text,integer,integer) to anon,authenticated;
