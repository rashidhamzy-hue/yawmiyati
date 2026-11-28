-- Rollback-only fixture test for supabase/migrations/20261130120000_order_tracking_scorecards.sql.
-- Proves: orders are stored once and follow their lifecycle (a newer reading updates, an older one is ignored, the
-- first time a state is seen is kept); the profit snapshot uses Taager's cost and Saudi VAT; daily scorecards combine
-- PostHog aggregates with order outcomes per product and per traffic source; unknown product slugs are dropped;
-- no name, address or raw phone can be stored; the owner reads totals, non-members and anon read nothing.
begin;
do $$
declare u uuid; r uuid; res jsonb; la uuid; sa_slug text; sc jsonb; p jsonb; h text := repeat('ab', 32);
  img1 text := 'https://media.taager.com/11111111-2222-3333-4444-555555555555.jpg';
  fin jsonb := '{"price":140,"originalPrice":77,"profit":63}';
  d0 timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc' - interval '1 day' + interval '10 hours';
  o jsonb;
begin
 select user_id into u from public.dashboard_members where store_code='sa' limit 1;
 if u is null then raise exception 'No staging owner'; end if;
 insert into public.brain_runs(store_code,stage,status) values('sa','review','awaiting_review') returning id into r;
 insert into public.taager_catalog(market,sku,product_id,variant_id,item_type,name,listing,detail,financials) values
  ('sa','FIXA',900000301,0,'product','a',jsonb_build_object('financials',fin),jsonb_build_object('variant',jsonb_build_object('images',jsonb_build_array(img1))),fin);
 insert into public.brain_product_analysis(run_id,store_code,product_id,variation_id,title,offer_kind,stage,score,decision,content,owner_decision) values
  (r,'sa',900000301,0,'a','single','selected',9,'{"state":"priced","price_minor":14900}','{"title":"خلاط","description":"وصف.","image_alt":["صورة"],"category":"kitchen","seo":{"slug":"blender"},"issues":[]}','approved');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 perform public.brain_publish_approved('sa',r);
 select b.listing_id, l.slug into la, sa_slug from public.brain_listings b join public.country_listings l on l.id=b.listing_id where b.store_code='sa' and b.sku='FIXA';

 -- 1. Three orders placed yesterday: 1 delivered, 2 refused (price), 3 still placed. Order 1 holds 2 pieces for 268.
 o := jsonb_build_array(
  jsonb_build_object('woo_order_id',900001,'order_number','1001','status','placed','raw_status','processing','placed_at',d0,'modified_at',d0,'total_minor',29600,'delivery_minor',2800,
    'items',jsonb_build_array(jsonb_build_object('sku','FIXA','quantity',2,'total_minor',26800)),'source',jsonb_build_object('source','facebook','medium','paid','campaign','launch','paid_click','fbclid'),'phone_hash',h),
  jsonb_build_object('woo_order_id',900002,'order_number','1002','status','placed','raw_status','processing','placed_at',d0,'modified_at',d0,'total_minor',17700,'delivery_minor',2800,
    'items',jsonb_build_array(jsonb_build_object('sku','FIXA','quantity',1,'total_minor',14900)),'source',jsonb_build_object('source','facebook','medium','paid','campaign','launch'),'phone_hash',h),
  jsonb_build_object('woo_order_id',900003,'order_number','1003','status','placed','raw_status','processing','placed_at',d0,'modified_at',d0,'total_minor',17700,'delivery_minor',2800,
    'items',jsonb_build_array(jsonb_build_object('sku','FIXA','quantity',1,'total_minor',14900)),'source',jsonb_build_object('source',null)));
 res := public.order_tracking_upsert('sa', o);
 if (res->>'new')::int<>3 then raise exception 'first upsert %',res; end if;
 -- Profit snapshot for 2 pieces at 268: 268 - 154 - 15% x (268 - 280 -> 0) = 114.00
 if (select profit_minor from public.order_tracking where woo_order_id=900001)<>11400 then raise exception 'profit %',(select profit_minor from public.order_tracking where woo_order_id=900001); end if;
 -- Same reading again: nothing new, nothing changed.
 res := public.order_tracking_upsert('sa', o);
 if (res->>'new')::int<>0 or (res->>'status_changed')::int<>0 or (select count(*) from public.order_tracking where store_code='sa' and woo_order_id between 900001 and 900003)<>3 then raise exception 'not idempotent %',res; end if;

 -- 2. Lifecycle: order 1 confirmed, then delivered; order 2 refused with a reason. An OLDER reading of order 1 is ignored.
 perform public.order_tracking_upsert('sa', jsonb_build_array(jsonb_build_object('woo_order_id',900001,'order_number','1001','status','confirmed','raw_status','confirmed','placed_at',d0,'modified_at',d0+interval '2 hours')));
 perform public.order_tracking_upsert('sa', jsonb_build_array(
   jsonb_build_object('woo_order_id',900001,'order_number','1001','status','delivered','raw_status','completed','placed_at',d0,'modified_at',d0+interval '20 hours'),
   jsonb_build_object('woo_order_id',900002,'order_number','1002','status','refused','raw_status','wc-refused','reason','السعر غالي','reason_bucket','price','placed_at',d0,'modified_at',d0+interval '21 hours')));
 perform public.order_tracking_upsert('sa', jsonb_build_array(jsonb_build_object('woo_order_id',900001,'order_number','1001','status','placed','raw_status','processing','placed_at',d0,'modified_at',d0+interval '1 hour')));
 if (select status from public.order_tracking where woo_order_id=900001)<>'delivered'
    or (select confirmed_at from public.order_tracking where woo_order_id=900001)<>d0+interval '2 hours'
    or (select closed_at from public.order_tracking where woo_order_id=900001)<>d0+interval '20 hours'
    or (select reason_bucket from public.order_tracking where woo_order_id=900002)<>'price'
    or (select items->0->>'sku' from public.order_tracking where woo_order_id=900001)<>'FIXA' then raise exception 'lifecycle %',(select jsonb_agg(to_jsonb(t)) from public.order_tracking t where woo_order_id between 900001 and 900003); end if;

 -- 3. Yesterday's PostHog aggregates + the order roll-up. A slug that is not a product of this store is dropped.
 res := public.scorecard_write_funnel('sa', (d0 at time zone 'utc')::date,
   jsonb_build_array(jsonb_build_object('slug',sa_slug,'views',400,'add_to_cart',30,'list_impressions',2000,'list_clicks',90,'scroll_75',120), jsonb_build_object('slug','not-a-product','views',9)),
   jsonb_build_array(jsonb_build_object('source','facebook','medium','paid','campaign','launch','visits',500,'product_views',380,'add_to_cart',28,'checkout_starts',9),
                     jsonb_build_object('source','direct','medium','','campaign','','visits',40,'product_views',20,'add_to_cart',2,'checkout_starts',1)),
   jsonb_build_array(jsonb_build_object('query','مكواة بخار','searches',7)));
 if (res->>'products')::int<>1 or (res->>'sources')::int<>2 then raise exception 'funnel %',res; end if;
 perform public.scorecard_rollup_orders('sa', (d0 at time zone 'utc')::date);
 perform public.scorecard_rollup_orders('sa', (d0 at time zone 'utc')::date); -- twice: same result
 sc := public.brain_scorecards('sa', 14);
 select x into p from jsonb_array_elements(sc->'products') x where x->>'listing_id'=la::text;
 if (p->'counts'->>'views')::int<>400 or (p->'counts'->>'list_clicks')::int<>90 or (p->'counts'->>'orders')::int<>3 or (p->'counts'->>'delivered')::int<>1
    or (p->'counts'->>'refused')::int<>1 or (p->'counts'->>'profit_delivered_minor')::bigint<>11400 or (p->'counts'->'refusal_reasons'->>'price')::int<>1
    or (p->>'cost_minor')::bigint<>7700 or not (p->>'visible')::boolean is not null then raise exception 'product card %',p; end if;
 select x into p from jsonb_array_elements(sc->'sources') x where x->>'source'='facebook';
 if (p->>'visits')::int<>500 or (p->>'orders')::int<>2 or (p->>'delivered')::int<>1 or (p->>'undelivered')::int<>1 or (p->>'profit_delivered_minor')::bigint<>11400 then raise exception 'source card %',p; end if;
 if (sc->'orders'->>'placed')::int<3 or (sc->'orders'->>'delivered')::int<1 or sc->'search_gaps'->0->>'query'<>'مكواة بخار' then raise exception 'totals %',sc->'orders'; end if;

 -- 4. Nothing personal can be stored: the table has no such column, and a raw phone is not a valid hash.
 if exists (select 1 from information_schema.columns where table_schema='public' and table_name in ('order_tracking','product_scorecard_daily','source_scorecard_daily')
            and column_name ~ '(name|address|email|phone$|city|session|visitor|distinct)') then raise exception 'personal column present'; end if;
 begin perform public.order_tracking_upsert('sa', jsonb_build_array(jsonb_build_object('woo_order_id',900009,'order_number','x','status','placed','placed_at',d0,'modified_at',d0,'phone_hash','966501234567')));
   raise exception 'raw phone accepted'; exception when check_violation then null; end;

 -- 5. Privileges.
 if has_table_privilege('authenticated','public.order_tracking','select') or has_table_privilege('anon','public.product_scorecard_daily','select')
    or has_function_privilege('authenticated','public.order_tracking_upsert(text,jsonb)','execute') or has_function_privilege('anon','public.brain_scorecards(text,integer)','execute')
    or has_function_privilege('authenticated','public.scorecard_window(text,integer)','execute') then raise exception 'privileges'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin perform public.brain_scorecards('sa',14); raise exception 'a non-member read scorecards';
 exception when sqlstate '42501' then null; end;
 raise notice 'order tracking and scorecards: all checks passed';
end $$;
rollback;
