-- Run only on Yawmiyati staging. All changes are rolled back.
begin;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
do $$
declare first_ok boolean; second_ok boolean;
begin
 if public.reserve_shopping_assistant_request('sa') then raise exception 'Assertion: AI spending enabled without consent'; end if;
 update public.shopping_assistant_policy
 set enabled=true,daily_request_cap=1,minute_request_cap=1 where store_code='sa';
 first_ok:=public.reserve_shopping_assistant_request('sa');
 second_ok:=public.reserve_shopping_assistant_request('sa');
 if first_ok is distinct from true or second_ok is distinct from false then raise exception 'Assertion: usage caps bypassed'; end if;
 if public.reserve_shopping_assistant_request('ae') then raise exception 'Assertion: cross-market spending enabled'; end if;
end $$;
rollback;
begin;
set local role anon;
select set_config('request.jwt.claim.role','anon',true);
do $$
begin
 begin
  perform public.reserve_shopping_assistant_request('sa');
  raise exception 'Assertion: anonymous database budget modification accepted';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
select store_code,enabled,daily_request_cap,minute_request_cap
from public.shopping_assistant_policy order by store_code;
