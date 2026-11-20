-- Retire the disposable TasteWP Saudi import bridge at the owner's request.
-- Preserve generic supplier, catalog, order, approval and market tables for new hosted stores.
drop function if exists public.stage_sa_supplier_candidates(jsonb);
drop function if exists public.dashboard_import_candidates(text,integer);
-- Legacy SA imports have been cleared separately after verifying zero linked drafts.
-- The old Edge Function is independently replaced with an authenticated HTTP 410 tombstone.
notify pgrst,'reload schema';
