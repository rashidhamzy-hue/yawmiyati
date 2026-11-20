-- Trusted execution lifecycle for localized content. Default policies remain disabled.
create unique index localized_content_job_unique on public.localized_content_drafts(store_code,(evidence->>'job_id'))
where evidence ? 'job_id';
create function public.claim_localized_content_job(p_store text,p_job uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
 update public.ai_jobs j set state='running'
 where j.id=p_job and j.store_code=p_store and j.task='localized_content' and j.state='queued'
 and exists(select 1 from public.ai_market_policy pol where pol.store_code=p_store and pol.enabled and pol.daily_budget_microusd>0);
 get diagnostics changed=row_count;
 return changed=1;
end $$;
create function public.complete_localized_content_job(p_store text,p_job uuid,p_listing uuid,p_locale text,p_channel text,p_body jsonb,p_sources jsonb,p_actual bigint)
returns uuid language plpgsql security invoker set search_path='' as $$
declare job public.ai_jobs%rowtype; draft_id uuid;
begin
 select * into job from public.ai_jobs where id=p_job and store_code=p_store and task='localized_content' for update;
 if not found or job.state<>'running' then raise exception 'Job unavailable'; end if;
 if p_actual is null or p_actual<0 or p_actual>job.reserved_microusd then raise exception 'Actual cost exceeds reservation'; end if;
 if p_channel is null or p_channel not in ('storefront','seo','social','ad') or p_locale is null or length(p_locale) not between 4 and 16 then raise exception 'Invalid localization'; end if;
 if p_body is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>30000 or jsonb_typeof(p_body->'segments')<>'array' or jsonb_array_length(p_body->'segments') not between 1 and 30 then raise exception 'Invalid content output'; end if;
 if p_sources is null or jsonb_typeof(p_sources)<>'array' or jsonb_array_length(p_sources) not between 1 and 50 or octet_length(p_sources::text)>15000 then raise exception 'Invalid evidence'; end if;
 if exists(select 1 from jsonb_array_elements(p_body->'segments') x(v) where jsonb_typeof(x.v)<>'object' or jsonb_typeof(x.v->'text')<>'string' or length(btrim(x.v->>'text')) not between 1 and 2000 or jsonb_typeof(x.v->'factIds')<>'array' or jsonb_array_length(x.v->'factIds') not between 1 and 50) then raise exception 'Invalid segment'; end if;
 if exists(select 1 from jsonb_array_elements(p_body->'segments') x(v), jsonb_array_elements_text(x.v->'factIds') fact(id)
 where not exists(select 1 from jsonb_array_elements(p_sources) s(v) where s.v->>'id'=fact.id and length(btrim(coalesce(s.v->>'source','')))>0)) then raise exception 'Untraceable claim'; end if;
 perform 1 from public.country_listings where store_code=p_store and id=p_listing;
 if not found then raise exception 'Listing unavailable'; end if;
 insert into public.localized_content_drafts(store_code,listing_id,locale,channel,body,evidence,state)
 values(p_store,p_listing,p_locale,p_channel,p_body,
 jsonb_build_object('job_id',p_job,'sources',p_sources,'review_required',true),'draft')
 returning id into draft_id;
 update public.ai_jobs set state='complete',actual_microusd=p_actual where id=p_job and store_code=p_store;
 return draft_id;
end $$;
create function public.fail_localized_content_job(p_store text,p_job uuid,p_actual bigint)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_actual is not null and p_actual<0 then raise exception 'Invalid actual cost'; end if;
 update public.ai_jobs set state='failed',actual_microusd=p_actual
 where id=p_job and store_code=p_store and task='localized_content' and state='running';
 if not found then raise exception 'Job unavailable'; end if;
end $$;
revoke all on function public.claim_localized_content_job(text,uuid),public.complete_localized_content_job(text,uuid,uuid,text,text,jsonb,jsonb,bigint),public.fail_localized_content_job(text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.claim_localized_content_job(text,uuid),public.complete_localized_content_job(text,uuid,uuid,text,text,jsonb,jsonb,bigint),public.fail_localized_content_job(text,uuid,bigint) to service_role;
