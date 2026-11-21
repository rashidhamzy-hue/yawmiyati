> **21 November 2026 M4I update — Egypt destination rates captured.** The former 'no governorate shipping fee table' statement below was true at the M4H snapshot but is now superseded **for exactly the 30 screenshot-listed destinations**. Use `src/lib/store/egypt-shipping-evidence.ts` for EGP 95/100/105 bands and strict lookup. Unknown destinations remain unknown. A screenshot also indicates a separate internal EGP 5 deduction on refused COD deliveries; **never present it as a customer fee**. The rates are not authenticated current checkout prices, so customer totals and orders remain disabled. See `docs/M4I-EGYPT-SHIPPING-SCREENSHOT.md`. **Do not change other countries** until their terms are reconfirmed.

# Yawmiyati — M4H Claude Code engineering handoff

**Prepared:** 21 November 2026. **Canonical repository:** `tarikhtube-stack/saudi-store-spark`. **Parent milestone:** M4G, merged to `main` as `a0938b75676046593dbcdc2badf6bfd578b9d010`. M4H changes live in their own PR until GitHub CI is green and merged.

## Read before modifying anything

1. `AGENTS.md` — Lovable source protections, independent Supabase exception, no changes to unrelated projects.
2. **This file** — current implementation and explicitly unresolved tasks.
3. `docs/M4G-FIVE-MARKET-QA-AUDIT.md` and `docs/BLUEPRINT-ACCEPTANCE-STATUS.md` — latest repo-based acceptance comparisons (the latter contains a dated staging snapshot).
4. `docs/SUPPLIER-POLICIES-2026-11-20.md` — **internal-only** market data. Never mention Taager, upstream supplier, previous provider, payout mechanics or sourcing history anywhere in customer-facing text.
5. `docs/M4A-STOREFRONT-TRUTH-SEO.md` through `docs/M4F-OFFLINE-AI-READINESS.md`, `docs/M4D-SECURITY-POLICY-EVIDENCE.md`, `docs/M4E-PROGRAMMATIC-SEO-OFFLINE.md`.
6. `docs/BUILD-TO-LAUNCH-EXECUTION.md` — owner approval gates, release order and external dependencies.
7. The original master blueprint the owner supplied, if accessible to Claude; **do not claim to have verified unprovided blueprint content**. The repo acceptance documents are a derivative map, not the primary PDF.

**Historical warning:** `CLAUDE.md`, `docs/HANDOFF-STATUS.md` and `docs/INTEGRATION-CONTRACT.md` contain contradictory pre-retirement references to 9 supplier products and a 'working' temporary Woo integration. Those are historical and **not an active supplier connection**. M4H does not turn the older snapshot into verified current production status. Current working rules supersede those claims. Preserve historical source for audit; do not reconstruct retired connections.

## What is real now

| Layer | Actual state | Critical next dependency |
|---|---|---|
| GitHub | M1–M4G source milestones merged with green Commerce CI and synthetic browser QA; M4H PR pending | Claude access/ownership coordination, safe branches/PRs |
| Storefront | Five responsive Arabic-first previews; market-specific visuals, navigation, shipping guidance and no-order guard | Live domains, real approved product content, owner visual/legal signoff |
| Currency isolation | SA SAR 2; AE AED 2; OM OMR 3; EG EGP 2; IQ IQD 3 | Server-side money and tax/collection correctness with real commercial data |
| Product acquisition | Generic Woo read-only parser, import contracts, evidence validation and owner candidates/draft workflow code | **Verified Taager-specific access and provider capability matrix per market**; not configured |
| Product media/variants | M4B offline checks for identity, media rights, SKU collisions, category and stock freshness | Real approved media hosting, variant mapping, provider stock source and pricing |
| Owner | Authenticated-client RPC code, commercial review, dashboard summary/monitoring | Actual current deployed owner login and real role/security/E2E checks |
| Catalog | Public approved-only catalog/detail/search code, local mock simulations | Real currently approved and published products; no assumed catalog |
| AI | Existing server Anthropic adapter/job lifecycle and M4F offline AI review contracts | Provider execution and verified cost budgets **explicitly unauthorized** |
| SEO | M4A + M4E source-only metadata, categories, alternate/relative links | Actual verified domains, releases and schema; all indexing OFF |
| Customer assistant | Local grounded read-only experience; paid model use OFF | Auth/abuse/data source, owner pricing and privacy approval |
| Checkout/orders | Offline COD cart, order idempotency, signed event simulations, replay/failure tests | Actual server checkout, authorized supplier submission, shipping/COD reconciliation |
| Observability | Source architecture, mock/observation reporting | Real privacy-reviewed live dashboards, fraud and operational alerts |
| Legal/hosting | Market-specific policy drafts and historical shipping figures; no domains activated | Real seller identity, live verified terms, legal review, hosting and account transfers |

**No statement here constitutes a current database query or deployed-runtime acceptance.** No real products/orders, provider endpoints, active budgets or finished autonomous agent pipeline were verified by M4G.

## Customer-facing shipping and delivery — corrected in M4H

**No provider references in the customer storefront**, including 'المورّد السابق', 'بحسب عرض المورّد', 'شروط المورد', 'Taager', or supplier identities. Website text should speak directly as Yawmiyati.

| Market | Show on home and shipping/returns page as clearly *estimated* | Missing operational evidence |
|---|---|---|
| SA | Approximate SAR 28, Riyadh/Jeddah/Dammam 2–3 days, other areas 4–5 days after confirmation | Recheck current charge, zone coverage, start point and rights policy |
| AE | Approximate AED 19 nationwide; 24–48 hours estimated after confirmation/preparation | Recheck exact cutoffs, coverage, weekends and legal returns |
| OM | Approximate OMR 3 nationwide | **No verified delivery ETA**. Do not invent |
| EG | Governorate-dependent shipping price. Cairo/Giza/Alexandria 2 working days; Lower Egypt/Qalyubia 3; Upper Egypt/Sinai/Matrouh/Red Sea 2–5 | **No governorate shipping fee table**; don't invent fees |
| IQ | Approximate IQD 7,000 nationwide | **No verified delivery ETA**; supplier return rules conflict and must not become customer guarantees |

All these are historical internal planning evidence, **not authenticated live checkout charges**. The site may show indicative numbers with explicit 'تقديري/إرشادي' qualifiers and state final charges confirmed before actual orders. Checkout and paid services remain disabled. Legal return period and refund rights require owner- and jurisdiction-specific approval; unknown/contradictory numbers must not be presented as Yawmiyati policy.

Source of internal evidence: `src/lib/store/historic-supplier-terms.ts` and `docs/SUPPLIER-POLICIES-2026-11-20.md`. Customer copy: `src/lib/store/saudi-commerce-content.ts`, `src/lib/store/market-policy-pages.ts`, `src/components/store/MarketPromiseStrip.tsx`, `src/components/store/MarketPreview.tsx`. CI now prevents obvious upstream/provider disclosure in active storefront string literals, with user-visible component regression tests.

## Verified code milestone ledger

| Milestone | Source module / proof | Not proof of |
|---|---|---|
| M1 | `src/lib/store/simulation`; five-store synthetic workflows | Provider sync or real orders |
| M2A/B/C/D | Product design, approved preview contracts, offline cart and local owner preview | Actual catalog, payment, authenticated staging admin |
| M3A/B/C | Offline release gates, fault rehearsal, handoff integrity | Launch authorization |
| M4A | `src/lib/store/seo-planning.ts` | Google indexing or public sitemap |
| M4B | `src/lib/store/offline-product-proof.ts` | Real product/media rights or stock proof |
| M4C | `src/lib/store/owner-dashboard-presentation.ts` | Authenticated production owner UX |
| M4D | Owner RPC transport checks, shipping evidence ledger | Penetration test/real shipping quotes |
| M4E | `src/lib/store/offline-seo-release.ts` | Indexable canonical, hreflang or schema |
| M4F | `src/lib/store/offline-ai-workflows.ts` | Autonomous product research, translation or paid model |
| M4G | `scripts/test-storefront-truth-guard.mjs`, `scripts/check-m4g-release-boundary.mjs` | Production/real provider assurance |
| M4H | Current handoff, shopper-policy correction, automated upstream-copy guard | Completed integration or launch |

## Claude continuation plan — in dependency order

**Lane 0 — no-cost repository acceptance:** Merge M4H PR only on green Commerce/browser CI. Inspect new source, current migrations and all routes; preserve `noindex`, no-spend, empty catalog and checkout disabled. Run all checks below. Fix code/test regressions without adding integrations, and update an actionable evidence list. Confirm the original blueprint file/requirements have actually been reviewed before claiming full coverage.

**Lane 1 — Taager provider-capability discovery (only when owner allows integration):** For each country independently obtain authentic provider/product feeds, identity/variants, rights/photography, stock freshness and cost, taxes, carrier/COD fees, delivery zones, confirmation status, return/refusal/settlement and order-create capabilities. Do **not** assume Taager is WooCommerce, or that every market has the same APIs. Require safe mock contracts and a read-only probe before persistent imports. Egypt shipping price table and Iraq return discrepancies are explicit blockers.

**Lane 2 — real candidate staging:** Server-side verified provider adapter → normalized candidate → source/evidence snapshot → duplicate/variant mapping → owner review. Never publish or order based on raw import or stale supplier stock.

**Lane 3 — AI localized editorial:** Source-entailment checks → market-specific Arabic (SA/AE/OM/EG/IQ) title, description, SEO, FAQ and content revisions → owner approval → only eligible listing release. No fabricated specs, price, health claim, reviews, savings, scarcity or shipping SLA. Social/ad drafts stay separate from money-spending authorization. Activation requires separate owner budget approval and server enforcement.

**Lane 4 — authorized product catalog / SEO:** Real media license/alt metadata, category relations, variant stock/price; verified public per-market product/card. Only after domain, legal, approval and catalog verification may server generate sitemap/canonical/hreflang/product schema and flip prelaunch indexing.

**Lane 5 — transaction and operating system:** Isolated per-market cart, server-authoritative price/stock and shipping recheck, customer consent/address, idempotent COD checkout, supplier acceptance proof, courier states, return/refusal handling, settlement reconciliation, anomaly alerts and dashboard queues; test through mocks/sandbox first. No real dispatch without written owner authorization.

**Lane 6 — production release:** Domain/DNS/SSL/redirects, security RLS/RBAC/auth, secrets, abuse, data protection, backup restore, real accessibility/performance testing, legal seller policy, verified payment channels, monitoring/rollbacks, and ownership transfer coordination. Launch all five markets together unless owner changes the decision.

## Validation (zero supplier calls)

```bash
bun install --frozen-lockfile
node scripts/check-simulation-boundary.mjs
node scripts/check-storefront-truth.mjs
node scripts/test-storefront-truth-guard.mjs
node scripts/check-m4g-release-boundary.mjs
node scripts/check-handoff-manifest.mjs
node scripts/check-m4h-handoff.mjs
bun run build
bun run test
```

GitHub responsive browser QA runs five storefronts at four viewport widths and five isolated local owner previews at four widths. These **are not deployed staging sign-in, supplier, payment or customer E2E**.

## Owner constraints — binding

- **No integration today, no spending, no real supplier access, no paid AI, no database changes, no hosting or deployment changes** until separately authorized by the owner.
- No real product listing, orders, payment methods, dispatch, promotional broadcasts, SEO indexation, automated ads or claims of live supplier evidence.
- Do not transfer ownership or alter another project. Existing Lovable/GitHub sync must remain intact.
- Produce code and test evidence in small PRs, never claim work completed because it appears in a plan.
