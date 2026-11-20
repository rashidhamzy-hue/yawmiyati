# Milestone 2B — approved public product presentation (source only)

Date: 20 November 2026. GitHub-only. No integrations, deployment, supplier access, paid AI or live checkout.

## Scope of this PR

- `src/lib/store/approved-product-experience.ts`: deterministic Arabic search normalization, sorting, exact minor-unit price filters and bounded pagination **only over previously released `PublicListing` rows**. Rejects invalid currencies, duplicate slugs and malformed prices.
- `src/lib/store/ApprovedProductExperience.tsx`: responsive accessible catalog browser and gallery/detail component. No cart, checkout, stock, delivery promises, discounts, ratings, synthetic images or example merchandise.
- Optional `ApprovedExtra` presentation contract for *future* approved images, variants and specs. Requires matching market/listing ID, explicit public-approved release and validated per-entry approval; absent/malformed extras are omitted. HTTPS URLs are syntax checked. This is **not authentication, media ownership verification or provenance proof**.
- `src/test/m2b-approved-product-experience.test.tsx`: fail-closed parsing, sorting/filtering, galleries, selections and no checkout.
- No public routes are wired to optional extras. Existing `public_catalog`, `public_catalog_detail`, and `public_catalog_search` continue to supply the only customer-visible product records.

## Precise acceptance boundary

The *current* public RPC contract has only `listing_id`, `slug`, `title`, `price_minor`, `currency` and detail `description`. It does **not** expose approved photos, variants, specifications, category membership, stock, cost or delivery evidence. Consequently the gallery shows an explicit missing-image fallback and does not render variants/specs without a separately approved release-gated data source. The browser supports text, price range, price/name sorting and pagination over the returned public rows. Category/stock filters cannot legitimately be implemented until the approved RPC exposes verified fields.

The components are reusable presentation building blocks, **not a claim that live storefront routes have been fully integrated or browser-approved**. The price range uses minor units internally; a market-aware human-currency filter and server-side filtering must precede any scale rollout.

## Future integration gate (requires a separate approved milestone)

1. Extend authenticated owner media review, rights/license/source evidence, variant and spec verification; define release-gated per-market public RPC output and test RLS.
2. Confirm imagery uses an explicitly allowlisted storage origin and audit authorization; boolean `approved:true` supplied by a caller is not sufficient provenance.
3. Wire verified fields into public routes, invalidate stale release caches, add server-side paging/filter/category membership and stock TTL; never use `src/lib/store/catalog.ts` fictional examples.
4. Browser test 320/390/768/1440 widths plus keyboard, screen reader, image failure, RTL layout and all five currencies.
5. Only then revisit add-to-cart and checkout in a separately authorized release.

## Checks

Run `bun run test`, `bun run build` and `node scripts/check-simulation-boundary.mjs` in GitHub CI. Neither real infrastructure nor any supplier or AI credential is required.
