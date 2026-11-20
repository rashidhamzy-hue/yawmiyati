begin;
insert into public.catalog_import_candidates(store_code,woo_product_id,woo_variation_id,supplier_sku,title,observed_price_minor,observed_stock,observed_at)
values('sa',900000000003,0,'review-cas-fixture-900000000003','Review fixture',5000,'unknown',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','da78328c-800d-4fbb-98d6-b48c151b6087',true);
do $$
declare first_version timestamptz; second_version timestamptz;
begin
 if has_function_privilege(current_user,'public.dashboard_save_candidate_review(text,bigint,bigint,bigint,bigint,bigint,text)','EXECUTE') then raise exception 'Assertion: legacy review RPC exposed'; end if;
 first_version:=public.dashboard_save_candidate_review_v2('sa',900000000003,2000,300,100,5000,'shortlisted',null);
 second_version:=public.dashboard_save_candidate_review_v2('sa',900000000003,2500,300,100,5000,'shortlisted',first_version);
 if second_version<=first_version then raise exception 'Assertion: version did not advance'; end if;
 begin
  perform public.dashboard_save_candidate_review_v2('sa',900000000003,3000,300,100,5000,'rejected',first_version);
  raise exception 'Assertion: stale write accepted';
 exception when others then if sqlerrm<>'Review changed; reload before saving' then raise; end if; end;
 if not exists(select 1 from public.dashboard_candidate_review('sa',100) where woo_product_id=900000000003 and (review->>'supplier_cost_minor')::bigint=2500 and review->>'decision'='shortlisted') then raise exception 'Assertion: stale write overwrote record'; end if;
end $$;
rollback;
