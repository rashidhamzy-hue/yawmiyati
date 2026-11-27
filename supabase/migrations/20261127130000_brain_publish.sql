-- Publish owner-approved Yawmiyati Brain picks (Taager source) to the storefront.
-- Owner-only RPCs create or refresh the listing from the brain's approved Arabic page, price and Taager media ids.
-- Visibility is re-checked on every public read against the latest owner-run Taager sync:
--   market release flag on, listing published, in stock, sync fresh enough, price still above Taager's cost.
-- Taager's minimum and maximum selling prices are references only (owner decision, 27 Nov 2026): the brain
-- prices from cost, margin and other shops; the one hard rule is never selling at a loss.
-- Nothing here enables checkout, submits orders or changes a release flag on its own.

alter table public.brain_settings
  add column if not exists stock_max_age_hours integer not null default 72 check (stock_max_age_hours between 1 and 720);

create table public.brain_listings (
  store_code text not null references public.stores(code),
  listing_id uuid not null,
  variant_id uuid not null,
  sku text not null,
  taager_product_id bigint not null,
  taager_variant_id bigint not null default 0,
  run_id uuid references public.brain_runs(id) on delete set null,
  price_minor bigint not null check (price_minor > 0),
  category text check (category in ('home','kitchen','beauty','fashion','wellness','organize')),
  page jsonb not null,
  media jsonb not null default '[]'::jsonb,
  published_by uuid not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store_code, listing_id),
  unique (store_code, sku),
  foreign key (store_code, listing_id) references public.country_listings(store_code, id),
  foreign key (store_code, variant_id) references public.listing_variants(store_code, id)
);
create table public.catalog_release_log (
  id bigint generated always as identity primary key,
  store_code text not null references public.stores(code),
  enabled boolean not null,
  changed_by uuid not null,
  changed_at timestamptz not null default now()
);
alter table public.brain_listings enable row level security;
alter table public.catalog_release_log enable row level security;
revoke all on public.brain_listings, public.catalog_release_log from public, anon, authenticated;

-- Taager's own stock signals for one catalogue row (detail from full reads, listing from every read).
create function public.taager_row_orderable(p_listing jsonb, p_detail jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_detail->>'active', 'true') <> 'false'
     and coalesce(p_detail->'variant'->'merchantInfo'->>'orderable', 'true') <> 'false'
     and coalesce(p_detail->'variant'->>'availability', 'available') in ('available', 'limited')
     and coalesce(p_listing->'stockAvailability'->>'stockRange', '') <> 'not_available'
$$;

-- A Taager decimal amount as integer minor units; null when absent, zero or not a number.
create function public.taager_minor(p_value jsonb, p_digits smallint) returns bigint
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_value) = 'number' and (p_value #>> '{}')::numeric > 0
              then round((p_value #>> '{}')::numeric * power(10::numeric, p_digits))::bigint end
$$;

-- Every brain listing with the reason it is hidden (null = would be shown once the market is released).
create function public.brain_listing_state(p_store text)
returns table(listing_id uuid, slug text, title text, description text, price_minor bigint, currency text,
              category text, image text, sku text, hidden_reason text)
language sql stable security definer set search_path = '' as $$
  select l.id, l.slug, l.title, b.page->>'description', b.price_minor, s.currency, b.category, b.media->0->>'id', b.sku,
    case
      when l.status <> 'published' then 'unpublished'
      when v.price_minor <> b.price_minor then 'price_mismatch'
      when t.sku is null then 'missing_from_catalogue'
      when t.synced_at < now() - make_interval(hours => bs.stock_max_age_hours) then 'stale_sync'
      when not public.taager_row_orderable(t.listing, t.detail) then 'out_of_stock'
      when public.taager_minor(t.financials->'originalPrice', s.minor_digits) is null then 'no_supplier_cost'
      when b.price_minor <= public.taager_minor(t.financials->'originalPrice', s.minor_digits) then 'below_supplier_cost'
    end
  from public.brain_listings b
  join public.stores s on s.code = b.store_code
  join public.brain_settings bs on bs.store_code = b.store_code
  join public.country_listings l on (l.store_code, l.id) = (b.store_code, b.listing_id)
  join public.listing_variants v on (v.store_code, v.id, v.listing_id) = (b.store_code, b.variant_id, b.listing_id)
  left join public.taager_catalog t on (t.market, t.sku) = (b.store_code, b.sku)
  where b.store_code = p_store
$$;
revoke all on function public.brain_listing_state(text) from public, anon, authenticated;
revoke all on function public.taager_row_orderable(jsonb, jsonb), public.taager_minor(jsonb, smallint) from public, anon, authenticated;

-- Shared read guard, now with two sources: the earlier candidate/draft path and brain listings.
create or replace function public.current_catalog_release(p_store text)
returns table(listing_id uuid,slug text,title text,description text,price_minor text,currency text)
language sql stable security definer set search_path='' as $$
 select l.id,l.slug,a.title,a.description,v.price_minor::text,s.currency
 from public.country_listings l
 join public.stores s on s.code=l.store_code
 join public.candidate_draft_links d on (d.store_code,d.listing_id)=(l.store_code,l.id)
 join public.catalog_import_candidates c on (c.store_code,c.woo_product_id,c.woo_variation_id)=(d.store_code,d.woo_product_id,d.woo_variation_id)
 join public.candidate_content_approvals a on (a.store_code,a.woo_product_id,a.woo_variation_id,a.revision_id)=(d.store_code,d.woo_product_id,d.woo_variation_id,d.revision_id)
 join public.candidate_commercial_review r on (r.store_code,r.woo_product_id,r.woo_variation_id)=(d.store_code,d.woo_product_id,d.woo_variation_id)
 join public.supplier_variant_mappings m on (m.store_code,m.woo_product_id,m.woo_variation_id)=(d.store_code,d.woo_product_id,d.woo_variation_id)
 join public.listing_variants v on (v.store_code,v.id,v.listing_id)=(m.store_code,m.variant_id,l.id)
 join public.verified_stock_evidence e on (e.store_code,e.variant_id)=(v.store_code,v.id)
 where l.store_code=p_store and s.catalog_release_enabled and l.status='published'
 and v.stock_state='available' and e.state='available' and v.stock_checked_at=e.verified_at and e.verified_at between now()-interval '15 minutes' and now()
 and r.updated_at=d.review_at and r.decision='shortlisted' and r.proposed_price_minor=v.price_minor and r.supplier_cost_minor is not null and r.delivery_cost_minor is not null and r.other_cost_minor is not null
 and c.observed_stock<>'unavailable' and c.supplier_sku=m.supplier_sku and a.source_observed_at=c.observed_at
 and not exists(select 1 from public.candidate_content_approvals n where (n.store_code,n.woo_product_id,n.woo_variation_id)=(a.store_code,a.woo_product_id,a.woo_variation_id) and n.approval_sequence>a.approval_sequence)
 union all
 select b.listing_id,b.slug,b.title,b.description,b.price_minor::text,b.currency
 from public.brain_listing_state(p_store) b
 where b.hidden_reason is null and exists(select 1 from public.stores s where s.code=p_store and s.catalog_release_enabled)
$$;
revoke all on function public.current_catalog_release(text) from public,anon,authenticated;

-- Listing cards also carry the owner-approved category and first picture id (brain listings only).
drop function public.public_catalog(text,integer,integer);
create function public.public_catalog(p_store text,p_limit integer default 50,p_offset integer default 0)
returns table(listing_id uuid,slug text,title text,price_minor text,currency text,approved_category_slugs text[],category_release text,image text)
language sql stable security definer set search_path='' as $$
 select c.listing_id,c.slug,c.title,c.price_minor,c.currency,
  case when b.category is null then '{}'::text[] else array[b.category] end,'owner_approved',
  b.media->0->>'id'
 from public.current_catalog_release(p_store) c
 left join public.brain_listings b on (b.store_code,b.listing_id)=(p_store,c.listing_id)
 order by c.slug,c.listing_id limit least(greatest(coalesce(p_limit,50),1),100) offset least(greatest(coalesce(p_offset,0),0),10000)
$$;
revoke all on function public.public_catalog(text,integer,integer) from public;
grant execute on function public.public_catalog(text,integer,integer) to anon,authenticated;

-- Full approved page for one released brain listing; null for anything not currently visible.
create function public.public_product_page(p_store text,p_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('listing_id',c.listing_id,'market',p_store,'release','public_approved',
   'category',b.category,'page',b.page,'images',b.media)
 from public.current_catalog_release(p_store) c
 join public.brain_listings b on (b.store_code,b.listing_id)=(p_store,c.listing_id)
 where c.slug=p_slug limit 1
$$;
revoke all on function public.public_product_page(text,text) from public;
grant execute on function public.public_product_page(text,text) to anon,authenticated;

-- Owner: turn the approved picks of one brain run into published listings (or refresh them).
create function public.brain_publish_approved(p_store text, p_run uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  a public.brain_product_analysis%rowtype; t public.taager_catalog%rowtype; b public.brain_listings%rowtype;
  v_digits smallint; v_price bigint; v_cost bigint; v_reason text; v_media jsonb; v_page jsonb;
  v_slug text; v_title text; v_category text; v_product uuid; v_listing uuid; v_variant uuid;
  v_new integer := 0; v_updated integer := 0; v_skipped jsonb := '[]'::jsonb;
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  select minor_digits into v_digits from public.stores where code = p_store;
  perform 1 from public.brain_runs where id = p_run and store_code = p_store;
  if not found then raise exception 'unknown_run' using errcode = '22023'; end if;
  for a in select * from public.brain_product_analysis x
           where x.run_id = p_run and x.store_code = p_store and x.stage = 'selected' and x.owner_decision = 'approved'
           order by x.score desc nulls last, x.product_id, x.variation_id loop
    t := null;
    select * into t from public.taager_catalog c
     where c.market = p_store and c.product_id = a.product_id and coalesce(c.variant_id, 0) = a.variation_id
     order by c.synced_at desc limit 1;
    v_price := case when a.decision->>'state' = 'priced' and jsonb_typeof(a.decision->'price_minor') = 'number'
                    then (a.decision->>'price_minor')::numeric::bigint end;
    v_cost := public.taager_minor(t.financials->'originalPrice', v_digits);
    v_title := btrim(coalesce(a.content->>'title', ''));
    -- Pictures only, by Taager media id; the storefront serves them from its own /media/p/ path.
    select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'alt', left(coalesce(nullif(btrim(a.content->'image_alt'->>((m.n - 1)::int)), ''), v_title), 180)) order by m.n), '[]'::jsonb)
      into v_media
      from (select substring(u.url from '^https://media\.taager\.com/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|webp))$') as id, u.n
            from jsonb_array_elements_text(case when jsonb_typeof(t.detail->'variant'->'images') = 'array' then t.detail->'variant'->'images' else '[]'::jsonb end)
                 with ordinality u(url, n)) m
      where m.id is not null and m.n <= 12;
    v_reason := case
      when t.sku is null then 'not_in_taager_catalogue'
      when v_price is null or v_price <= 0 then 'no_price'
      when length(v_title) not between 1 and 500 or length(btrim(coalesce(a.content->>'description', ''))) not between 1 and 10000 then 'no_page_content'
      when coalesce(a.content->'issues', '[]'::jsonb) ?| array['banned_wording_present', 'price_in_text', 'missing_title', 'missing_description'] then 'page_content_needs_fix'
      when v_cost is null then 'no_supplier_cost'
      when v_price <= v_cost then 'below_supplier_cost'
      when jsonb_array_length(v_media) = 0 then 'no_pictures'
    end;
    if v_reason is not null then
      v_skipped := v_skipped || jsonb_build_object('product_id', a.product_id, 'variation_id', a.variation_id, 'title', a.title, 'reason', v_reason);
      continue;
    end if;
    v_category := case when a.content->>'category' in ('home','kitchen','beauty','fashion','wellness','organize') then a.content->>'category' end;
    v_page := jsonb_build_object(
      'title', v_title, 'subtitle', left(coalesce(a.content->>'subtitle', ''), 200), 'description', btrim(a.content->>'description'),
      'bullets', coalesce(a.content->'bullets', '[]'::jsonb), 'specs', coalesce(a.content->'specs', '[]'::jsonb), 'faq', coalesce(a.content->'faq', '[]'::jsonb),
      'tags', coalesce(a.content->'tags', '[]'::jsonb),
      'seo', jsonb_build_object('title', left(coalesce(a.content->'seo'->>'title', ''), 70), 'description', left(coalesce(a.content->'seo'->>'meta_description', ''), 170)));
    b := null;
    select * into b from public.brain_listings x where x.store_code = p_store and x.sku = t.sku for update;
    if b.listing_id is not null then
      update public.country_listings set title = v_title, status = 'published' where store_code = p_store and id = b.listing_id;
      update public.listing_variants set price_minor = v_price, stock_state = 'available', stock_checked_at = t.synced_at where store_code = p_store and id = b.variant_id;
      update public.brain_listings set run_id = p_run, price_minor = v_price, category = v_category, page = v_page, media = v_media,
        published_by = auth.uid(), updated_at = now() where store_code = p_store and listing_id = b.listing_id;
      v_updated := v_updated + 1;
    else
      -- Latin slug from the approved page plus the supplier product number keeps it unique and stable.
      v_slug := left(btrim(regexp_replace(lower(coalesce(a.content->'seo'->>'slug', '')), '[^a-z0-9]+', '-', 'g'), '-'), 80);
      v_slug := case when v_slug = '' then 'p' else v_slug end || '-' || a.product_id::text;
      if exists (select 1 from public.country_listings where store_code = p_store and slug = v_slug) then v_slug := v_slug || '-' || a.variation_id::text; end if;
      insert into public.catalog_products default values returning id into v_product;
      insert into public.country_listings(store_code, product_id, slug, title, status) values (p_store, v_product, v_slug, v_title, 'published') returning id into v_listing;
      insert into public.listing_variants(store_code, listing_id, sku, price_minor, stock_state, stock_checked_at)
        values (p_store, v_listing, t.sku, v_price, 'available', t.synced_at) returning id into v_variant;
      insert into public.brain_listings(store_code, listing_id, variant_id, sku, taager_product_id, taager_variant_id, run_id, price_minor, category, page, media, published_by)
        values (p_store, v_listing, v_variant, t.sku, a.product_id, a.variation_id, p_run, v_price, v_category, v_page, v_media, auth.uid());
      v_new := v_new + 1;
    end if;
  end loop;
  return jsonb_build_object('published', v_new, 'updated', v_updated, 'skipped', v_skipped);
end $$;

-- Owner: take brain listings off the store (all, or a list of listing ids). They can be published again later.
create function public.brain_unpublish(p_store text, p_listings uuid[] default null) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare n integer;
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.country_listings l set status = 'suspended'
   where l.store_code = p_store and l.status = 'published'
     and exists (select 1 from public.brain_listings b where (b.store_code, b.listing_id) = (l.store_code, l.id))
     and (p_listings is null or l.id = any(p_listings));
  get diagnostics n = row_count;
  return n;
end $$;

-- Owner: what is on the store right now, and why anything is hidden.
create function public.brain_publication_status(p_store text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select jsonb_build_object(
    'release_enabled', (select catalog_release_enabled from public.stores where code = p_store),
    'stock_max_age_hours', (select stock_max_age_hours from public.brain_settings where store_code = p_store),
    'last_sync_at', (select max(synced_at) from public.taager_catalog where market = p_store),
    'listings', count(*), 'ready', count(*) filter (where s.hidden_reason is null),
    'hidden', coalesce((select jsonb_object_agg(h.hidden_reason, h.n) from (select x.hidden_reason, count(*) n from public.brain_listing_state(p_store) x where x.hidden_reason is not null group by 1) h), '{}'::jsonb),
    'sample', coalesce((select jsonb_agg(jsonb_build_object('listing_id', y.listing_id, 'slug', y.slug, 'title', y.title, 'price_minor', y.price_minor, 'image', y.image, 'hidden_reason', y.hidden_reason))
                        from (select * from public.brain_listing_state(p_store) z order by z.hidden_reason nulls first, z.slug limit 60) y), '[]'::jsonb))
    from public.brain_listing_state(p_store) s);
end $$;

-- Owner: show or hide one market's catalogue to visitors. Every change is logged. Checkout is not affected.
create function public.brain_set_release(p_store text, p_enabled boolean) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_enabled is null then raise exception 'invalid' using errcode = '22023'; end if;
  update public.stores set catalog_release_enabled = p_enabled where code = p_store and catalog_release_enabled is distinct from p_enabled;
  if found then insert into public.catalog_release_log(store_code, enabled, changed_by) values (p_store, p_enabled, auth.uid()); end if;
  return p_enabled;
end $$;

revoke all on function public.brain_publish_approved(text, uuid), public.brain_unpublish(text, uuid[]),
  public.brain_publication_status(text), public.brain_set_release(text, boolean) from public, anon;
grant execute on function public.brain_publish_approved(text, uuid), public.brain_unpublish(text, uuid[]),
  public.brain_publication_status(text), public.brain_set_release(text, boolean) to authenticated;
notify pgrst, 'reload schema';
