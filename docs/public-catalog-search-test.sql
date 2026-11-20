-- Read-only test on staging, where no released catalog rows currently exist.
begin;
set local role anon;
do $$
begin
 if exists(select 1 from public.public_catalog_search('sa','قهوة',10)) then
  raise exception 'Public search exposed data while release disabled';
 end if;
 if exists(select 1 from public.public_catalog_search('ae','beauty',10)) then
  raise exception 'Cross-market public search exposed data';
 end if;
 begin
  perform public.public_catalog_search('sa','',10);
  raise exception 'Empty query accepted';
 exception when others then if sqlerrm<>'Invalid search request' then raise; end if; end;
end $$;
rollback;
