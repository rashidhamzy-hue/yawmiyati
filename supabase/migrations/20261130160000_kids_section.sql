-- "Mother & kids" becomes a storefront section like the other six (session 3, step 12).
-- 1. brain_listings.category accepts 'kids'.
-- 2. The publish function keeps 'kids' as the section instead of dropping it to "no section".
--    The function body is otherwise the one from 20261130110000; only the allowed-section list changes, so it is
--    rewritten in place from its own definition and the migration stops if that list is not found exactly once.
-- 3. Products already published without a section whose approved page says 'kids' get the section now.
alter table public.brain_listings drop constraint if exists brain_listings_category_check;
alter table public.brain_listings add constraint brain_listings_category_check
  check (category in ('kids','home','kitchen','beauty','fashion','wellness','organize'));

do $$
declare
  v_def text := pg_get_functiondef('public.brain_publish_approved_core(text, uuid)'::regprocedure);
  v_old constant text := $q$in ('home','kitchen','beauty','fashion','wellness','organize')$q$;
  v_new constant text := $q$in ('kids','home','kitchen','beauty','fashion','wellness','organize')$q$;
begin
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'publish_section_list_not_found_exactly_once';
  end if;
  execute replace(v_def, v_old, v_new);
end $$;

update public.brain_listings b set category = 'kids'
 where b.category is null
   and exists (select 1 from public.brain_product_analysis a
                where a.run_id = b.run_id and a.store_code = b.store_code and a.product_id = b.taager_product_id
                  and a.content->>'category' = 'kids');
