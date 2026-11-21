# Yawmiyati — M6 Owner Workflow Handoff

**Date:** 21 November 2026. **Canonical source:** `tarikhtube-stack/saudi-store-spark`. **Markets:** SA, AE, OM, EG, IQ. **Project:** Yawmiyati only.

> **STOP/WAIT CONTRACT:** This is source/CI development, **NOT** a deployed production system. Keep supplier connections, paid AI, advertising, real orders, catalog publishing and public indexing OFF. Never use or reactivate the retired temporary supplier. Do not touch other projects.

## Development completed after M5

| Milestone | PR | Source impact | Operational status |
|---|---|---|---|
| M6A | #113 | The existing authenticated `/admin` catalog viewer can load further 50-item pages via the existing `dashboard_catalog` RPC; it validates rows, de-duplicates results and rejects stale responses after country changes or sign-out | Merged, CI-passed, **not verified in hosted authenticated owner browser** |
| M6B | #114 | Candidate review supplier-observed prices now preserve exact currency minor units using `BigInt`, including 3-decimal OMR/IQD | Merged, CI-passed, **source change** |
| M6C | #115 | Candidate and readiness RPC pagination source, `CommercialReview` load-more UI, page-aware `CandidateDraft` review, tests and rollback plan | Merged into `main` as PR #115 after green Commerce CI and browser QA. SQL migration is **NOT APPLIED** to staging |

M5A–M5I are merged, and the M5 continuation baseline remains `docs/handoff/M5-CONTINUATION.md`.

## M6C database operation is still required

Migration `supabase/migrations/20261121090000_candidate_review_page.sql` adds **two** authenticated, market-member-only functions:

- `dashboard_candidate_review_page(p_store,p_limit,p_offset)`
- `dashboard_catalog_readiness_page(p_store,p_limit,p_offset)`

Both preserve the existing old RPCs for offset 0. Until migration is safely applied to **existing Yawmiyati staging project `skhtunkknshvolturqlm`**, the first 100 candidates still load normally, but additional pages cannot be loaded. The app reports that the migration may be missing. **Do not claim the pagination backend is live.**

Follow `docs/M6C-CANDIDATE-PAGING-DEPLOYMENT.md`. Apply the SQL only in an explicitly authorized staging deployment; test auth failures, market isolation, correct offset 100/200 behavior and read-only release readiness; back up/roll back safely. Do not change catalog/checkout/fulfillment release flags.

## Outstanding operational work for Claude

1. Audit `src/routes/admin.tsx`, `CommercialReview.tsx`, `CandidateDraft.tsx`, `dashboard-client.ts`, and the new M6C migration. Test the **real** owner JWT browser session after an approved staging deployment; existing CI browser QA tests synthetic local owner screens, not authenticated Supabase end-to-end.
2. Verify existing production-related infrastructure is wired to the correct staging project without bypassing Cloudflare restrictions. Record exact deployed source revisions separately from green GitHub tests.
3. Connect new authorized supplier endpoints per country with authenticated provenance, verified costs, images/media rights, variant maps, stock TTL and commercial shipping/COD terms. Real candidate count is currently zero in the last verified staging snapshot.
4. Integrate M5 AI planning and job lifecycle with durable transactions and server-side authorization. Existing offline jobs and simulated approval flags **do not** run AI or prove authenticated owner approval.
5. Connect approved product title/description/SEO image fields to real verified facts; do not invent claims, mention suppliers to customers, or publish without owner review.
6. Finish country-specific actual shipping/COD/return policies, cart/checkout, courier dispatch, reconciliation, fraud controls and idempotent *synthetic* E2E tests. Keep real checkout disabled until explicit release authorization.
7. Complete five-market dashboard UX, pagination, analytics, legal/security review, mobile QA, consent and final five-country launch acceptance.

## Manual stop/wait/resume decision

- **Proceed:** Free local source, unit and browser CI improvements, branch/PR reviews and merges after green tests.
- **Wait:** Owner-approved staging migration, authenticated owner test access, current country-specific supplier/shipping/legal evidence, and authorized deployment path.
- **Stop:** Production activation, real imports/orders, model spending, ads, supplier dispatch, public indexing, service-role/secret exposure or migrations to any unrelated project. Obtain explicit permission and fresh E2E verification first.

The M6 changes are not independent proof of production readiness. Document source commit, CI result, migration state and actual deployed URL separately for each milestone.
