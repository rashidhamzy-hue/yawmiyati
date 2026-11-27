-- Owner-only import of an owner-run Taager sync file into taager_catalog.
-- The browser parses the file and sends rows in chunks; every call re-checks dashboard membership.
-- Quick (listing-only) syncs never erase a stored detail or alternatives snapshot.

alter table public.taager_sync_batches
  add column if not exists is_full boolean not null default false,
  add column if not exists imported_by uuid,
  add column if not exists rows_received integer not null default 0,
  add column if not exists completed_at timestamptz;

alter table public.taager_catalog
  add column if not exists detail_synced_at timestamptz,
  add column if not exists financials jsonb,
  add column if not exists previous_financials jsonb,
  add column if not exists price_changed_at timestamptz,
  add column if not exists seen_in_full_batch uuid references public.taager_sync_batches(id) on delete set null;

create index if not exists taager_catalog_batch_idx on public.taager_catalog (market, batch_id);

-- Begin: one batch row per uploaded file.
create or replace function public.taager_import_begin(p_store text, p_meta jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_country text := case p_store when 'sa' then 'SAU' when 'ae' then 'ARE' when 'om' then 'OMN' when 'eg' then 'EGY' when 'iq' then 'IRQ' end;
  v_id uuid;
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_country is null then raise exception 'invalid_market' using errcode = '22023'; end if;
  if coalesce(p_meta->>'country', '') <> v_country then raise exception 'file_is_for_another_country' using errcode = '22023'; end if;
  insert into public.taager_sync_batches (market, country, source, source_version, started_at, finished_at,
    listing_count, detail_count, errors, is_full, imported_by)
  values (p_store, v_country, coalesce(p_meta->>'source', 'taager-merchant-sync'), nullif(p_meta->>'version', '')::int,
    nullif(p_meta->>'started_at', '')::timestamptz, nullif(p_meta->>'finished_at', '')::timestamptz,
    coalesce((p_meta->>'listing_count')::int, 0), coalesce((p_meta->>'detail_count')::int, 0),
    coalesce(p_meta->'errors', '[]'::jsonb), coalesce((p_meta->>'is_full')::boolean, false), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Rows: at most 100 per call. Each row: {sku, product_id, variant_id, item_type, name, listing, detail?, alternatives?}.
create or replace function public.taager_import_rows(p_store text, p_batch uuid, p_rows jsonb) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_country text;
  v_full boolean;
  v_bad integer;
  v_n integer;
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  select country, is_full into v_country, v_full from public.taager_sync_batches
   where id = p_batch and market = p_store and completed_at is null;
  if v_country is null then raise exception 'unknown_or_closed_batch' using errcode = '22023'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 100 then
    raise exception 'rows_must_be_1_to_100' using errcode = '22023';
  end if;
  select count(*) into v_bad from jsonb_array_elements(p_rows) r
   where coalesce(r->>'sku', '') !~ '^[A-Za-z0-9_-]{4,64}$'
      or coalesce(r->>'product_id', '') !~ '^[0-9]{1,12}$'
      or jsonb_typeof(r->'listing') is distinct from 'object'
      or (r->'detail' is not null and jsonb_typeof(r->'detail') = 'object' and coalesce(r->'detail'->>'country', v_country) <> v_country);
  if v_bad > 0 then raise exception 'invalid_rows: %', v_bad using errcode = '22023'; end if;

  insert into public.taager_catalog as c (market, sku, product_id, variant_id, item_type, name, listing, detail, alternatives,
    batch_id, synced_at, detail_synced_at, financials, seen_in_full_batch)
  select p_store, r->>'sku', (r->>'product_id')::bigint, nullif(r->>'variant_id', '')::bigint, left(r->>'item_type', 40), left(r->>'name', 500),
    r->'listing', nullif(r->'detail', 'null'::jsonb), nullif(r->'alternatives', 'null'::jsonb),
    p_batch, now(), case when jsonb_typeof(r->'detail') = 'object' then now() end,
    r->'listing'->'financials',
    case when v_full then p_batch end
  from jsonb_array_elements(p_rows) r
  on conflict (market, sku) do update set
    product_id = excluded.product_id,
    variant_id = coalesce(excluded.variant_id, c.variant_id),
    item_type = coalesce(excluded.item_type, c.item_type),
    name = coalesce(excluded.name, c.name),
    listing = excluded.listing,
    detail = coalesce(excluded.detail, c.detail),
    alternatives = coalesce(excluded.alternatives, c.alternatives),
    batch_id = excluded.batch_id,
    synced_at = now(),
    detail_synced_at = coalesce(excluded.detail_synced_at, c.detail_synced_at),
    -- Change detection compares listing financials (present in quick and full syncs alike).
    previous_financials = case when c.financials is distinct from excluded.financials then c.financials else c.previous_financials end,
    price_changed_at = case when c.financials is not null and c.financials is distinct from excluded.financials then now() else c.price_changed_at end,
    financials = excluded.financials,
    seen_in_full_batch = coalesce(excluded.seen_in_full_batch, c.seen_in_full_batch);
  get diagnostics v_n = row_count;
  update public.taager_sync_batches set rows_received = rows_received + v_n where id = p_batch;
  return v_n;
end $$;

create or replace function public.taager_import_finish(p_store text, p_batch uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_rows integer;
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.taager_sync_batches set completed_at = clock_timestamp(), imported_at = clock_timestamp()
   where id = p_batch and market = p_store and completed_at is null returning rows_received into v_rows;
  if v_rows is null then raise exception 'unknown_or_closed_batch' using errcode = '22023'; end if;
  return public.taager_catalog_summary(p_store);
end $$;

-- Owner summary: what the brain can see for this market.
create or replace function public.taager_catalog_summary(p_store text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_full uuid;
begin
  if not public.brain_is_member(p_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  select id into v_full from public.taager_sync_batches
   where market = p_store and is_full and completed_at is not null order by completed_at desc limit 1;
  return jsonb_build_object(
    'skus', (select count(*) from public.taager_catalog where market = p_store),
    'with_detail', (select count(*) from public.taager_catalog where market = p_store and detail is not null),
    'bundles', (select count(*) from public.taager_catalog where market = p_store and item_type = 'bundle'),
    'price_changed_7d', (select count(*) from public.taager_catalog where market = p_store and price_changed_at > now() - interval '7 days'),
    'missing_from_last_full_sync', case when v_full is null then null else
      (select count(*) from public.taager_catalog where market = p_store and seen_in_full_batch is distinct from v_full) end,
    'last_sync', (select jsonb_build_object('id', id, 'completed_at', completed_at, 'is_full', is_full, 'rows', rows_received,
        'listing_count', listing_count, 'detail_count', detail_count, 'errors', jsonb_array_length(errors))
      from public.taager_sync_batches where market = p_store and completed_at is not null order by completed_at desc limit 1)
  );
end $$;

revoke all on function public.taager_import_begin(text, jsonb), public.taager_import_rows(text, uuid, jsonb),
  public.taager_import_finish(text, uuid), public.taager_catalog_summary(text) from public, anon;
grant execute on function public.taager_import_begin(text, jsonb), public.taager_import_rows(text, uuid, jsonb),
  public.taager_import_finish(text, uuid), public.taager_catalog_summary(text) to authenticated;
