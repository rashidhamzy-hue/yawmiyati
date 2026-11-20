-- Search only content already visible through current_catalog_release:
-- published listing, approved description, current stock proof, current commercial review and market release gate.
create function public.public_catalog_search(p_store text,p_query text,p_limit integer default 40)
returns table(listing_id uuid,slug text,title text,price_minor text,currency text,relevance integer)
language plpgsql stable security definer set search_path='' as $$
declare q text;
begin
 q:=btrim(coalesce(p_query,''));
 if length(q) not between 2 and 120 or p_limit is null or p_limit not between 1 and 60 then
  raise exception 'Invalid search request';
 end if;
 return query
 with candidates as (
  select c.listing_id,c.slug,c.title,c.description,c.price_minor,c.currency,
   case when lower(c.title)=lower(q) then 100
   when left(lower(c.title),length(q))=lower(q) then 75
   when strpos(lower(c.title),lower(q))>0 then 55
   when strpos(lower(c.description),lower(q))>0 then 25
   else 0 end as score
  from public.current_catalog_release(p_store) c
 )
 select x.listing_id,x.slug,x.title,x.price_minor,x.currency,x.score
 from candidates x where x.score>0 order by x.score desc,x.slug,x.listing_id limit p_limit;
end $$;
revoke all on function public.public_catalog_search(text,text,integer) from public;
grant execute on function public.public_catalog_search(text,text,integer) to anon,authenticated;
-- No direct table privileges introduced, and query cannot search internal supplier data.
notify pgrst,'reload schema';
