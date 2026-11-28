-- Rollback-only fixture test for supabase/migrations/20261130100000_market_evidence.sql.
-- Proves: evidence rows are dated and keyed per shop page (a re-run updates, never duplicates); the owner reads market
-- totals and one product's shops; shoppers, anon and non-members read nothing.
begin;
do $$
declare u uuid; res jsonb;
begin
 select user_id into u from public.dashboard_members where store_code='sa' limit 1;
 if u is null then raise exception 'No staging owner'; end if;
 insert into public.market_price_evidence(store_code,sku,url,retailer,price_minor,delivery_minor,match,confidence,credible,cited) values
  ('sa','FIXA','https://shop-a.example/p/1','shop-a',11900,0,'exact',0.9,true,true),
  ('sa','FIXA','https://shop-b.example/p/1','shop-b',12900,1500,'exact',0.8,true,true),
  ('sa','FIXA','https://reseller.example/x','reseller',1900,null,'exact',0.9,false,true);
 insert into public.market_price_evidence(store_code,sku,url,retailer,price_minor,match,confidence) values ('sa','FIXA','https://shop-a.example/p/1','shop-a',10900,'exact',0.9)
  on conflict (store_code,sku,url) do update set price_minor=excluded.price_minor, seen_at=now();
 if (select count(*) from public.market_price_evidence where store_code='sa' and sku='FIXA')<>3 then raise exception 'duplicate page rows'; end if;
 insert into public.market_research_cache(store_code,sku,research,cost_microusd,web_searches,basis,shops,shops_ignored,median_minor,cheapest_minor,cheapest_retailer)
  values ('sa','FIXA','{"facts":[{"kind":"material","fact":"Stainless steel blade","url":"https://maker.example/x","cited":true}]}',21000,2,'exact',2,1,12650,10900,'shop-a');
 begin insert into public.market_price_evidence(store_code,sku,url,retailer,price_minor,match,confidence) values ('sa','X','javascript:alert(1)','x',1,'exact',1); raise exception 'bad url accepted';
 exception when check_violation then null; end;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 res:=public.brain_market_evidence('sa');
 if (res->>'products')::int<1 or (res->>'research_cost_microusd')::bigint<21000 then raise exception 'totals %',res; end if;
 res:=public.brain_market_evidence('sa','FIXA');
 if jsonb_array_length(res->'shops')<>3 or (res->'shops'->0->>'price_minor')::bigint<>10900 or (res->'shops'->2->>'credible')::boolean
    or (res->'summary'->>'cheapest_minor')::bigint<>10900 or res->'facts'->0->>'kind'<>'material' or res->'summary' ? 'research' then raise exception 'product %',res; end if;
 if has_table_privilege('anon','public.market_price_evidence','select') or has_table_privilege('authenticated','public.market_research_cache','select')
    or has_function_privilege('anon','public.brain_market_evidence(text,text)','execute') then raise exception 'privileges'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin perform public.brain_market_evidence('sa'); raise exception 'a non-member read shop prices';
 exception when sqlstate '42501' then null; end;
 raise notice 'market evidence: all checks passed';
end $$;
rollback;
