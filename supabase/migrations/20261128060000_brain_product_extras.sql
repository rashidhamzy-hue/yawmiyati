-- Richer product pages for published brain listings (28 Nov 2026):
--   videos (supplier media host only, served from the storefront's /media/v/ path),
--   brain-built quantity offers ("2 for X"), re-checked against Taager's CURRENT unit cost on every read,
--   bundle contents from Taager's declared bundleItems only.
alter table public.brain_listings add column if not exists extras jsonb not null default '{}'::jsonb;

create or replace function public.brain_publish_approved(p_store text, p_run uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  a public.brain_product_analysis%rowtype; t public.taager_catalog%rowtype; b public.brain_listings%rowtype;
  v_digits smallint; v_price bigint; v_cost bigint; v_reason text; v_media jsonb; v_page jsonb; v_extras jsonb;
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
    -- Videos on the supplier's media host only (served from /media/v/); YouTube/Drive links are skipped.
    -- Quantity offers come from the brain's decision and must stay above the FULL unit cost for every piece.
    -- Bundle contents come only from Taager's declared bundleItems (never inferred from titles or pictures).
    v_extras := jsonb_build_object(
      'videos', coalesce((select jsonb_agg(z.id order by z.n) from (
          select y.id, min(y.n) as n from (
            select substring(u.url from '^https://media\.taager\.com/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp4)$') as id, u.n
            from jsonb_array_elements_text(
                   (case when jsonb_typeof(t.detail->'variant'->'videos') = 'array' then t.detail->'variant'->'videos' else '[]'::jsonb end)
                || (case when jsonb_typeof(t.detail->'variant'->'images') = 'array' then t.detail->'variant'->'images' else '[]'::jsonb end)) with ordinality u(url, n)) y
          where y.id is not null group by y.id order by min(y.n) limit 3) z), '[]'::jsonb),
      'quantity_offers', coalesce((select jsonb_agg(jsonb_build_object('quantity', (q->>'quantity')::int, 'price_minor', (q->>'price_minor')::bigint) order by (q->>'quantity')::int)
          from jsonb_array_elements(case when jsonb_typeof(a.decision->'quantity_offers') = 'array' then a.decision->'quantity_offers' else '[]'::jsonb end) q
          where jsonb_typeof(q->'quantity') = 'number' and jsonb_typeof(q->'price_minor') = 'number'
            and (q->>'quantity')::int between 2 and 5
            and (q->>'price_minor')::bigint > (q->>'quantity')::int * v_cost
            and (q->>'price_minor')::bigint < (q->>'quantity')::int * v_price), '[]'::jsonb),
      'bundle', coalesce((select jsonb_agg(jsonb_build_object('name', left(c.name, 160), 'quantity', (i->>'quantity')::int,
              'image', substring(i->>'thumbnail' from '^https://media\.taager\.com/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|webp))$')) order by i.n)
          from jsonb_array_elements(case when jsonb_typeof(t.detail->'variant'->'bundleItems') = 'array' then t.detail->'variant'->'bundleItems' else '[]'::jsonb end) with ordinality i(i, n)
          join lateral (select x.name from public.taager_catalog x where x.market = p_store and x.sku = i->>'sku' order by x.synced_at desc limit 1) c on true
          where jsonb_typeof(i->'quantity') = 'number' and (i->>'quantity')::int between 1 and 50 and length(btrim(coalesce(c.name, ''))) > 0), '[]'::jsonb));
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
      update public.brain_listings set run_id = p_run, price_minor = v_price, category = v_category, page = v_page, media = v_media, extras = v_extras,
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
      insert into public.brain_listings(store_code, listing_id, variant_id, sku, taager_product_id, taager_variant_id, run_id, price_minor, category, page, media, extras, published_by)
        values (p_store, v_listing, v_variant, t.sku, a.product_id, a.variation_id, p_run, v_price, v_category, v_page, v_media, v_extras, auth.uid());
      v_new := v_new + 1;
    end if;
  end loop;
  return jsonb_build_object('published', v_new, 'updated', v_updated, 'skipped', v_skipped);
end $$;

create or replace function public.public_product_page(p_store text,p_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('listing_id',c.listing_id,'market',p_store,'release','public_approved',
   'category',b.category,'page',b.page,'images',b.media,
   'videos',coalesce(b.extras->'videos','[]'::jsonb),
   'bundle',coalesce(b.extras->'bundle','[]'::jsonb),
   'quantity_offers',coalesce((select jsonb_agg(q order by (q->>'quantity')::int)
      from jsonb_array_elements(coalesce(b.extras->'quantity_offers','[]'::jsonb)) q
      where (q->>'price_minor')::bigint > (q->>'quantity')::int * coalesce(public.taager_minor(t.financials->'originalPrice', s.minor_digits), (q->>'price_minor')::bigint)),'[]'::jsonb))
 from public.current_catalog_release(p_store) c
 join public.brain_listings b on (b.store_code,b.listing_id)=(p_store,c.listing_id)
 join public.stores s on s.code=p_store
 left join public.taager_catalog t on (t.market,t.sku)=(b.store_code,b.sku)
 where c.slug=p_slug limit 1
$$;
revoke all on function public.public_product_page(text,text) from public;
grant execute on function public.public_product_page(text,text) to anon,authenticated;
revoke all on function public.brain_publish_approved(text, uuid) from public, anon;
grant execute on function public.brain_publish_approved(text, uuid) to authenticated;
notify pgrst, 'reload schema';
