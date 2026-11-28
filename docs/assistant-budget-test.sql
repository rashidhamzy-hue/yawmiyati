-- Rollback-only test for supabase/migrations/20261129100000_assistant_budget.sql (staging only).
-- Proves: paid answers are off by default; the daily dollar budget is hard (reservations count); every call's cost is
-- recorded; the test path needs a budget but never the visitor switch; only the owner changes the policy.
begin;
do $$
declare u uuid; r jsonb; d date := (now() at time zone 'UTC')::date;
begin
 select user_id into u from public.dashboard_members where store_code='sa' limit 1;
 if u is null then raise exception 'No staging owner'; end if;
 if exists (select 1 from public.shopping_assistant_policy where enabled or daily_budget_microusd>0) then raise exception 'a market is already switched on'; end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 r:=public.assistant_reserve('sa',400);
 if (r->>'ok')::boolean or r->>'reason'<>'no_budget' then raise exception 'default must be off %',r; end if;
 -- Builder test path: a budget of $0.001 without the visitor switch.
 update public.shopping_assistant_policy set daily_budget_microusd=1000, eval_token_sha256=repeat('a',64) where store_code='sa';
 if not public.assistant_eval_allowed('sa',repeat('A',64)) or public.assistant_eval_allowed('sa',repeat('b',64)) or public.assistant_eval_allowed('ae',repeat('a',64)) then raise exception 'eval token'; end if;
 r:=public.assistant_reserve('sa',400);
 if r->>'reason'<>'disabled' then raise exception 'visitors must stay off %',r; end if;
 r:=public.assistant_reserve('sa',400,true);
 if not (r->>'ok')::boolean or r->>'model'<>'claude-haiku-5-5' then raise exception 'eval reserve %',r; end if;
 r:=public.assistant_reserve('sa',400,true);
 if not (r->>'ok')::boolean then raise exception 'second reserve %',r; end if;
 r:=public.assistant_reserve('sa',400,true);
 if r->>'reason'<>'budget_spent' then raise exception 'reservations must count against the budget %',r; end if;
 perform public.assistant_settle('sa',d,400,2500,300,400);
 perform public.assistant_settle('sa',d,400,2400,200,340,true);
 if (select (calls,discarded,reserved_microusd,cost_microusd,input_tokens) from public.shopping_assistant_spend where store_code='sa' and usage_day=d) is distinct from (2,1,0::bigint,740::bigint,4900::bigint) then raise exception 'metering %',(select to_jsonb(s) from public.shopping_assistant_spend s where store_code='sa'); end if;
 r:=public.assistant_reserve('sa',400,true);
 if r->>'reason'<>'budget_spent' then raise exception 'spent budget must stop calls %',r; end if;
 -- Owner switch.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',u::text,true);
 begin perform public.assistant_owner_set('sa',true,0); raise exception 'switched on without a budget'; exception when sqlstate '22023' then null; end;
 begin perform public.assistant_owner_set('sa',true,50); raise exception 'budget above the limit'; exception when sqlstate '22023' then null; end;
 r:=public.assistant_owner_set('sa',true,1);
 if not (r->>'enabled')::boolean or (r->>'daily_budget_usd')::numeric<>1 or (r->>'daily_request_cap')::int<>2500 or (r->'days'->0->>'cost_usd')::numeric<>0.0007 then raise exception 'owner status %',r; end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 r:=public.assistant_reserve('sa',400);
 if not (r->>'ok')::boolean then raise exception 'visitor reserve after switch on %',r; end if;
 if has_function_privilege('anon','public.assistant_reserve(text,bigint,boolean)','execute') or has_function_privilege('authenticated','public.assistant_settle(text,date,bigint,bigint,bigint,bigint,boolean)','execute')
    or has_function_privilege('anon','public.assistant_owner_set(text,boolean,numeric)','execute') or has_table_privilege('anon','public.shopping_assistant_spend','select') then raise exception 'privileges'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin perform public.assistant_owner_set('sa',true,1); raise exception 'a non-member changed the policy'; exception when sqlstate '42501' then null; end;
 raise notice 'assistant budget: all checks passed';
end $$;
rollback;
