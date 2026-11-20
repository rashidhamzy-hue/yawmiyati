-- Replace last-write-wins owner review RPC with exact-row-version compare-and-swap.
create function public.dashboard_save_candidate_review_v2(
 p_store text,p_product bigint,p_supplier bigint,p_delivery bigint,p_other bigint,
 p_price bigint,p_decision text,p_expected_at timestamptz)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare old_version timestamptz; new_version timestamptz; exists_review boolean;
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members m where m.user_id=auth.uid() and m.store_code=p_store) then
  raise exception using errcode='42501',message='Access denied';
 end if;
 if p_decision is null or p_decision not in ('pending','shortlisted','rejected') then raise exception 'Invalid decision'; end if;
 if p_supplier is not null and p_supplier not between 0 and 1000000000
  or p_delivery is not null and p_delivery not between 0 and 1000000000
  or p_other is not null and p_other not between 0 and 1000000000
  or p_price is not null and p_price not between 1 and 1000000000 then raise exception 'Invalid amount'; end if;
 perform 1 from public.catalog_import_candidates where store_code=p_store and woo_product_id=p_product and woo_variation_id=0 for update;
 if not found then raise exception 'Candidate unavailable'; end if;
 select updated_at into old_version from public.candidate_commercial_review
 where store_code=p_store and woo_product_id=p_product and woo_variation_id=0 for update;
 exists_review:=found;
 if exists_review then
  if p_expected_at is distinct from old_version then raise exception 'Review changed; reload before saving'; end if;
  update public.candidate_commercial_review r
  set supplier_cost_minor=p_supplier,delivery_cost_minor=p_delivery,other_cost_minor=p_other,
   proposed_price_minor=p_price,decision=p_decision,updated_by=auth.uid(),
   updated_at=greatest(clock_timestamp(),r.updated_at+interval '1 microsecond')
  where r.store_code=p_store and r.woo_product_id=p_product and r.woo_variation_id=0 returning updated_at into new_version;
 else
  if p_expected_at is not null then raise exception 'Review changed; reload before saving'; end if;
  insert into public.candidate_commercial_review(store_code,woo_product_id,woo_variation_id,supplier_cost_minor,delivery_cost_minor,other_cost_minor,proposed_price_minor,decision,updated_by,updated_at)
  values(p_store,p_product,0,p_supplier,p_delivery,p_other,p_price,p_decision,auth.uid(),clock_timestamp())
  returning updated_at into new_version;
 end if;
 return new_version;
end $$;
revoke all on function public.dashboard_save_candidate_review_v2(text,bigint,bigint,bigint,bigint,bigint,text,timestamptz) from public,anon;
grant execute on function public.dashboard_save_candidate_review_v2(text,bigint,bigint,bigint,bigint,bigint,text,timestamptz) to authenticated;
-- Do not leave the old no-version RPC available to bypass concurrency checks.
revoke execute on function public.dashboard_save_candidate_review(text,bigint,bigint,bigint,bigint,bigint,text) from authenticated;
notify pgrst,'reload schema';
