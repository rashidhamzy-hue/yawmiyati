# Yawmiyati — blueprint implementation truth and acceptance gates
Verified on 20 November 2026. This document distinguishes **source written**, **CI-tested**, **staging database-tested**, **deployed**, and **production-operational**. These are not interchangeable.

## Current hard evidence
- Private GitHub source: `tarikhtube-stack/saudi-store-spark` (planned owner `rashidhamzy-hue`); Lovable Souq Of Saudi synchronizes commits to this repo.
- Supabase Frankfurt staging `skhtunkknshvolturqlm` (planned account transfer to `rashid.hamzy@gmail.com`). Shared source Supabase org also contains another project's production database: transfer **only Yawmiyati**.
- At this audit: **zero** supplier candidates, country listings, orders, AI jobs and localized AI drafts; all five stores have catalog publishing, checkout and fulfillment OFF. Customer-assistant paid policies OFF with zero budgets.
- Old TasteWP/Woo test integration has been retired, including nine former imported product samples. No hosted five-store supplier integration currently active.
- Lovable preview can now use a **public-only** Supabase staging key, so owner sign-in can be exercised. Database access remains owner-JWT and membership restricted. A preview with a login is not proof the end-to-end owner dashboard was browser-tested.
- Historic Cloudflare owner Worker deployment is older than React dashboard implementation and newer source; direct upload previously blocked and GitHub Builds connection loop unresolved.

## Features and their actual status
| Domain | Verified today | Unfinished before commercial launch |
|---|---|---|
| Landing/visual system | Branded responsive RTL Saudi home; shared five-market header/footer, editorial category and info pages; CI passing | Real 320px/390px/768px/1440px browser regression, visual sign-off, durable source images, SEO production metadata |
| Market isolation | Five country codes/currencies (OMR 3 decimals), market-scoped RPCs, five read-only public routes | Real five stores/domains/DNS/SSL, suppliers by market, legal country settings and hreflang |
| Catalog | Owner-reviewed candidate state, immutable content approval, transactionally created private draft, release gates, public verified catalog and detail RPCs database-tested | New supplier imports, actual products, verified costs, true stock source, variant matrix, category mapping, media, pagination/filters/search indexing |
| Categories | Editorial photo-driven category route for every market | Actual approved product-to-category membership and filtered product result contract; currently intentionally does not invent category results |
| Product details | Verified price/title/description through public RPC, safe no-checkout state; deterministic related items using verified public catalog | Image galleries, variant selection, trustworthy specs, shipping/returns disclosures, real cart, mobile sticky purchase controls |
| Recommendations | Product research evidence scoring; transparent related products among approved catalog | Behavioral recommendation engine, feedback/outcomes, consented preference profile, A/B tests, contextual cross-sell, instrumentation; no personalized AI recommendation currently |
| Research | Evidence-scoring helpers with freshness/provenance and test coverage | Live platform research feeds, supplier discovery, category demand/competition, actual market signals and research job scheduler |
| Pricing/COD | Deterministic contribution and refusal/break-even calculators, unknown values fail closed | Actual supplier wholesale costs, per-country COD fees, courier costs, tax, refusal probability measurements, price approval and live monitoring |
| Cart/checkout | Legacy fictional demo cart disabled; protected order/checkout paths never place real orders | Market-specific real cart, address capture, COD and approved payment rails, fraud prevention, order acceptance/confirmation, legal consent |
| Supplier operations | Generic mappings/event schemas, idempotency and order lifecycle utilities source-tested | Five production providers, Taager source contracts, auth/signature verified webhooks, stock proof, actual order acceptance/dispatch, refunds and reconciliation |
| Courier/delivery | Order-state and reconciliation helpers | Carrier APIs, delivery/tracking events, costs, failed COD reconciliation, cancellation and return workflows, customer status portal |
| Owner dashboard | Owner-authenticated market summary, approvals, staged product review, AI control and reporting RPC; branded React login/layout | Real provider setup, end-to-end browser sign-in/mobile tests, daily operational actions, staff roles/permissions, usable inventory/order queues and evidence-backed alerts |
| Marketing | Observation metrics, content contracts and review-only draft storage | Real Meta/analytics connections, ad attribution, campaigns, creative pipelines, consent/opt-out, rules/evaluations; no automated ad spend |
| AI content | Anthropic server adapter, default-disabled budget job reservations, cited-fact output guard and human review | Server runtime wiring to active provider, verified real pricing/cost metering, scheduler, owner-approved tokens and quality evals |
| Customer shopping assistant | Visible RTL chat in all five stores; local grounded category/product answers; Supabase function deployed with JWT ON; quota policy disabled | Real public Anthropic request policy, abuse protection, authenticated/anonymous access design, token accounting, preference memory with consent, live product retrieval validation; no paid replies activated |
| Customer support | Informational help, terms/returns/privacy pages in consistent store visual style | Final legally reviewed country-specific privacy, returns, payment and contact terms, escalation process and real support channel |
| Analytics/monitoring | Staging tables, finance observations, Sentry/PostHog main-account services available for future wiring | Yawmiyati-specific events and live error tracking, privacy review, funnel dashboards, alerts and dashboards verified in use |
| Security | RLS, market scoping, readonly public catalog, fail-closed release, anonymous access smoke tests | Production penetration test, CORS/CSRF/CSP review, backup restore, secret rotation, abuse/rate limits, retained logs, incident response |
| Infrastructure | GitHub, Lovable synchronized project, Supabase staging, older Cloudflare Worker | Chosen host/domain for all five, continuous deployment, backup and rollback, account transfers, staging vs production separation, complete browser e2e suite |

## Required non-negotiable launch acceptance
1. Hosting/domain topology approved; each country's source of stock/cost/orders verified and safely connected.
2. Catalog includes real approved product photos and variants, with tested category queries and verified stock TTL; no fictional products, discounts, guarantees, reviews or prices.
3. Per-market checkout executes idempotent *synthetic* orders end-to-end; no real dispatch before owner approval; correct market shipping/COD/returns/privacy and payment terms.
4. Dashboards, supplier jobs, customer assistant, actual AI content creation and reporting are browser- and server-tested against the deployed app, not only unit-tested.
5. Security/abuse/spend caps, failure handling, alerts, access control and data protection verified.
6. Five markets achieve launch gates together unless the owner expressly changes the all-five launch decision.
7. After customer UI sign-off, transfer just the named GitHub repo and Supabase project to the main email. Preserve unrelated Kabsi production and all other projects.

## Design/UX regressions discovered from user screenshots
- Owner's Lovable /admin displayed a blank generic unconfigured state; updated branded state and public browser staging defaults, but still needs an actual authenticated browser test.
- /sa/search oversized and very sparse without data; redesigned compact treatment and consistent full site chrome.
- Earlier category routes redirected to home; now brand-consistent editorial routes across markets. Real filtered inventory is a separate, unfinished data requirement.
- Mobile AI chat previously had a wide sticky pill overlaying product CTA area; changed to icon-size on mobile and raised above product CTA region. Need real 320/390px screenshot and keyboard test.
- Missing coherent policies/help/footer links; implemented shared navigation/footer and five-market information routes. Text avoids invented legal/COD promises.
- Detail pages had no real recommendations; now only verified public catalog related items, not an unbuilt personalization engine.

## Next build sequence after design source QA
**Phase 1:** Preview browser acceptance on 320/390/768/1440 widths + authenticated owner dashboard, responsive screens, and image export; correct source-only visual issues. Document screenshots.
**Phase 2:** Decide hosting and provision each market with actual supplier credentials and country settings; build approved media, category and variant contracts.
**Phase 3:** Implement production-grade cart, checkout, order/reconciliation/courier workflows and tests with safe synthetic transactions.
**Phase 4:** Connect AI/recommendations/research/marketing to trustworthy verified data, with human approvals, explicit dollar budgets and privacy controls.
**Phase 5:** End-to-end testing, incident procedures, five-market approval, ownership transfer, production deployment.

Do not tell the owner that the full blueprint is operational. The current system remains a well-developed staging foundation with large portions unintegrated.
