# Yawmiyati — engineering handoff to Claude (source snapshot)

**Prepared:** 2026-11-20  
**Repository:** `tarikhtube-stack/saudi-store-spark` (private).  
**Verified baseline:** `main` commit `1a50db53ee78cbb2549cb9e53b9ac44209b053ab` after Milestone 3B PR #91 merged.  
**Handoff package:** this document, `docs/handoff/ENGINEERING-MANIFEST.json`, `docs/handoff/CLAUDE-START-HERE.md`, `docs/handoff/OPERATIONS-RUNBOOKS.md`, `docs/BLUEPRINT-ACCEPTANCE-STATUS.md` and milestone docs M1–M3B.

> This snapshot is **GitHub source evidence only**. It is NOT a new live audit of Supabase, Cloudflare, Taager, the public website, domains, customer data, or commerce providers. CI passing does not imply deployed, activated, financially viable or production ready.

## 1. Immutable project decisions

- Brand: **Yawmiyati**, Arabic-first, RTL e-commerce for **Saudi Arabia, UAE, Oman, Egypt and Iraq** from day one; keep country isolation and individual currencies.
- Markets: `sa` SAR (2 minor digits), `ae` AED (2), `om` OMR (3), `eg` EGP (2), `iq` IQD (3). Use `src/lib/store/markets.ts`; never use floats for order ledger calculations.
- COD-first, but **live checkout is OFF**. Do not show a “buy now” path until approved supplier/cost/shipping/returns/customer rights and real order handling exist.
- No Taager/Woo/other supplier connection, no credentials, no database mutation, no production deployments/DNS/transfers, no paid AI and no ad spend during the remaining free-building phase without explicit, separate owner authorization.
- No fictional product or mock shipping amount may appear as a customer-orderable product. In particular **Egypt’s 60 EGP shipping value is a deliberately invented simulation fixture** and is NEVER a published policy.
- Supplier names and internal payout/cost mechanics are operational-only. Customer-facing copy must distinguish evidence from binding seller obligations.
- Repository and project ownership/transfer remain separate decisions. Do not migrate other projects or shared organizational data.

## 2. Verification tiers

| Tier | What is grounded | What is NOT proved |
|---|---|---|
| GitHub source | Current checked-in modules and docs, including approved-only public RPC clients and strict simulation isolation | That the running website exactly matches source |
| GitHub CI | Previous M3B head passed 203 automated tests / 52 files and storefront/browser QA; current M3C runs must be rechecked | Real provider integration, RLS posture, production uptime |
| Local owner review | Separate password-gated `127.0.0.1` preview; fake catalog, fake COD receipts, 40 blocked gates, 30 browser-safe faults | Real owner Supabase authentication, release approval |
| Staging DB (historical docs only) | Blueprint audit recorded staging owner RPCs and zero supplier candidates, listings, orders and paid AI jobs on 2026-11-20 | Current table counts or environment flags without a fresh read |
| Commercial launch | **Not verified or authorized** | Stock, returns, checkout, courier settlement, source approvals, five-market live readiness |

The `docs/handoff/ENGINEERING-MANIFEST.json` machine-readable manifest lists verified paths, fixed launch-off assertions, blockers and allowed check commands. It does not read or update external systems.

## 3. Source map (do not assume deployed)

| Capability | Source paths | Actual maturity |
|---|---|---|
| Country money/currency | `src/lib/store/markets.ts` | Pure logic; 5-market tests |
| Approved public catalog | `src/lib/store/public-catalog.ts` | Public approved RPC client, limited title/price/description contract |
| Approved-only filter/gallery | `src/lib/store/approved-product-experience.ts`, `src/lib/store/ApprovedProductExperience.tsx` | Reusable UI only; media/variant provenance not authenticated; not all live routes wired |
| Supplier contracts | `src/lib/store/supplier-contracts.ts` | Zod types and rejected synthetic identity; **no real provider transport** |
| Evidence and COD economics | `src/lib/store/supplier-evidence.ts`, `src/lib/store/pricing.ts` | Advisory fail-closed helpers; no live costs or settlement |
| Order state / reconciliation | `src/lib/store/fulfillment-state.ts`, `src/lib/store/reconciliation.ts` | State and discrepancy helpers; no durable production reconciler |
| Owner dashboard | `src/routes/admin.tsx`, `src/lib/store/dashboard-client.ts` | Source-backed owner sign-in and RPC clients; authenticated real browser flow NOT newly verified |
| Local synthetic catalog | `src/lib/store/simulation/fixtures.ts`, `product-experience.ts` | 150 artificial products, not sellable |
| Local COD cart/address | `src/lib/store/simulation/offline-commerce.ts`, `checkout-session.ts`, `addresses.ts` | No-network in-memory simulator |
| In-memory queue and synthetic HMAC | `src/lib/store/simulation/outbox.ts`, `signed-webhook.ts` | Not a durable queue or live supplier webhook processor |
| Readiness and failure matrices | `src/lib/store/simulation/offline-launch-readiness.ts`, `failure-rehearsal.ts` | All 40 gates blocked; 30 browser-safe faults + 5 Node-only signed events |
| Local owner sandbox | `scripts/m2d-local-preview.mjs`, `src/test/m2d-owner-review-workspace.tsx` | Loopback and ephemeral Basic transport gate, **not real owner identity** |
| CI isolation | `scripts/check-simulation-boundary.mjs` | Static import guard, not complete security review |
| Legacy fictional catalog | `src/lib/store/catalog.ts` | Contains hardcoded product/shipping presentation defaults; **do not use as live catalog truth** |

## 4. Precise gaps and priorities

**P0 — Complete without connections (one small PR at a time)**

1. Audit remaining public routes for references to legacy `catalog.ts` selling/shipping numbers, hardcoded discounts, testimonials and other evidence-free claims. Keep editorial category imagery separate from sellable catalog facts.
2. Audit programmatic SEO architecture: category/market URL templates, unique localized descriptions, canonicals, hreflang, sitemap/robots indexability, duplicate/thin pages and structured-data claims; **generate templates and tests only** until real inventory and live domains exist. Do not publish thousands of thin/no-product URLs.
3. Draft release-safe data contracts for approved media ownership, category assignment, variant SKU matrix, stock TTL and source revisions. Write migration proposals/test fixtures but do not apply database changes.
4. Review owner dashboard source UX: empty states, five-market queue views, role gaps, tab labels, mobile accessibility and reporting fidelity. Do not claim authenticated browser tests without running them.
5. Expand contract-level security checks, input boundary tests, dependency audit (no paid service), and runbooks for returns, refusals, missing provider data, operator escalation and rollback.
6. Implement offline-only consent/privacy/help copy reviews; mark all legal wording `pending_local_counsel_review` rather than customer-ready.

**P1 — Needs approved evidence before implementation or claims**

- Real product sourcing, media rights, wholesale cost, available stock, provider credentials, support agreements and allowed integration mechanism **per country**.
- Full catalog RPC with verified media, variants, category membership and stock freshness; owner sign-off and row-level permissions.
- Actual governorate/zone shipping matrices, COD handling, returns/refunds and taxation, especially **Egypt shipping unknown**.
- Stable per-market checkout, durable idempotency and outbox, supplier acknowledgement, order status verification, courier, refund and COD reconciliation.
- Consent-aware analytics, research, AI content policy, anti-abuse budgets and human review.
- Domains, hosting, environment separation, rate limits, backups, secrets, recovery, and account transfer.

**P2 — Only after commercial gates are satisfied**

- Real publish/checkout/dispatch/payment flags; external integrations; marketing automations; customer-facing paid AI; real ad budgets; production deployments.

## 5. Per-market evidence register (NOT approved policy)

| Market | Currency | Supplier guidance in policy ledger | Blocking evidence |
|---|---|---|---|
| SA | SAR | Quoted shipping 28 SAR; indicative delivery and returns | Confirm supplier contract, source stock, wholesale costs, actual courier zones, conflicting confirmation cutoffs, tax/legal terms |
| AE | AED | Quoted 19 AED and 24–48h delivery guidance | Fresh provider proof, merchant COD/refund agreement, serviceability, actual legal terms |
| OM | OMR | Quoted 3 OMR; restricted defect/description returns | Return rights counsel, delivery ETA, unclear payouts, real provider and media evidence |
| EG | EGP | Delivery zones described, **shipping table broken/unknown** | Authentic governorate rate matrix, supplier SLA contradictions, returns/tax/legal reviews |
| IQ | IQD | Quoted 7,000 IQD; contradictory return windows | Written return clarification, real ETA, payout/courier evidence, local legal review |

These are **historical supplier quotations and screenshots supplied by the owner**, not live confirmed prices or seller promises; full detail is in `docs/SUPPLIER-POLICIES-2026-11-20.md`. None should be activated or advertised without source revalidation and approval.

## 6. Handoff acceptance

From the cloned repo and fresh `main`, run:

```bash
bun install --frozen-lockfile
node scripts/check-simulation-boundary.mjs
node scripts/check-handoff-manifest.mjs
bun run build
bun run test
```

Review the two GitHub workflows: `.github/workflows/commerce-checks.yml` and `.github/workflows/storefront-browser-qa.yml`. Browser QA includes real Chromium for existing public routes and a *local isolated* synthetic owner experience; it does not authenticate as a real Supabase account.

Follow `docs/handoff/OPERATIONS-RUNBOOKS.md` for failures and `docs/handoff/CLAUDE-START-HERE.md` for the next safe work queue. Do not substitute this handoff for fresh database/hosting/provider checks once user authorizes such work.
