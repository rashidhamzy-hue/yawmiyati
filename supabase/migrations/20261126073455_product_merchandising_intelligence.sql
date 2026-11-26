
alter table public.commerce_analytics_events drop constraint if exists commerce_analytics_events_event_type_check;
alter table public.commerce_analytics_events add constraint commerce_analytics_events_event_type_check check (event_type = any (array['product_impression','product_click','product_view','add_to_cart','remove_from_cart','checkout_start','order_submitted','order_delivered','order_cancelled','order_returned']::text[]));
alter table public.commerce_analytics_events
 add column if not exists session_id text,
 add column if not exists placement text,
 add column if not exists quantity integer,
 add column if not exists value_minor bigint,
 add column if not exists currency text,
 add column if not exists source text not null default 'storefront',
 add column if not exists is_test boolean not null default false,
 add column if not exists properties jsonb not null default '{}'::jsonb;
alter table public.commerce_analytics_events add constraint commerce_events_qty_positive check (quantity is null or quantity > 0);
alter table public.commerce_analytics_events add constraint commerce_events_value_nonnegative check (value_minor is null or value_minor >= 0);
alter table public.commerce_analytics_events add constraint commerce_events_properties_object check (jsonb_typeof(properties) = 'object');
create index if not exists commerce_events_listing_time_idx on public.commerce_analytics_events(store_code,listing_id,occurred_at desc) where listing_id is not null and is_test=false;
alter table public.listing_variants
 add column if not exists supplier_cost_minor bigint,
 add column if not exists delivery_cost_minor bigint,
 add column if not exists other_cost_minor bigint;
alter table public.listing_variants add constraint listing_variants_costs_nonnegative check (
 (supplier_cost_minor is null or supplier_cost_minor>=0) and
 (delivery_cost_minor is null or delivery_cost_minor>=0) and
 (other_cost_minor is null or other_cost_minor>=0));
create table if not exists public.product_merchandising_scores (
 store_code text not null references public.stores(code),
 listing_id uuid not null,
 calculated_at timestamptz not null default now(),
 window_days integer not null default 30 check(window_days between 1 and 90),
 impressions bigint not null default 0 check(impressions>=0),
 clicks bigint not null default 0 check(clicks>=0),
 product_views bigint not null default 0 check(product_views>=0),
 add_to_carts bigint not null default 0 check(add_to_carts>=0),
 checkout_starts bigint not null default 0 check(checkout_starts>=0),
 submitted_orders bigint not null default 0 check(submitted_orders>=0),
 delivered_orders bigint not null default 0 check(delivered_orders>=0),
 cancelled_orders bigint not null default 0 check(cancelled_orders>=0),
 returned_orders bigint not null default 0 check(returned_orders>=0),
 revenue_minor bigint not null default 0,
 estimated_cost_minor bigint,
 contribution_minor bigint,
 conversion_rate numeric(8,5),
 add_to_cart_rate numeric(8,5),
 click_through_rate numeric(8,5),
 score numeric(6,2) not null default 0 check(score between 0 and 100),
 confidence numeric(5,4) not null default 0 check(confidence between 0 and 1),
 merchandising_state text not null default 'testing' check(merchandising_state in ('testing','promote','suppressed')),
 eligible_for_promotion boolean not null default false,
 decision_reasons jsonb not null default '[]'::jsonb check(jsonb_typeof(decision_reasons)='array'),
 primary key(store_code,listing_id),
 foreign key(store_code,listing_id) references public.country_listings(store_code,id) on delete cascade
);
create index if not exists product_merchandising_scores_rank_idx on public.product_merchandising_scores(store_code,merchandising_state,score desc,calculated_at desc);
alter table public.product_merchandising_scores enable row level security;
revoke all on public.product_merchandising_scores from anon,authenticated;
grant all on public.product_merchandising_scores to service_role;
comment on table public.product_merchandising_scores is 'Server-calculated market-specific product performance and promotion eligibility; never directly exposed to storefront clients.';
comment on column public.commerce_analytics_events.is_test is 'Fixture, QA, preview and synthetic events are excluded from commercial scoring.';
create or replace function public.refresh_product_merchandising_scores(p_window_days integer default 30)
returns integer language plpgsql set search_path = '' as $$
declare v_count integer;
begin
 if p_window_days < 1 or p_window_days > 90 then raise exception 'p_window_days must be 1..90'; end if;
 with ev as (
  select store_code,listing_id,
   count(*) filter(where event_type='product_impression')::bigint impressions,
   count(*) filter(where event_type='product_click')::bigint clicks,
   count(*) filter(where event_type='product_view')::bigint product_views,
   count(*) filter(where event_type='add_to_cart')::bigint carts,
   count(*) filter(where event_type='checkout_start')::bigint checkouts
  from public.commerce_analytics_events
  where occurred_at>=now()-make_interval(days=>p_window_days) and listing_id is not null and is_test=false
  group by store_code,listing_id
 ), ord as (
  select o.store_code,ol.variant_id,
   count(distinct o.id) filter(where o.status not in ('cancelled','failed'))::bigint submitted,
   count(distinct o.id) filter(where o.status='delivered')::bigint delivered,
   count(distinct o.id) filter(where o.status='cancelled')::bigint cancelled,
   count(distinct o.id) filter(where o.status='returned')::bigint returned,
   sum(ol.quantity*ol.unit_minor) filter(where o.status='delivered')::bigint revenue,
   sum(ol.quantity*(v.supplier_cost_minor+v.delivery_cost_minor+v.other_cost_minor))
    filter(where o.status='delivered' and v.supplier_cost_minor is not null and v.delivery_cost_minor is not null and v.other_cost_minor is not null)::bigint known_cost,
   bool_and(v.supplier_cost_minor is not null and v.delivery_cost_minor is not null and v.other_cost_minor is not null)
    filter(where o.status='delivered') costs_complete
  from public.orders o join public.order_lines ol on ol.store_code=o.store_code and ol.order_id=o.id
  join public.listing_variants v on v.store_code=ol.store_code and v.id=ol.variant_id
  where o.created_at>=now()-make_interval(days=>p_window_days)
  group by o.store_code,ol.variant_id
 ), om as (
  select v.store_code,v.listing_id,
   coalesce(sum(o.submitted),0)::bigint submitted,coalesce(sum(o.delivered),0)::bigint delivered,
   coalesce(sum(o.cancelled),0)::bigint cancelled,coalesce(sum(o.returned),0)::bigint returned,
   coalesce(sum(o.revenue),0)::bigint revenue,
   case when bool_and(o.costs_complete) filter(where o.delivered>0)
    then coalesce(sum(o.known_cost),0)::bigint else null end costs
  from public.listing_variants v left join ord o on o.store_code=v.store_code and o.variant_id=v.id
  group by v.store_code,v.listing_id
 ), b as (
  select l.store_code,l.id listing_id,l.status,
   coalesce(e.impressions,0)::bigint impressions,coalesce(e.clicks,0)::bigint clicks,
   coalesce(e.product_views,0)::bigint views,coalesce(e.carts,0)::bigint carts,
   coalesce(e.checkouts,0)::bigint checkouts,coalesce(o.submitted,0)::bigint submitted,
   coalesce(o.delivered,0)::bigint delivered,coalesce(o.cancelled,0)::bigint cancelled,
   coalesce(o.returned,0)::bigint returned,coalesce(o.revenue,0)::bigint revenue,o.costs,
   exists(select 1 from public.listing_variants v join public.verified_stock_evidence s
    on s.store_code=v.store_code and s.variant_id=v.id
    where v.store_code=l.store_code and v.listing_id=l.id and v.stock_state='available'
     and s.state='available' and s.verified_at>=now()-interval '72 hours') stock_ok,
   exists(select 1 from public.listing_variants v where v.store_code=l.store_code and v.listing_id=l.id and v.price_minor>0) price_ok,
   exists(select 1 from public.listing_variants v where v.store_code=l.store_code and v.listing_id=l.id
    and v.supplier_cost_minor is not null and v.delivery_cost_minor is not null and v.other_cost_minor is not null) cost_inputs_ok
  from public.country_listings l left join ev e on e.store_code=l.store_code and e.listing_id=l.id
  left join om o on o.store_code=l.store_code and o.listing_id=l.id
 ), calc as (
  select b.*,
   case when costs is not null then revenue-costs else null end contribution,
   least(100::numeric,(delivered+1)::numeric/(impressions+20)*1000) conv_s,
   least(100::numeric,delivered*10) velocity_s,
   case when costs is not null and impressions>0 then greatest(0::numeric,least(100::numeric,((revenue-costs)::numeric/impressions)/5)) else 0::numeric end profit_s,
   least(100::numeric,carts::numeric/greatest(impressions,1)*500) cart_s,
   least(100::numeric,clicks::numeric/greatest(impressions,1)*500) ctr_s,
   greatest(0::numeric,100-((cancelled+returned)::numeric/greatest(delivered+cancelled+returned,1))*100) quality_s
  from b
 ), final as (
  select c.*,(conv_s*.25+velocity_s*.20+profit_s*.20+cart_s*.15+ctr_s*.10+quality_s*.10) total_score
  from calc c
 )
 insert into public.product_merchandising_scores(store_code,listing_id,calculated_at,window_days,impressions,clicks,product_views,add_to_carts,checkout_starts,submitted_orders,delivered_orders,cancelled_orders,returned_orders,revenue_minor,estimated_cost_minor,contribution_minor,conversion_rate,add_to_cart_rate,click_through_rate,score,confidence,merchandising_state,eligible_for_promotion,decision_reasons)
 select store_code,listing_id,now(),p_window_days,impressions,clicks,views,carts,checkouts,submitted,delivered,cancelled,returned,revenue,costs,contribution,
  round((delivered+1)::numeric/(impressions+20),5),round(carts::numeric/greatest(impressions,1),5),round(clicks::numeric/greatest(impressions,1),5),
  round(total_score,2),least(1::numeric,impressions::numeric/100,delivered::numeric/3),
  case when status<>'published' or not stock_ok or not price_ok or not cost_inputs_ok or costs is null or contribution<=0 then 'suppressed'
   when impressions>=100 and delivered=0 then 'suppressed'
   when impressions>=100 and delivered>=3 and total_score>=60 then 'promote' else 'testing' end,
  (status='published' and stock_ok and price_ok and cost_inputs_ok and costs is not null and contribution>0 and impressions>=100 and delivered>=3 and total_score>=60),
  to_jsonb(array_remove(array[
   case when status<>'published' then 'listing_not_published' end,
   case when not stock_ok then 'stock_not_verified_within_72h' end,
   case when not price_ok then 'missing_valid_price' end,
   case when not cost_inputs_ok then 'missing_verified_cost_inputs' end,
   case when costs is null then 'insufficient_delivered_order_cost_evidence' end,
   case when contribution<=0 then 'non_positive_contribution' end,
   case when impressions<100 then 'insufficient_impression_sample' end,
   case when delivered<3 then 'insufficient_delivered_order_sample' end,
   case when impressions>=100 and delivered=0 then 'no_delivered_orders_after_100_impressions' end
  ]::text[],null))
 from final
 on conflict(store_code,listing_id) do update set
  calculated_at=excluded.calculated_at,window_days=excluded.window_days,impressions=excluded.impressions,clicks=excluded.clicks,
  product_views=excluded.product_views,add_to_carts=excluded.add_to_carts,checkout_starts=excluded.checkout_starts,
  submitted_orders=excluded.submitted_orders,delivered_orders=excluded.delivered_orders,cancelled_orders=excluded.cancelled_orders,
  returned_orders=excluded.returned_orders,revenue_minor=excluded.revenue_minor,estimated_cost_minor=excluded.estimated_cost_minor,
  contribution_minor=excluded.contribution_minor,conversion_rate=excluded.conversion_rate,add_to_cart_rate=excluded.add_to_cart_rate,
  click_through_rate=excluded.click_through_rate,score=excluded.score,confidence=excluded.confidence,
  merchandising_state=excluded.merchandising_state,eligible_for_promotion=excluded.eligible_for_promotion,decision_reasons=excluded.decision_reasons;
 get diagnostics v_count=row_count; return v_count;
end; $$;
revoke all on function public.refresh_product_merchandising_scores(integer) from public,anon,authenticated;
grant execute on function public.refresh_product_merchandising_scores(integer) to service_role;
