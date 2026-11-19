-- Run only in Yawmiyati staging as database administrator. All fixture writes roll back.
begin;
do $$
declare u uuid; at_time timestamptz:=now(); review_time timestamptz; revision uuid; revision2 uuid; listing uuid; replay uuid; n integer;
begin
 select user_id into u from public.dashboard_members where store_code='sa' limit 1;
 if u is null then raise exception 'No staging owner'; end if;
 if exists(select 1 from public.catalog_import_candidates where store_code='sa' and woo_product_id=900000000001) then raise exception 'Fixture collision'; end if;
 insert into public.catalog_import_candidates(store_code,woo_product_id,woo_variation_id,supplier_sku,title,observed_price_minor,observed_stock,observed_at)
 values('sa',900000000001,0,'fixture-draft-900000000001','Draft test',5000,'unknown',at_time);
 perform set_config('request.jwt.claim.sub',u::text,true);
 begin
  perform public.create_candidate_draft('sa',900000000001,at_time,gen_random_uuid());
  raise exception 'Assertion: draft without review';
 exception when others then if sqlerrm like 'Assertion:%' then raise; end if; end;
 perform public.dashboard_save_candidate_review('sa',900000000001,2000,500,100,5000,'shortlisted');
 select updated_at into review_time from public.candidate_commercial_review where store_code='sa' and woo_product_id=900000000001;
 revision:=public.approve_candidate_content('sa',900000000001,at_time,'Fixture approved','Test only');
 revision2:=public.approve_candidate_content('sa',900000000001,at_time,'Fixture newest','Test only');
 begin
  perform public.create_candidate_draft('sa',900000000001,review_time,revision);
  raise exception 'Assertion: superseded approval accepted';
 exception when others then if sqlerrm like 'Assertion:%' then raise; end if; if sqlerrm<>'Content approval missing or superseded' then raise; end if; end;
 revision:=revision2;
 listing:=public.create_candidate_draft('sa',900000000001,review_time,revision);
 replay:=public.create_candidate_draft('sa',900000000001,review_time,revision);
 if listing is distinct from replay then raise exception 'Assertion: replay mismatch'; end if;
 select count(*) into n from public.country_listings l join public.listing_variants v on (v.store_code,v.listing_id)=(l.store_code,l.id) join public.supplier_variant_mappings m on (m.store_code,m.variant_id)=(v.store_code,v.id) where l.id=listing and l.store_code='sa' and l.status='draft' and v.stock_state='unknown' and v.price_minor=5000 and m.woo_product_id=900000000001;
 if n<>1 then raise exception 'Assertion: inconsistent draft'; end if;
 if exists(select 1 from public.public_catalog('sa',100,0) where listing_id=listing) then raise exception 'Assertion: draft visible'; end if;
 revision2:=public.approve_candidate_content('sa',900000000001,at_time,'Fixture second','Test only');
 begin
  perform public.create_candidate_draft('sa',900000000001,review_time,revision2);
  raise exception 'Assertion: duplicate draft';
 exception when others then if sqlerrm like 'Assertion:%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 begin
  perform public.approve_candidate_content('sa',900000000001,at_time,'Denied','Test');
  raise exception 'Assertion: unauthorized';
 exception when insufficient_privilege then null; end;
 raise notice 'Draft transaction fixture passed';
end $$;
rollback;
