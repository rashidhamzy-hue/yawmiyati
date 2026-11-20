begin;
do $$
declare v_job uuid; v_listing uuid; v_product uuid; v_draft uuid; v_key text:='fixture-'||gen_random_uuid()::text;
begin
 if exists(select 1 from public.ai_market_policy where store_code='sa' and enabled) then raise exception 'Test expects initially disabled SA policy'; end if;
 begin
  perform public.reserve_ai_job('sa','localized_content',v_key,100);
  raise exception 'Assertion: disabled AI reservation accepted';
 exception when others then if sqlerrm<>'AI disabled' then raise; end if; end;
 update public.ai_market_policy set enabled=true,daily_budget_microusd=1000 where store_code='sa';
 insert into public.catalog_products default values returning id into v_product;
 insert into public.country_listings(store_code,product_id,slug,title,status) values('sa',v_product,'ai-fixture-'||gen_random_uuid()::text,'AI fixture','draft') returning id into v_listing;
 v_job:=public.reserve_ai_job('sa','localized_content',v_key,100);
 if not public.claim_localized_content_job('sa',v_job) then raise exception 'Assertion: claim rejected'; end if;
 if public.claim_localized_content_job('sa',v_job) then raise exception 'Assertion: double claim'; end if;
 begin
  perform public.complete_localized_content_job('sa',v_job,v_listing,'ar-SA','storefront','{"segments":[{"text":"unverified","factIds":["missing"]}]}'::jsonb,'[{"id":"fact","source":"fixture"}]'::jsonb,50);
  raise exception 'Assertion: unsupported claim accepted';
 exception when others then if sqlerrm<>'Untraceable claim' then raise; end if; end;
 v_draft:=public.complete_localized_content_job('sa',v_job,v_listing,'ar-SA','storefront','{"segments":[{"text":"verified","factIds":["fact"]}]}'::jsonb,'[{"id":"fact","source":"fixture"}]'::jsonb,50);
 if not exists(select 1 from public.localized_content_drafts where id=v_draft and state='draft' and evidence->>'review_required'='true') then raise exception 'Assertion: draft not recorded'; end if;
 if not exists(select 1 from public.ai_jobs where id=v_job and state='complete' and actual_microusd=50) then raise exception 'Assertion: job not reconciled'; end if;
 if exists(select 1 from public.public_catalog('sa') where listing_id=v_listing) then raise exception 'Assertion: AI draft became public'; end if;
end $$;
rollback;
