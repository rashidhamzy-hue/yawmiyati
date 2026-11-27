-- The brain can now read the owner-imported Taager merchant catalogue (taager_catalog) directly.
-- Offers from that source are stored with provider 'taager_api' next to any WooCommerce-sourced rows.
alter table public.supplier_offers drop constraint if exists supplier_offers_provider_check;
alter table public.supplier_offers add constraint supplier_offers_provider_check check (provider in ('taager_woo', 'taager_api'));
grant select on public.taager_catalog, public.taager_sync_batches to service_role;
