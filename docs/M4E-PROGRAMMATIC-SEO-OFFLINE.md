# M4E — Offline Programmatic SEO and Indexing Release Contract

**Date:** 21 November 2026. **Baseline:** M4D PR #96 merged into `main` at `7c066f7761831cc807205a28efa9430fd0fa008d`.

## Purpose and verified status

Yawmiyati targets five Arabic storefronts (SA, AE, OM, EG, IQ). This milestone prepares the **code-level SEO planning and approval checks only**. There is **no Google indexation activation, sitemap.xml, robots.txt change, production canonical tag, hreflang tag, Product/Offer JSON-LD, domain mapping, supplier connection, data migration, checkout, deployment, analytics activation or paid service**.

Existing M4A `src/lib/store/seo-planning.ts` covers **40 draft routes**: home + 6 editorial categories + search for each market (5 × 8). Search remains inherently noindex. M4E adds `src/lib/store/offline-seo-release.ts`: an approval-evidence audit for **35 editorial home/category route proposals** across five markets, plus owner-scoped product SEO proposal checks when externally provided product candidates exist. These **35 are unapproved proposals**, not real/indexable pages or published products.

## New contracts

1. **Route scope:** home: `/{market}/`; category: `/{market}/c/{slug}`; product: `/{market}/p/{slug}`. Only known category slugs and validated M4A product fields qualify for further review. Search and account/checkout/cart/admin pages are never eligible.
2. **Ownership evidence:** each candidate requires declared content approval, seller policy review, media-rights review, market release signoff, live route verification, a source reference, content revision, and an owner decision ref. These caller-supplied values **are not authenticated** by source code.
3. **Fail-closed outputs:** every returned entry has `robots:"noindex,nofollow"`, `canonicalUrl:null`, `hreflang:[]`, `sitemapEligible:false`, `structuredData:null`, and `releaseAuthorized:false`. Even if every untrusted boolean is true, `publishableCount:0`, `sitemapXml:null`, `robotsTxt:null`, `canonicalManifest:null`.
4. **Internal linking:** deterministic **relative** editorial links follow each market's designed category order, remain within that market, de-duplicate, and omit the selected category where applicable. They do not assert that category pages have verified products.
5. **Cross-market alternatives:** relative-path **suggestions** only, matched by explicit shared-entity reference and route kind. Category alternate suggestions require identical category slugs. Product alternates require explicit matching shared product reference (not guessed from title/SKU). Duplicate markets in a group or missing evidence prevent suggestions. **No hreflang tags** or absolute URL claims emitted.
6. **Defensive limits:** rejects invalid markets, invalid product slugs, unsupported categories, duplicate route paths, unsafe alternate group references, conflicting groups, unbounded 501+ candidates, and missing evidence.

## Why this is not yet a production SEO release

The project does not have the following independently verified, owner-approved records:
- All five production domains/origins and their HTTPS/redirect/canonical topology.
- A real, released and current market-specific catalog with approved localized product descriptions, categories, images, rights and stock.
- An authenticated, immutable product-equivalence mapping across the five markets; equal names do not imply identical products.
- Owner-approved policies, legal information, seller identity and actual checkout configuration.
- A signed server-side SEO release authorization policy and a transactional invalidation path for withdrawn listings.
- Google Search Console ownership, sitemap monitoring, validated page rendering, structured-data and quality checks.

**Do not publish thin auto-generated product/category pages.** Public category copy can remain useful editorial content without claiming stock or purchase availability. Avoid indexing filtered/search/sort/pagination duplicates and no-result pages. Require distinct localized value beyond name replacement for each indexed page.

## Future production release (separate authorization only)

1. Decide domain design (one host with five path prefixes vs five owned hosts) and verify DNS, redirects, SSL and ownership for all five; do not assume `yawmiyati.com` or any unverified domain.
2. Use server-held market-local product release records and independently verified license/content/price/stock evidence. Create approved product equivalence keys and reciprocal alternate routes only where appropriate.
3. Define **exact** canonical URL and `hreflang` (for example, `ar-SA`, `ar-AE`, `ar-OM`, `ar-EG`, `ar-IQ`) after actual routes are verified. Non-equivalent products must not cross-link as translations.
4. Define a server-side, authenticated sitemap and optional sitemap-index projection of ONLY eligible, HTTP-200, canonical, live pages; remove withdrawn URLs promptly. Audit robots directives at origin, cache, and crawler levels and never flip current unconditional `noindex` through a browser env flag.
5. Structured data must come only from licensed, reviewed, real public facts. No invented ratings, reviews, stock status, delivery guarantees or Product/Offer markup before product and commerce authorization.
6. Verify on mobile and desktop with crawl tests, accessibility, content-quality checks, Search Console and rollback procedures; require explicit owner signoff.

## Verification

```bash
node scripts/check-simulation-boundary.mjs
node scripts/check-storefront-truth.mjs
node scripts/check-handoff-manifest.mjs
bun run build
bun run test
```

New tests in `src/test/m4e-offline-seo-release.test.ts` cover five countries, missing evidence, full spoofed approvals, route misuse, category linking, product slugs, alternate grouping/reciprocity, and always-null indexable output. Full GitHub public/localhost browser QA remains required. Browser QA does **not** claim active SEO crawler testing or deployed production authentication.

**Next free milestone:** M4F — AI agent/content/research readiness under offline mocks, human approval and zero-dollar default policies. All five markets remain blocked from real launch.
