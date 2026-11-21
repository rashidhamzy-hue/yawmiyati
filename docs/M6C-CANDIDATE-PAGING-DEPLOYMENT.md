# M6C — Owner candidate pagination (source-only deployment note)

**Status:** GitHub source and CI preparation. **NOT applied to Supabase** by this PR. Existing staging catalog remains empty/disabled; this migration never authorizes imports or customer orders.

## Why this is needed

The old `dashboard_candidate_review` RPC returns up to 100 candidates, while the owner's research/shortlist target is 100–150 products **per market** and the intake can be larger than 150. The separate `dashboard_catalog_readiness` RPC also returns up to 100 rows. Neither supports an offset, so the owner cannot review later candidates, their content, or their release blockers.

## Additive source changes

- `supabase/migrations/20261121090000_candidate_review_page.sql`: adds `dashboard_candidate_review_page(p_store,p_limit,p_offset)` and `dashboard_catalog_readiness_page(p_store,p_limit,p_offset)`, each with an authenticated market-membership check, bounded limit and offset, matching stable sort, explicit revoke of public/anon access and authenticated-only grant.
- Preserves the existing first-page RPCs so the current staging dashboard remains compatible **before** the migration.
- `dashboard-client.ts`: uses legacy functions for offset 0, new functions for subsequent pages. No new service-role key or browser secret.
- `CommercialReview.tsx`: loads 100 more records only when the last page was full, deduplicates records, maintains exact page offsets, fetches corresponding server readiness blockers, and clearly reports that staging migration may be required if paging fails.
- `CandidateDraft.tsx`: refreshes the commercial review and readiness data from the page where its selected candidate was returned.
- Source tests `src/test/m6c-owner-candidate-paging.test.ts`.

## Release/rollback procedure (for a future authorized staging session)

1. Confirm project ID **`skhtunkknshvolturqlm`** and account permissions. Never apply to Kabsi or another project.
2. Snapshot current migration and functions; inspect the new SQL with a database reviewer.
3. In a permitted staging deployment, apply only this versioned migration. Do not touch `stores` release flags, customer catalog, AI budget or supplier credentials.
4. Using authenticated **test owner membership only**, verify page offsets 0, 100, 200 and empty final page for the correct market, and denial for anonymous/non-member/other-market sessions. Test both candidate and readiness pages.
5. Browser-test actual `/admin` on mobile and desktop with the user JWT; verify commercial review, stale response safety, and revision approvals beyond the first 100. This has **not** been done in the offline source build.
6. If needed, roll back the additive functions with:
   `drop function if exists public.dashboard_candidate_review_page(text,integer,integer);`
   `drop function if exists public.dashboard_catalog_readiness_page(text,integer,integer);`
   **Important:** also roll back/disable the new frontend paging UI before relying on pages beyond 100.
7. Retain all five commercial launch flags OFF. A valid readiness response remains advisory, not publication authorization.

This task is not supplier integration, paid AI execution, product publication or production deployment.
