begin;
do $$
declare u uuid; at_time timestamptz:=now(); review_time timestamptz; revision uuid; listing uuid; variant uuid;
begin
 select user_id into u from public.dashboard_members where store_code='sa' limit 1;
 if u is null then raise exception 'No staging owner'; end if;
 insert into public.catalog_import_candidates(store_code,woo_product_id,woo_variation_id,supplier_sku,title,observed_price_minor,observed_stock,observed_at)
 values('sa',900000000002,0,'fixture-release-900000000002','Release fixture',5000,'unknown',at_time);
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform public.dashboard_save_candidate_review('sa',900000000002,2000,500,100,5000,'shortlisted');
 select updated_at into review_time from public.candidate_commercial_review where store_code='sa' and woo_product_id=900000000002;
 revision:=public.approve_candidate_content('sa',900000000002,at_time,'Fixture approved','Fixture description');
 listing:=public.create_candidate_draft('sa',900000000002,review_time,revision);
 select id into variant from public.listing_variants where store_code='sa' and listing_id=listing;
 begin
  perform public.publish_candidate_draft('sa',900000000002,listing);
  raise exception 'Assertion: disabled release accepted';
 exception when others then if sqlerrm<>'Market release disabled' then raise; end if; end;
 update public.stores set catalog_release_enabled=true where code='sa';
 begin
  perform public.publish_candidate_draft('sa',900000000002,listing);
  raise exception 'Assertion: unverified stock accepted';
 exception when others then if sqlerrm<>'Variant unavailable' then raise; end if; end;
 perform public.record_verified_stock('sa',variant,'available','synthetic-test-only',at_time);
 perform public.publish_candidate_draft('sa',900000000002,listing);
 if not exists(select 1 from public.public_catalog_detail('sa','supplier-900000000002') where listing_id=listing and description='Fixture description') then raise exception 'Assertion: public detail missing'; end if;
 if exists(select 1 from public.public_catalog_detail('eg','supplier-900000000002')) then raise exception 'Assertion: market leakage'; end if;
 perform public.approve_candidate_content('sa',900000000002,at_time,'New revision','Changed description');
 if exists(select 1 from public.public_catalog('sa',100,0) where listing_id=listing) then raise exception 'Assertion: superseded listing visible'; end if;
 if has_function_privilege('authenticated','public.record_verified_stock(text,uuid,text,text,timestamptz)','EXECUTE') then raise exception 'Assertion: owner can forge stock'; end if;
end $$;
rollback;
