# Yawmiyati M5 — Source handoff and next operating gates

**Status date:** 21 November 2026. **Canonical repo:** `tarikhtube-stack/saudi-store-spark` (private). **Markets:** Saudi Arabia, UAE, Oman, Egypt, Iraq.

> **NON-LAUNCH BUILD.** The five storefronts are not approved for commercial release. This document describes source changes and CI, never production deployment or verified supplier inventory. The retired temporary Woo/Taager integration MUST NOT be revived.

## What M5 actually adds

| Phase | Source | Scope |
|---|---|---|
| M5A | `src/lib/store/offline-catalog-shortlist.ts` | Deterministic scoring and up-to-150 evidence-gated SKUs per market; never publishes |
| M5B | `src/lib/store/offline-editorial-package.ts` | Local title, description, SEO, FAQ, image-alt validation; requires cited facts and human review |
| M5C | `src/lib/store/offline-ai-orchestrator.ts` | Six-step offline task plan, prerequisite evaluation, budget preflight; no running AI |
| M5D | `src/lib/store/offline-release-readiness.ts` | Commercial, stock, rights, shipping, editorial and exact revision approval checks |
| M5E | `src/lib/store/offline-product-pipeline.ts` | Combined market/SKU/revision review report; execution, indexing and ordering remain blocked |
| M5F | `src/lib/store/offline-job-lifecycle.ts` | Replayable lease, timeout, retry, dead-letter, idempotency and simulated review reducer; no DB persistence |
| M5G | `src/lib/store/owner-action-queue.ts`, `src/components/store/OwnerActionQueue.tsx` | Read-only owner next-actions using existing scoped dashboard observations |
| M5H | `src/lib/store/offline-five-market-catalog-plan.ts` | 100-product minimum target / 150 maximum proposal per market; shortfalls shown rather than invented |
| M5I | `src/test/m5i-offline-cross-system-boundary.test.ts` | Merged via PR #111 after green Commerce CI and browser QA: offline product, job and independent synthetic checkout safety rehearsal |

M5A–M5I are merged into `main` after GitHub Commerce checks and storefront browser QA. Their CI success proves source/test behavior, not live operation. Existing legacy source contains additional demos, RPC clients, server adapters and storefront pages; do not overwrite them blindly.

## Actual operational state

- Supabase staging project `skhtunkknshvolturqlm` is the only Yawmiyati data project. Do not touch other projects.
- Five-country catalog, checkout and fulfillment release flags remain OFF. AI budgets are OFF/zero.
- No newly connected supplier, verified top-150 real catalog, active paid model operator, payment acceptance, actual dispatch, production release, or complete country shipping contract was established by M5.
- Current owner dashboard source is in `src/routes/admin.tsx`; browser CI's separate **offline owner preview** is not an authenticated Supabase owner end-to-end test.
- Existing Cloudflare owner Worker predates newer React source; source merges and Lovable sync are not evidence of deployment.
- There is no permission to activate AI costs, ads, real orders, supplier dispatch, indexing or live checkout.

## Engineering continuation (before production)

1. Preserve original responsive Lovable storefront and all five countries. Verify owner dashboard with a safe authorized staging account and a real desktop/mobile browser.
2. Build an authenticated, server-side, market-isolated provenance ingestion pipeline for the newly authorized five suppliers. Capture source IDs, terms, media permissions, variants, cost, stock timestamps and policy versions. **No provider calls until owner supplies current credentials and approves the staging connection.**
3. Connect market-specific source evidence to the M5 selection and pipeline modules. Distinguish zero evidence from zero products. Candidate review remains owner-approved, never automatic publication.
4. Add durable storage for the M5F job state machine through audited transactions with compare-and-swap / idempotency, scoped JWT authorization, audit trails, bounded retries and rollback tests. Treat offline event decisions as untrusted until validated by the server.
5. Review every country’s shipping, COD, taxes, returns, refusal/failed delivery fees, legal text, and local Arabic copy against current authorized evidence. Never display upstream supplier names or prior-supplier phrasing to shoppers.
6. Integrate approved durable product media, semantic categories, variant selectors, pricing review, stock freshness and customer-facing product detail UX; no fictional promotions or stock claims.
7. Prove synthetic (never real dispatch) purchase/return/reconciliation and failure cases for all five countries, including role isolation and finance precision.
8. Only after owner authorizes cost and provider access, connect server-only AI execution with measured spend, actual job reservation and cited-fact human approval. Paid assistant, personalization, marketing, SEO indexing and live fulfillment are separate release approvals.
9. Restore a safe staging deployment path without bypassing Cloudflare restrictions; verify exactly which revision is deployed. Audit security, observability, backups and incident rollback. Obtain explicit five-market release signoff.

## STOP / WAIT / RESUME

**Continue free source work** whenever repo changes and tests can be verified without service activation. **Wait** for green PR CI before merging and for owner-supplied supplier/legal/shipping facts before committing to country-specific commercial statements. **Stop before external side effects**: paid provider calls, staging/production credential changes, live deploys, checkout activation, public indexing, provider orders, or advertising must have explicit owner approval and separate smoke tests. **Resume integration** once required inputs, credentials and deployment authorization are available.

For historical setup details see `CLAUDE.md`, `AGENTS.md`, `docs/BLUEPRINT-ACCEPTANCE-STATUS.md` and `docs/handoff/M4H-CLAUDE-START-HERE.md`. Historical documents mention retired suppliers: the newest current override takes precedence.
