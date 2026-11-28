-- Rollback-only fixture test for supabase/migrations/20261130140000_blacklist_order_quality.sql.
-- Proves: 1 undelivered order in 90 days → WhatsApp confirmation; 2 → refusal; an old undelivered order no longer
-- counts; the count is shared across stores; the owner's unblock restarts the count without deleting history;
-- invalid names, duplicate baskets and too many attempts are queued for the owner, who releases or cancels;
-- the tables hold hashes only; anon and non-members reach nothing.
begin;
do $$
declare u uuid; res jsonb; q jsonb; qid uuid; i int;
  h1 text := repeat('a1', 32); h2 text := repeat('b2', 32); h3 text := repeat('c3', 32); hb text := repeat('d4', 32); bk text := repeat('e5', 32); bk2 text := repeat('f6', 32);
  t0 timestamptz := now() - interval '3 days';
  ord text := '{"woo_order_id":%s,"order_number":"%s","status":"%s","raw_status":"x","placed_at":"%s","modified_at":"%s","total_minor":17700,"items":[{"sku":"FIX","quantity":1,"total_minor":14900}],"phone_hash":"%s"}';
begin
 select user_id into u from public.dashboard_members where store_code='sa' limit 1;
 if u is null then raise exception 'No staging owner'; end if;
 -- h1: one refusal. h2: a refusal in Saudi and an unreachable in the UAE (shared count). h3: a refusal 120 days ago and a delivery.
 perform public.order_tracking_upsert('sa', ('['||format(ord,910001,'1','refused',t0,t0,h1)||','||format(ord,910002,'2','refused',t0,t0,h2)||','
   ||format(ord,910004,'4','refused',now()-interval '120 days',now()-interval '120 days',h3)||','||format(ord,910005,'5','delivered',t0,t0,h3)||']')::jsonb);
 perform public.order_tracking_upsert('ae', ('['||format(ord,910003,'3','unreachable',t0,t0,h2)||']')::jsonb);
 if public.customer_undelivered(h1)<>1 or public.customer_undelivered(h2)<>2 or public.customer_undelivered(h3)<>0 then raise exception 'counts % % %',public.customer_undelivered(h1),public.customer_undelivered(h2),public.customer_undelivered(h3); end if;

 -- 1. The gate.
 res := public.order_gate('sa', h1, hb, bk, 'ref-1', null, '{"items":1,"total_minor":17700,"name":"must not be kept","phone":"0500000000"}');
 if res->>'action'<>'confirm_whatsapp' then raise exception 'one undelivered %',res; end if;
 res := public.order_gate('sa', h2, null, bk, 'ref-2', null);
 if res->>'action'<>'refuse' or (res->>'undelivered_90d')::int<>2 then raise exception 'two undelivered %',res; end if;
 res := public.order_gate('sa', h3, null, bk, 'ref-3', null);
 if res->>'action'<>'allow' then raise exception 'old refusal still counted %',res; end if;
 -- Same phone, same basket again within a day → held as a duplicate. A different basket goes through.
 res := public.order_gate('sa', h3, null, bk, 'ref-4', null);
 if res->>'action'<>'hold' or not (res->'reasons' ? 'duplicate_order') then raise exception 'duplicate %',res; end if;
 res := public.order_gate('sa', h3, null, bk2, 'ref-5', null);
 if res->>'action'<>'allow' then raise exception 'other basket %',res; end if;
 -- Invalid name → held, with only items and total kept in the queue.
 res := public.order_gate('sa', repeat('07', 32), null, bk, 'ref-6', 'test_text', '{"items":2,"total_minor":20700,"name":"asdf","address":"x","phone":"0500000000"}');
 if res->>'action'<>'hold' or not (res->'reasons' ? 'invalid_name') then raise exception 'name %',res; end if;
 if (select summary from public.order_quality_queue where order_ref='ref-6') ?| array['name','address','phone','email'] then raise exception 'personal data in queue'; end if;
 -- Too many attempts from one browser in an hour.
 for i in 1..4 loop perform public.order_gate('sa', lpad(to_hex(i), 64, '0'), repeat('99', 32), lpad(to_hex(i), 64, 'b'), 'ref-b'||i, null); end loop;
 res := public.order_gate('sa', lpad('f', 64, '0'), repeat('99', 32), lpad('f', 64, 'b'), 'ref-b5', null);
 if res->>'action'<>'hold' or not (res->'reasons' ? 'too_many_orders_browser') then raise exception 'browser rate %',res; end if;

 -- 2. Owner view and decisions.
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 q := public.brain_order_quality('sa');
 if jsonb_array_length(q->'queue')<>3 or not exists (select 1 from jsonb_array_elements(q->'blacklist') b where b->>'key'=h2 and (b->>'undelivered_90d')::int=2)
    or not exists (select 1 from jsonb_array_elements(q->'blacklist') b where b->>'key'=h1 and (b->>'undelivered_90d')::int=1)
    or exists (select 1 from jsonb_array_elements(q->'blacklist') b where b->>'key'=h3) then raise exception 'owner view %',q; end if;
 select (x->>'id')::uuid into qid from jsonb_array_elements(q->'queue') x where x->>'order_ref'='ref-6';
 res := public.brain_order_queue_decide('sa', qid, 'released');
 if res->>'status'<>'released' or (select status from public.order_quality_queue where id=qid)<>'released' then raise exception 'release %',res; end if;
 begin perform public.brain_order_queue_decide('sa', qid, 'cancelled'); raise exception 'decided twice'; exception when sqlstate '22023' then null; end;
 -- Unblock h2: it may order again, the history stays, and a NEW refusal counts from one.
 perform public.brain_customer_unblock('sa', h2, 'called the customer');
 if public.customer_undelivered(h2)<>0 or (select count(*) from public.order_tracking where phone_hash=h2)<>2 then raise exception 'unblock'; end if;
 if public.order_gate('sa', h2, null, bk2, 'ref-7', null)->>'action'<>'allow' then raise exception 'unblocked still refused'; end if;
 perform public.order_tracking_upsert('sa', ('['||format(ord,910009,'9','refused',now(),now()+interval '1 minute',h2)||']')::jsonb);
 if public.customer_undelivered(h2)<>1 then raise exception 'count after unblock %',public.customer_undelivered(h2); end if;
 begin perform public.brain_customer_unblock('sa', repeat('00', 32)); raise exception 'unblocked an unknown customer'; exception when sqlstate '22023' then null; end;

 -- 3. Hashes only, and privileges.
 if exists (select 1 from information_schema.columns where table_schema='public' and table_name in ('customer_risk','order_attempts','order_quality_queue')
            and column_name ~ '(^name$|address|email|^phone$|city|ip)') then raise exception 'personal column present'; end if;
 begin insert into public.customer_risk(phone_hash) values ('966501234567'); raise exception 'raw phone accepted'; exception when check_violation then null; end;
 if has_function_privilege('authenticated','public.order_gate(text,text,text,text,text,text,jsonb)','execute') or has_function_privilege('anon','public.brain_order_quality(text)','execute')
    or has_table_privilege('authenticated','public.customer_risk','select') or has_table_privilege('anon','public.order_attempts','select')
    or has_function_privilege('authenticated','public.customer_undelivered(text)','execute') then raise exception 'privileges'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin perform public.brain_order_quality('sa'); raise exception 'a non-member read the queue'; exception when sqlstate '42501' then null; end;
 begin perform public.brain_customer_unblock('sa', h1); raise exception 'a non-member unblocked'; exception when sqlstate '42501' then null; end;
 raise notice 'blacklist and order quality: all checks passed';
end $$;
rollback;
