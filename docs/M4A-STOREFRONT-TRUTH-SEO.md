# Milestone 4A — storefront truth and source-only programmatic SEO

**Date:** 20 November 2026. **Scope:** free GitHub-only source changes; no Taager/Woo/provider, Supabase, Cloudflare, AI spend, ads, domains, checkout or production deployment.

## Audit basis

Repo `tarikhtube-stack/saudi-store-spark` on `main` at `46816e41f45ce03d049b9a24452a9fb6e552df14` after M3C #92 merged. Reviewed actual route entrypoints `src/routes/`, site head `src/routes/__root.tsx`, storefront modules `src/components/store/*`, market content under `src/lib/store/`, `public/robots.txt`, approved public catalog and the historic supplier-policy ledger.

### Findings

1. **Commercial copy exceeded verified evidence.** Saudi home, FAQ, help/terms and shipping page asserted COD was already available, 28 SAR flat shipping, 2–3/4–5 day delivery and seven-day returns. UAE, Oman and Iraq regional feature strips and policy pages similarly advertised supplier quotations and refunds. Egypt claimed delivery timetable while shipping table was missing. All of these could be interpreted as binding seller terms although checkout was disabled. M4A replaces those with explicit planned/conditional language without showing provider names.
2. **SEO indexing was not safely release-gated.** Root `noindex` depended on an env flag, and Saudi home/search had no explicit block in their local `head()` (other market pages were mostly `noindex,nofollow`). Root now unconditionally `noindex,nofollow` and Saudi home/search explicitly match. Neither provider domain nor canonical origin is authenticated/approved.
3. **No verified URLs for canonicals/hreflang** and no trustworthy product metadata for rich-result offers. Generating thousands of country × category × product pages would risk thin, duplicate or fictional pages. M4A creates **offline drafts**, not crawlable pages.
4. **Legacy fictional cart/catalog remains quarantined:** `src/lib/store/catalog.ts` includes hard-coded Saudi price/shipping and products; `src/lib/store/cart.tsx` and `src/components/store/ProductCard.tsx` depend on it and show an enabled cart. They are NOT mounted by current public route entrypoints. Do not reuse without a separate removal/refactor PR. `scripts/check-storefront-truth.mjs` prevents direct public route usage and reintroduction of quoted fees into the active storefront files.
5. **Public policy pages are not final legal terms.** All regional pages now clearly say checkout is not active, shipping fees, timing, returns and final customer rights still need local validation and owner approval.

## Implementation

- `src/lib/store/seo-planning.ts` builds exactly 40 **non-indexable editorial drafts** (5 homes + 30 category ideas + 5 internal search templates), each with distinctive country context and no absolute canonical, hreflang, sitemap eligibility or structured data. Product draft generation takes only plausible approved-public listing fields and still remains `noindex`. Unknown category slugs/invalid SKUs/currency mismatch fail closed. **Do not bind these drafts to public routing or assume category content is verified inventory.**
- `src/routes/__root.tsx`, `sa.index.tsx`, `sa.search.tsx`: explicit `noindex,nofollow`; no env-driven activation. Robots.txt currently allows fetching. This is compatible with crawlers reading the noindex directive, but is **not** a comprehensive production robots/site indexing design; a future crawl plan must coordinate hosts, redirects, robots, sitemap and per-page head.
- `src/lib/store/saudi-commerce-content.ts`, `market-policy-pages.ts`, `brand-story.ts`; `MarketPreview.tsx`, `MarketPromiseStrip.tsx`, `StoreInfoPage.tsx`, `StoreCommerceGuard.tsx`: conditional COD/fee/returns text with no invented customer commitment.
- `scripts/check-storefront-truth.mjs`: regression guard covering active storefront source and route-entrypoint imports. This does not prove all transitive imports or build output provenance.
- Existing UI tests refactored to assert honest conditional copy. `src/test/m4a-seo-truth.test.ts` adds five-country SEO/noindex and policy assertions. Commerce CI runs the new guard.

## SEO release prerequisites (explicitly NOT done)

- Confirm and approve 5 market domains/origins (including SSL, slash behavior and canonical policy), distinct country content and exact regional URL strategy.
- Confirm category membership and inventory count from **released** database records. Categories are currently editorial pages, not verified SKU collections.
- Verify and release per-product media ownership, titles, descriptions, variants, price, currency, stock TTL, shipping/returns/legal terms and offers.
- Define semantic equivalence before hreflang linking; not every country's SKU has another-country equivalent. Use only authentic product/locale mappings. No speculative `x-default`.
- Generate a **bounded verified-only** sitemap and lastmod policy after deployment and source approval. Search pages, checkout, internal owner pages, placeholders, zero-product thin categories and URL parameters must be excluded.
- Use Product/Offer/Review/AggregateRating JSON-LD only with verified facts reflected in visible content and actual supported commerce availability; never emit invented reviews, stock or shipping guarantees.
- Obtain owner sign-off separately to change indexability, provider integrations, commerce flags or deployment. All five markets stay blocked by M3A's 40 evidence gates.

## Tests and limitations

```bash
bun install --frozen-lockfile
node scripts/check-simulation-boundary.mjs
node scripts/check-storefront-truth.mjs
node scripts/check-handoff-manifest.mjs
bun run build
bun run test
```

GitHub browser QA must pass responsive 320/390/768/1440 across all markets and its local-only owner sandbox. CI is not a live Lighthouse, Search Console, technical crawl, production deployment, or authenticated owner test. The new `seo-planning.ts` is **offline preparation**, not an active programmatic SEO launch.
