\set ON_ERROR_STOP on
-- Disposable CI database only.
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create table public.dashboard_members(user_id uuid,store_code text);
insert into public.dashboard_members values('10000000-0000-0000-0000-000000000001','sa'),('10000000-0000-0000-0000-000000000002','sa');
\ir ../../supabase/migrations/20261121210000_offline_offer_decisions.sql
set role authenticated;
set test.uid='10000000-0000-0000-0000-000000000001';
do $$
declare p jsonb:='{"schema":"yawmiyati-offer-1","market":"sa","sku":"S","demo":false,"revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","priceMinor":12300,"expectedContributionMinor":"300","title":"Shelf","components":[{"id":"rack","quantity":2}]}';
begin
 if public.owner_offer_decision('sa','S') is not null then raise exception 'Unexpected existing decision';end if;
 if public.save_owner_offer_decision('sa',p,true,0)->>'sequence'<>'1' then raise exception 'Insert failed';end if;
 if public.save_owner_offer_decision('sa',p,true,0)->>'sequence'<>'1' then raise exception 'Replay failed';end if;
 begin
  perform public.save_owner_offer_decision('sa',p,false,0);raise exception 'Unexpected stale success' using errcode='22000';
 exception when raise_exception then null;end;
 if public.save_owner_offer_decision('sa',p,false,1)->>'sequence'<>'2' then raise exception 'Revoke failed';end if;
 begin
  perform public.save_owner_offer_decision('sa',p||'{"demo":true}'::jsonb,true,2);raise exception 'Accepted demo' using errcode='22000';
 exception when raise_exception then null;end;
 begin
  perform public.save_owner_offer_decision('sa',p||'{"priceMinor":500}'::jsonb,true,2);raise exception 'Accepted mutated revision' using errcode='22000';
 exception when raise_exception then null;end;
 begin
  perform public.owner_offer_decision('iq','S');raise exception 'Access leak';
 exception when insufficient_privilege then null;end;
 begin
  perform * from public.offline_offer_decisions;raise exception 'Direct read allowed';
 exception when insufficient_privilege then null;end;
end $$;
set test.uid='10000000-0000-0000-0000-000000000002';
do $$ begin if public.owner_offer_decision('sa','S') is not null then raise exception 'Cross-owner leak';end if;end $$;
