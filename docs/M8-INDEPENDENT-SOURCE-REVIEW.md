# Yawmiyati — Independent source and readiness review (21 November 2026)

**Status:** Engineering notes based on private GitHub source, Lovable project metadata, and the existing Supabase staging checks. **Not an independently verified hosted browser or device audit.** This document is source work only: no services connected, money spent, production content published or database functions applied.

## Confirmed strengths

- Current Lovable latest source SHA `cc5a9420da68e45a62c3f9ab54a7525ebe2fab0c` matched GitHub `main` on review. This verifies code-revision synchronization at that point, not production deployment.
- Five country home, product, category, search and information routes exist; Arabic/RTL storefront composition, responsive Tailwind classes, a keyboard-trapped search modal, semantic route metadata and an intentionally disabled shopping flow are present.
- Owner dashboard is authenticated by Supabase and derives observed market-scoped data, with catalog pagination, candidate review, exact observed currency formatting and explicit simulated/offline restrictions.
- Core tests include deterministic commerce and AI safety checks plus browser automation at four viewport sizes.
- Supabase staging ref `skhtunkknshvolturqlm` was ACTIVE_HEALTHY at review. Empty real catalog and disabled checkout, publishing, fulfillment and paid AI must not be described as operational.

## Issues missed by an overly optimistic "perfect/10 out of 10" score

| Priority | Finding | Required next step |
|---|---|---|
| P1 | Only SA had `/cart`, `/checkout` and `/order/$id` routes. Existing `StoreCommerceGuard` already has regional content, so other markets would hit the generic not-found page. | **M8 source fix (this PR):** add equivalent prelaunch-guarded AE/OM/EG/IQ routes and route tests. Remain noindex and no transactions. |
| P1 | Lovable metadata reports `is_published=true` and `publish_audience=public`; this is different from asserting "nothing is published." | Review the public Lovable URL/access setting with the owner. `robots=noindex` is **not** an access-control mechanism. Restrict preview audience only with owner's approval; do not presume this is a commercial production launch. |
| P1 | GitHub `main` branch was unprotected as of review. | Configure appropriate branch rules/required checks in the receiving owner's account, subject to private-repository plan support; do not change ownership/settings silently. |
| P1 | Latest M6C candidate/readiness pagination SQL source is merged but both new RPCs remain absent from staging. | Apply only with explicit staging authorization **after** ownership transfer, validate owner JWT and cross-market access, test page 100 and 200. |
| P1 | The browser CI tests a local storefront and separate synthetic owner preview, **not** real authenticated Supabase owner navigation or a deployed live customer journey. | Add a real staging owner smoke test after transfer/authorization, including save/review/draft actions in non-production fixture records. |
| P1 | Empty products and inactive supplier flows mean there is no verified real product conversion journey. | Obtain signed-off suppliers, real costs and media rights, inventory freshness, category/product pages, variants, shipping/COD evidence, operational returns and settlement. |
| P2 | Current product routes use generic static metadata. SEO truth/indexing checks are useful, but do not establish product-specific programmatic SEO or AI-search visibility. | After verified catalog import, implement structured product data, dynamic page metadata, canonical/hreflang, sitemaps, internal links and release-gated indexing; don't add fictional product assertions. |
| P2 | Editorial images are currently hosted on Unsplash CDN. Image rights are documented for editorial images; product media rights/ownership are not yet present. | On approved supplier data, host licensed product media durably, generate responsive formats and real alt text; optimize LCP/CLS and fallback. |
| P2 | Source uses shared Arabic layout and country-adapted text, but source/test suite does not prove professional native-speaker legal and conversion review for all five markets. | Review Arabic by market, contrast, screen readers, keyboard on real browsers, error states, shipping terms, tax and returns locally before publication. |

## What the test scores actually establish

A passing CI test suite proves its assertions on that revision. It does **not** prove running supplier integrations, uptime, accessibility, Core Web Vitals, checkout, settlement, domain ownership, production security or cross-device visual quality. Subjective scores like 9.5/10 for design and 10/10 for architecture are opinions, not measurable launch acceptance.

## Suggested pre-handoff sequence

1. Merge M8 on **both** Commerce checks and Storefront browser QA green; do not merge if checks do not run.
2. Review Lovable preview audience, actual published domain, and whether the preview should remain public; do not change access without approval.
3. Follow `docs/handoff/M7-OWNERSHIP-TRANSFER-PREFLIGHT.md`: verify destination GitHub/Lovable connection, transfer repository, then only Yawmiyati Supabase project; leave other projects unchanged.
4. Reconnect access/CI, apply the approved pending M6C staging migration, and run authenticated end-to-end owner tests.
5. Integrate authorized suppliers, real catalog, evidence-based country policies, backend AI jobs, shipping/COD and synthetic orders. Remain noindex and no-sale until an independent launch signoff.

**No GitHub/Supabase ownership changes or real deploys were performed as part of this review.**
