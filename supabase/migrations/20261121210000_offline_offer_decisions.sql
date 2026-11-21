-- Private owner assortment decisions. No consumer or fulfillment workflow reads this table.
create table public.offline_offer_decisions (
 owner_id uuid not null, store_code text not null, sku text not null,
 sequence bigint not null check(sequence>0), proposal jsonb not null, approved boolean not null,
 decided_at timestamptz not null default clock_timestamp(),
 primary key(owner_id,store_code,sku,sequence)
);
alter table public.offline_offer_decisions enable row level security;
revoke all on public.offline_offer_decisions from public,anon,authenticated;

create function public.owner_offer_decision(p_store text,p_sku text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members where user_id=auth.uid() and store_code=p_store)
 then raise insufficient_privilege; end if;
 select jsonb_build_object('sequence',sequence::text,'approved',approved,'proposal',proposal,'decidedAt',decided_at)
 into result from public.offline_offer_decisions
 where owner_id=auth.uid() and store_code=p_store and sku=p_sku order by sequence desc limit 1;
 return result;
end $$;

create function public.save_owner_offer_decision(p_store text,p_proposal jsonb,p_approved boolean,p_expected bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sku_key text:=p_proposal->>'sku'; previous jsonb; seq bigint;
begin
 if uid is null or not exists(select 1 from public.dashboard_members where user_id=uid and store_code=p_store)
 then raise insufficient_privilege; end if;
 if not coalesce(p_store in ('sa','ae','om','eg','iq') and jsonb_typeof(p_proposal)='object'
 and octet_length(p_proposal::text)<=30000 and p_proposal->>'schema'='yawmiyati-offer-1'
 and p_proposal->'demo'='false'::jsonb and p_proposal->>'market'=p_store
 and length(trim(sku_key)) between 1 and 250 and length(trim(p_proposal->>'title')) between 1 and 500
 and (p_proposal->>'revision') ~ '^[a-f0-9]{64}$'
 and (p_proposal->>'priceMinor') ~ '^[1-9][0-9]{0,15}$'
 and (p_proposal->>'expectedContributionMinor') ~ '^[1-9][0-9]{0,15}$'
 and jsonb_typeof(p_proposal->'components')='array' and jsonb_array_length(p_proposal->'components') between 1 and 100
 and p_expected>=0 and p_approved is not null,false) then raise exception 'Invalid offer proposal'; end if;
 if exists(select 1 from jsonb_array_elements(p_proposal->'components') component
   where not coalesce(jsonb_typeof(component)='object' and jsonb_typeof(component->'id')='string'
   and length(trim(component->>'id')) between 1 and 250 and jsonb_typeof(component->'quantity')='number'
   and (component->>'quantity') ~ '^[1-9][0-9]{0,8}$',false)) then raise exception 'Invalid components'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(jsonb_build_array(uid,p_store,sku_key)::text,0));
 previous:=public.owner_offer_decision(p_store,sku_key);
 if exists(select 1 from public.offline_offer_decisions d where d.owner_id=uid and d.store_code=p_store and d.sku=sku_key
   and d.proposal->>'revision'=p_proposal->>'revision' and d.proposal<>p_proposal) then raise exception 'Revision contents changed'; end if;
 seq:=coalesce((previous->>'sequence')::bigint,0);
 if previous->'proposal'=p_proposal and (previous->>'approved')::boolean=p_approved then return previous; end if;
 if seq<>p_expected then raise exception 'Decision changed. Reload before saving.'; end if;
 if not p_approved and previous->'proposal' is distinct from p_proposal then raise exception 'Revocation requires current proposal'; end if;
 insert into public.offline_offer_decisions(owner_id,store_code,sku,sequence,proposal,approved)
 values(uid,p_store,sku_key,seq+1,p_proposal,p_approved);
 return jsonb_build_object('sequence',(seq+1)::text,'approved',p_approved,'proposal',p_proposal);
end $$;
revoke all on function public.owner_offer_decision(text,text),public.save_owner_offer_decision(text,jsonb,boolean,bigint) from public,anon;
grant execute on function public.owner_offer_decision(text,text),public.save_owner_offer_decision(text,jsonb,boolean,bigint) to authenticated;
