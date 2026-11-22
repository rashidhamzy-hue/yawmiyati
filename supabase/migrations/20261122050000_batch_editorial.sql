-- Approved pages attach to existing commerce listings and their source revisions.
create table public.listing_editorial_pages(
 store_code text not null,listing_id uuid not null,revision text not null,
 page jsonb not null,source_revision uuid not null,approved_by uuid not null,
 primary key(store_code,listing_id),
 foreign key(store_code,listing_id) references public.country_listings(store_code,id));
alter table public.listing_editorial_pages enable row level security;
revoke all on public.listing_editorial_pages from public,anon,authenticated;

create function public.import_editorial_batch(p_store text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare x jsonb; c public.catalog_import_candidates%rowtype; d public.candidate_draft_links%rowtype;
 e public.listing_editorial_pages%rowtype; r public.candidate_commercial_review%rowtype;
 p jsonb; w jsonb; listing uuid; variant uuid; product uuid; content_id uuid; buyer jsonb;
 prior jsonb; review_at timestamptz; result jsonb:='[]'; uid uuid:=auth.uid();
begin
 if uid is null or not exists(select 1 from public.dashboard_members where user_id=uid and store_code=p_store) then raise insufficient_privilege; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 150 or octet_length(p_items::text)>24000000 then raise exception 'Invalid batch size'; end if;
 for x in select value from jsonb_array_elements(p_items) order by (value#>>'{woo,productId}')::bigint,(value#>>'{woo,variationId}')::bigint loop
  p:=x->'proposal'; w:=x->'woo'; buyer:=x->'page';
  if not coalesce(x->>'schema'='yawmiyati-editorial-2' and x->'demo'='false'::jsonb and x->>'market'=p_store and
   p->>'revision'=x->>'revision' and p->>'sku'=x->>'sku' and p->>'title'=buyer->>'title' and
   length(trim(buyer->>'description')) between 1 and 10000 and length(trim(buyer->>'seoTitle')) between 1 and 100
   and length(trim(buyer->>'seoDescription')) between 1 and 300 and length(trim(buyer->>'category')) between 1 and 500
   and jsonb_array_length(buyer->'faq') between 1 and 50 and jsonb_array_length(buyer->'images') between 0 and 24
   and buyer->'components'=p->'components' and buyer->'priceMinor'=p->'priceMinor'
   and (buyer->>'shippingMinor') ~ '^[0-9]{1,12}$' and jsonb_typeof(buyer->'shippingMinor')='number'
   and length(trim(buyer->>'title')) between 1 and 500,false) then raise exception 'Invalid editorial packet'; end if;
  if exists(select 1 from jsonb_array_elements(buyer->'images') a where not coalesce(a->>'src' ~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+=*$' and length(a->>'alt') between 1 and 180,false))
   or exists(select 1 from jsonb_array_elements(buyer->'faq') a where not coalesce(length(a->>'question') between 1 and 500 and length(a->>'answer') between 1 and 4000,false)) then raise exception 'Invalid editorial fields'; end if;
  select * into strict c from public.catalog_import_candidates where store_code=p_store and woo_product_id=(w->>'productId')::bigint and woo_variation_id=(w->>'variationId')::bigint for update;
  if c.supplier_sku is distinct from x->>'sku' or c.observed_at is distinct from (w->>'observedAt')::timestamptz or c.observed_stock='unavailable'
    or c.observed_at not between now()-interval '24 hours' and now() then raise exception 'Source changed or stale'; end if;
  select * into d from public.candidate_draft_links where (store_code,woo_product_id,woo_variation_id)=(p_store,c.woo_product_id,c.woo_variation_id);
  select * into e from public.listing_editorial_pages where store_code=p_store and listing_id=d.listing_id;
  prior:=public.owner_offer_decision(p_store,c.supplier_sku);
  if prior is not null and (prior->'proposal'<>p or prior->'approved'<>'true'::jsonb) then raise exception 'Conflicting account decision for %',c.supplier_sku; end if;
  if e.revision=x->>'revision' and e.page=buyer and exists(select 1 from public.candidate_content_approvals a
    where a.revision_id=d.revision_id and a.source_observed_at=c.observed_at and e.source_revision=a.revision_id) then listing:=d.listing_id;
  else
   if d.listing_id is not null then raise exception 'Existing listing requires reviewed revision update: %',c.supplier_sku; end if;
   perform public.save_owner_offer_decision(p_store,p,true,coalesce((prior->>'sequence')::bigint,0));
   select * into r from public.candidate_commercial_review where (store_code,woo_product_id,woo_variation_id)=(p_store,c.woo_product_id,c.woo_variation_id) for update;
   if not coalesce((x#>>'{cost,supplier}') ~ '^[0-9]{1,10}$' and (x#>>'{cost,delivery}') ~ '^[0-9]{1,10}$' and (x#>>'{cost,other}') ~ '^[0-9]{1,10}$',false) then raise exception 'Missing commercial costs'; end if;
   if r.updated_at is not null then
    if r.decision<>'shortlisted' or r.proposed_price_minor is distinct from (p->>'priceMinor')::bigint or r.supplier_cost_minor is distinct from (x#>>'{cost,supplier}')::bigint or r.delivery_cost_minor is distinct from (x#>>'{cost,delivery}')::bigint or r.other_cost_minor is distinct from (x#>>'{cost,other}')::bigint then raise exception 'Commercial conflict'; end if;
    review_at:=r.updated_at;
   else
    insert into public.candidate_commercial_review(store_code,woo_product_id,woo_variation_id,supplier_cost_minor,delivery_cost_minor,other_cost_minor,proposed_price_minor,decision,updated_by)
    values(p_store,c.woo_product_id,c.woo_variation_id,(x#>>'{cost,supplier}')::bigint,(x#>>'{cost,delivery}')::bigint,(x#>>'{cost,other}')::bigint,(p->>'priceMinor')::bigint,'shortlisted',uid) returning updated_at into review_at;
   end if;
   insert into public.candidate_content_approvals(store_code,woo_product_id,woo_variation_id,title,description,source_observed_at,approved_by)
    values(p_store,c.woo_product_id,c.woo_variation_id,buyer->>'title',buyer->>'description',c.observed_at,uid) returning revision_id into content_id;
   insert into public.catalog_products default values returning id into product;
   insert into public.country_listings(store_code,product_id,slug,title,status) values(p_store,product,'supplier-'||c.woo_product_id||case when c.woo_variation_id=0 then '' else '-'||c.woo_variation_id end,buyer->>'title','draft') returning id into listing;
   insert into public.listing_variants(store_code,listing_id,sku,price_minor,stock_state) values(p_store,listing,c.supplier_sku,(p->>'priceMinor')::bigint,'unknown') returning id into variant;
   insert into public.supplier_variant_mappings(store_code,variant_id,supplier_sku,woo_product_id,woo_variation_id) values(p_store,variant,c.supplier_sku,c.woo_product_id,c.woo_variation_id);
   insert into public.candidate_draft_links(store_code,woo_product_id,woo_variation_id,revision_id,review_at,listing_id,created_by) values(p_store,c.woo_product_id,c.woo_variation_id,content_id,review_at,listing,uid);
   insert into public.listing_editorial_pages values(p_store,listing,x->>'revision',buyer,content_id,uid);
  end if;
  result:=result||jsonb_build_array(jsonb_build_object('listing',listing,'sku',c.supplier_sku));
 end loop;
 return result;
end $$;
create function public.owner_editorial_page(p_store text,p_listing uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select e.page from public.listing_editorial_pages e where e.store_code=p_store and e.listing_id=p_listing
 and exists(select 1 from public.dashboard_members where store_code=p_store and user_id=auth.uid())
$$;
create function public.public_editorial_page(p_store text,p_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
 select e.page from public.public_catalog_detail(p_store,p_slug) l join public.listing_editorial_pages e on e.store_code=p_store and e.listing_id=l.listing_id
 join public.candidate_draft_links d on d.store_code=p_store and d.listing_id=l.listing_id and d.revision_id=e.source_revision
 where l.price_minor=(e.page->>'priceMinor') and l.title=e.page->>'title' and l.description=e.page->>'description'
 and (select (o.approved and o.proposal->>'revision'=e.revision) from public.offline_offer_decisions o
 where o.store_code=p_store and o.owner_id=e.approved_by and o.sku=(select c.supplier_sku from public.catalog_import_candidates c where (c.store_code,c.woo_product_id,c.woo_variation_id)=(d.store_code,d.woo_product_id,d.woo_variation_id)) order by o.sequence desc limit 1)
$$;
revoke all on function public.import_editorial_batch(text,jsonb), public.owner_editorial_page(text,uuid), public.public_editorial_page(text,text) from public,anon;
grant execute on function public.import_editorial_batch(text,jsonb), public.owner_editorial_page(text,uuid) to authenticated;
grant execute on function public.public_editorial_page(text,text) to anon,authenticated;
notify pgrst,'reload schema';
