# Milestone 4C — owner dashboard clarity, source-only

**Date:** 21 November 2026. **Baseline:** M4B merged to `main` at `2588f8ea2bd74524178d4eb8d249018a02538a52`.

## Actual scope

Improves existing authenticated owner dashboard **source** at `src/routes/admin.tsx` and introduces pure, testable presentation rules at `src/lib/store/owner-dashboard-presentation.ts`. No integration, database, deployment, connected owner login, supplier API, real purchase, paid AI, marketing activation or credentials were changed. Existing server-side RPC and RLS boundaries were not modified.

## Source changes

- **Market scope:** selected SA/AE/OM/EG/IQ and local currency identified in a visible, responsive section. Selection resets prior displayed data while the market-specific owner RPCs load. Selector has a proper accessible name and 44px minimum target. Recommendations and commercial review remain market-scoped.
- **Financial presentation:** display recorded net and observed marketing spend using exact `BigInt`-based **minor-unit** formatting for 2-decimal SAR/AED/EGP and 3-decimal OMR/IQD. A recorded net is explicitly **not** profit, bank settlement, COD received or payout proof.
- **Evidence clarity:** new overview section distinguishes the number of returned catalog records from actual supplier stock, pending recommendation reviews from catalog publishing approvals, and observed automation policy from permission to turn on paid features.
- **Unknown vs zero:** missing summary/performance/catalog/recommendation/AI policy is unknown and highlighted. An actual response with 0 records is clearly displayed as 0 and not presented as a verified global count.
- **Warnings and launch state:** type-safe read-only alerts highlight missing data, pending review, inventory observations, enabled automation and backend report warnings. **Launch status is always `not_verified`**—never inferred from database summary counts or local UI review.
- **Session cleanup:** sign out clears the loaded performance result as well as summary/catalog/policy/recommendations; existing generation counter prevents late market responses overwriting a new selection.

## What we did NOT prove or change

The `/admin` page already uses owner Supabase sign-in and JWT-authorized RPCs in source. In M4C we did **not** log into a real owner account or run authenticated dashboard browser E2E against staging. Existing CI browser acceptance verifies storefronts and the separate synthetic localhost owner workspace, not genuine Supabase auth. This PR therefore does not claim full owner dashboard end-to-end verification, complete staff/role workflows, production data protection, or real commerce readiness.

The `CommercialReview` component and owner approval RPCs remain as implemented previously: saved shortlist/approval decisions are controlled by server-side policy; an advisory `ready` status is not automatic product publication. M4B's offline product proof evaluator was not connected to `/admin`; that requires audited server-side storage and trusted proof of media rights.

## Reproducible acceptance

```bash
bun install --frozen-lockfile
node scripts/check-simulation-boundary.mjs
node scripts/check-storefront-truth.mjs
node scripts/check-handoff-manifest.mjs
bun run build
bun run test
```

Expect new `src/test/m4c-owner-dashboard-presentation.test.ts` to cover all five currencies, missing data, large exact totals, cross-country/currency response mismatch, pending reviews, active automation and non-launch status. CI browser QA remains required. Future separate authenticated owner E2E needs explicit environment access plus a secure test account and no-live-change approval.

## M4C follow-ups, not hidden claims

- Source UX and tests for candidate review error/empty/loading, pagination and unsaved form guards.
- Server-enforced role matrix, inventory/price evidence receipts, and approval log.
- Real mobile authenticated owner test and screen reader/contrast audit.
- Owner-approved runtime release controls and monitoring after supplier/infrastructure authorization.

Next proposed free milestone: **M4D — security, integration-boundary and source-only operational hardening**. All five country launch gates remain blocked.
