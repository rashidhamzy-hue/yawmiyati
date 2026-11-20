-- Read-only RLS/publication audit. Run only on Yawmiyati staging.
begin;
set local role anon;
do $$
begin
 if has_function_privilege(current_user,'public.dashboard_save_candidate_review_v2(text,bigint,bigint,bigint,bigint,bigint,text,timestamptz)','EXECUTE') then raise exception 'Review exposed'; end if;
 if has_function_privilege(current_user,'public.publish_candidate_draft(text,bigint,uuid)','EXECUTE') then raise exception 'Publication exposed'; end if;
 if has_function_privilege(current_user,'public.claim_localized_content_job(text,uuid)','EXECUTE') then raise exception 'AI execution exposed'; end if;
 if exists(select 1 from public.public_catalog('sa')) then raise exception 'Public catalog unexpectedly nonempty'; end if;
 begin
  perform public.dashboard_catalog_readiness('sa');
  raise exception 'Owner readiness exposed';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$
begin
 begin perform public.dashboard_catalog_readiness('sa'); raise exception 'Unauthorized readiness'; exception when insufficient_privilege then null; end;
 begin perform public.dashboard_market_performance('sa',30); raise exception 'Unauthorized report'; exception when insufficient_privilege then null; end;
 begin perform public.publish_candidate_draft('sa',1,gen_random_uuid()); raise exception 'Unauthorized publication'; exception when insufficient_privilege then null; end;
end $$;
rollback;
-- Should remain 9 imported candidates, zero listings and all release controls off in the initial staging state.
select (select count(*) from public.catalog_import_candidates where store_code='sa') as sa_candidates,
 (select count(*) from public.country_listings) as listings,
 (select bool_and(not catalog_release_enabled and not checkout_enabled and not fulfillment_enabled) from public.stores) as release_controls_off;
