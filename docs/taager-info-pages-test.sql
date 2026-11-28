-- Rollback-only fixture test for supabase/migrations/20261201090000_taager_info_pages.sql.
-- Proves: pages are stored per market and page with a version, an unchanged page adds no version, a changed page adds
-- one; facts carry their page and date; a figure that contradicts ours waits for the owner; while it waits the price
-- guards already use it if it costs us more, never if it is cheaper; confirm makes the page win, reject falls back to
-- our figure; account-like paths and text with an e-mail address are refused; customers see only facts in use;
-- anon and non-members reach nothing.
begin;
do $$
declare u uuid; j jsonb; n int; fid uuid; base bigint;
  page jsonb := '[{"path":"/iq/info","title":"Shipping","read_at":"2026-11-28T15:00:00Z","text":"Shipping prices in Iraq\n7000 Iraqi dinars for all regions of Iraq","links":["/iq/loyalty"],"api":[]}]';
  fee jsonb := '{"key":"delivery_fee","value":{"flat_minor":7000000},"summary":"Delivery fee 7000 IQD per order.","quote":"7000 Iraqi dinars for all regions of Iraq","source_path":"/iq/info","source_read_at":"2026-11-28T15:00:00Z","confidence":"high","decision":"agrees"}';
  ret jsonb := '{"key":"return_window","value":{"days":3,"defect_only":false},"summary":"Returns within 3 days.","quote":"3-day money back guarantee","source_path":"/iq/info","source_read_at":"2026-11-28T15:00:00Z","confidence":"high","decision":"pending"}';
begin
 select user_id into u from public.dashboard_members where store_code='iq' limit 1;
 if u is null then raise exception 'No staging owner'; end if;
 select base_delivery_fee_minor into base from public.store_commerce_facts where store_code='iq';
 if base <> 7000000 then raise exception 'baseline %', base; end if;

 -- 0. Nobody but a member.
 begin perform public.taager_pages_import('iq', page, jsonb_build_array(fee)); raise exception 'anon imported';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);

 -- 1. First import: one new page, facts stored with their source; nothing changes in the guards.
 j := public.taager_pages_import('iq', page, jsonb_build_array(fee, ret));
 if (j->>'pages_new')::int <> 1 or (j->>'waiting')::int <> 1 or (j->'guards'->>'delivery_fee_minor')::bigint <> 7000000 then raise exception 'first import %', j; end if;
 if not exists (select 1 from public.taager_market_facts where market='iq' and fact_key='delivery_fee' and is_current and decision='agrees' and source_path='/iq/info' and source_read_at='2026-11-28T15:00:00Z') then raise exception 'fee fact'; end if;

 -- 2. Same page again: no new version.
 j := public.taager_pages_import('iq', page, jsonb_build_array(fee, ret));
 select count(*) into n from public.taager_info_pages where market='iq' and path='/iq/info';
 if n <> 1 or (j->>'pages_unchanged')::int <> 1 or (j->>'facts_changed')::int <> 0 then raise exception 'repeat import % %', n, j; end if;

 -- 3. The page changes: a dearer fee. Version 2, the fact waits, and the guards already use the dearer fee.
 j := public.taager_pages_import('iq', jsonb_set(page, '{0,text}', '"Shipping prices in Iraq\n8000 Iraqi dinars for all regions of Iraq"'),
        jsonb_build_array(jsonb_set(fee, '{value}', '{"flat_minor":8000000}')));
 select max(version) into n from public.taager_info_pages where market='iq' and path='/iq/info';
 if n <> 2 or (j->>'pages_changed')::int <> 1 or (j->>'facts_changed')::int <> 1 or (j->'guards'->>'delivery_fee_minor')::bigint <> 8000000 then raise exception 'changed page % %', n, j; end if;
 select id into fid from public.taager_market_facts where market='iq' and fact_key='delivery_fee' and is_current and decision='pending' and previous_value = '{"flat_minor":7000000}' and changed_at is not null;
 if fid is null then raise exception 'changed fact should wait with its previous value'; end if;
 if (select count(*) from public.store_commerce_facts_log where store_code='iq' and field='delivery_fee_minor' and value='8000000') <> 1 then raise exception 'guard change not logged'; end if;
 j := public.taager_page_versions('iq', '/iq/info');
 if jsonb_array_length(j) <> 2 or j->0->>'text' not like '%8000%' or j->1->>'text' not like '%7000%' then raise exception 'versions %', j; end if;

 -- 4. Customers never see a fact that waits.
 j := public.public_market_facts('iq');
 if j->'delivery_fee' <> 'null'::jsonb or j->'returns' <> 'null'::jsonb then raise exception 'public shows waiting facts %', j; end if;

 -- 5. Reject: back to our figure. Confirm: the page wins and customers see it.
 j := public.taager_fact_decide('iq', fid, 'rejected');
 if (j->>'delivery_fee_minor')::bigint <> 7000000 then raise exception 'reject %', j; end if;
 j := public.taager_fact_decide('iq', fid, 'confirmed');
 if (j->>'delivery_fee_minor')::bigint <> 8000000 then raise exception 'confirm %', j; end if;
 j := public.public_market_facts('iq');
 if (j->'delivery_fee'->>'flat_minor')::bigint <> 8000000 then raise exception 'public after confirm %', j; end if;
 select id into fid from public.taager_market_facts where market='iq' and fact_key='return_window' and is_current;
 perform public.taager_fact_decide('iq', fid, 'confirmed');
 if (public.public_market_facts('iq')->'returns'->>'days')::int <> 3 then raise exception 'returns not public after confirm'; end if;
 if public.public_market_facts('iq')::text ~* 'taager|merchant|refus' then raise exception 'public facts leak'; end if;

 -- 6. A cheaper fee on the page never lowers the guard before it is confirmed (the confirmed 8000 stays in force); a misread (absurd) fee is ignored.
 j := public.taager_pages_import('iq', jsonb_set(page, '{0,text}', '"Shipping prices in Iraq\n5000 Iraqi dinars for all regions of Iraq"'),
        jsonb_build_array(jsonb_set(fee, '{value}', '{"flat_minor":5000000}')));
 if (j->'guards'->>'delivery_fee_minor')::bigint <> 8000000 then raise exception 'cheaper pending fee lowered the guard %', j; end if;
 j := public.taager_pages_import('iq', jsonb_set(page, '{0,text}', '"Shipping prices in Iraq\n900000 Iraqi dinars for all regions of Iraq"'),
        jsonb_build_array(jsonb_set(fee, '{value}', '{"flat_minor":900000000}')));
 if (j->'guards'->>'delivery_fee_minor')::bigint <> 8000000 then raise exception 'absurd fee used %', j; end if;

 -- 7. Egypt: a return fee above our 5 EGP raises the undelivered cost at once; zones are read at their dearest band.
 j := public.taager_pages_import('eg', '[{"path":"/eg/info","text":"Egypt shipping zones and return fees table","read_at":"2026-11-28T15:00:00Z"}]',
   '[{"key":"delivery_fee","value":{"zones":[{"name":"Zone 1","places":["Cairo"],"fee_minor":9500},{"name":"Zone 3","places":["Aswan"],"fee_minor":10500}]},"source_path":"/eg/info","decision":"agrees"},
     {"key":"return_fee","value":{"shipped_minor":1000,"delivered_minor":1000},"source_path":"/eg/info","decision":"agrees"}]');
 if (j->'guards'->>'delivery_fee_minor')::bigint <> 10500 or (j->'guards'->>'refusal_charge_minor')::bigint <> 1000 or (j->'guards'->>'undelivered_cost_minor')::bigint <= 270 then raise exception 'egypt %', j; end if;
 if not exists (select 1 from public.taager_market_facts where market='eg' and fact_key='return_fee' and is_current and decision='pending') then raise exception 'a dearer return fee must wait even if the browser said agrees'; end if;
 if jsonb_array_length(public.public_market_facts('eg')->'delivery_fee'->'zones') <> 2 then raise exception 'egypt zones not public'; end if;

 -- 8. Nothing personal: account-like paths, another market's page and text with an e-mail address are refused.
 begin perform public.taager_pages_import('iq', '[{"path":"/iq/wallet","text":"balance and transactions of the account"}]', '[]'); raise exception 'wallet page stored';
 exception when invalid_parameter_value then null; end;
 begin perform public.taager_pages_import('iq', '[{"path":"/sa/info","text":"a page of another market entirely"}]', '[]'); raise exception 'other market stored';
 exception when invalid_parameter_value then null; end;
 begin perform public.taager_pages_import('iq', '[{"path":"/iq/help","text":"write to someone@example.com for help with orders"}]', '[]'); raise exception 'email stored';
 exception when invalid_parameter_value then null; end;

 -- 9. The owner view; a non-member gets nothing; no release flag moved.
 j := public.taager_facts_overview('iq');
 if jsonb_array_length(j->'pages') <> 1 or (j->'pages'->0->>'version')::int <> 4 or jsonb_array_length(j->'facts') <> 2 then raise exception 'overview %', j; end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 begin perform public.taager_facts_overview('iq'); raise exception 'non-member read the overview';
 exception when insufficient_privilege then null; end;
 begin perform public.taager_fact_decide('iq', fid, 'rejected'); raise exception 'non-member decided';
 exception when insufficient_privilege then null; end;
 if exists (select 1 from public.stores where checkout_enabled or fulfillment_enabled) then raise exception 'a flag moved'; end if;
 if has_table_privilege('anon','public.taager_info_pages','select') or has_table_privilege('authenticated','public.taager_market_facts','select') then raise exception 'tables are readable by clients'; end if;
end $$;
rollback;
