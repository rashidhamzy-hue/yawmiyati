# Milestone 4B — evidence-first product catalog contract (source only)

**Date:** 21 November 2026. **GitHub baseline:** `main` `2ad419049670fd0f837df074cecde8c34e62d17e` (M4A #93 merged).  
**Implementation:** `src/lib/store/offline-product-proof.ts`; tests `src/test/m4b-offline-product-proof.test.ts`.

## What we actually built

A pure, deterministic, offline **review validator** for Saudi Arabia (SAR), UAE (AED), Oman (OMR), Egypt (EGP), and Iraq (IQD). It validates a proposed product bundle against the expected market, approved content revision, category taxonomy, image URLs/media provenance records, unique SKU/option combinations, integer-minor-unit price/cost, stock state, stock observation recency, and source references.

The 15-minute freshness rule is an **advisory rehearsal policy**, not a supplier SLA or proof of a working stock source. Image host allowlists must be supplied from a separately **owner-approved** policy, and a URL under an allowed host is NOT proof of media ownership. Any strings presented as source, rights, cost or owner approval are still unverified user-controlled inputs. They must be authenticated against independently held records in a later production implementation.

The validator always returns:
- `advisory: "OFFLINE_ONLY"`
- `publishAuthorized: false`
- `orderable: false`
- `canSyncSupplier: false`
- `hasVerifiedRealEvidence: false`

`readyForHumanReview: true` means the **shape and internal consistency** of proposed evidence fields passed. It is *not* verified stock, licensed imagery, a signed-off vendor contract, price authenticity, owner authentication, or permission to sell. The test fixtures are generated locally with fake identifiers and references; zero real products or proof were imported.

## Proposed persistence model — not created in Supabase

Future server-side migrations must be designed, reviewed and separately authorized. Suggested logical records/keys:

| Entity | Minimum fields | Required invariant |
|---|---|---|
| `supplier_observations` | market, provider, source_product_id, source_variant_id, observed_at, source_signature/reference, currency, stock/cost | Authenticated provider identity, append-only source history and 15-minute stock TTL at publish/checkout |
| `product_content_revisions` | market, listing_id, content_revision, title/description, created_by, created_at | Immutable revisions; every revision signed by authorized owner |
| `product_media_evidence` | market, listing_id, revision, image_id, HTTPS location, SHA256, supplier/origin ref, rights/license ref, alt, owner media approval | No unrelated-host redirects, expiry controls, verified media ownership, legal approval and auditable changes |
| `category_memberships` | market, listing_id, category_slug, taxonomy_version, owner/category approval, revision | Approved taxonomy version, duplicates forbidden, market-local public membership |
| `variant_matrix` | market, listing_id, supplier_variant_sku, unique attributes, current price_minor and currency, approved content revision | One unique combination per listing; quantity and price verified for market; no cross-store re-use |
| `stock_observations` | market, provider, variant, observed_at, in_stock, available_units, provenance | Never infer availability from missing stock; no update from sample fixtures |
| `catalog_release_decisions` | listing, market, owner_id, approved_revisions, evidence refs, signed_at, expiration, release decision | Authenticated owner role, current independent stock/commercial/media/category checks, transactional release |
| `catalog_public_projection` | market, listing, released description/prices/images/variants/categories, revision | Read-only market-scoped RPC, no draft/synthetic leakage, withdrawals invalidate projection |

Use market-qualified foreign keys, unique composite identifiers, RLS/role enforcement and transactionally locked source revisions. Do not rely on client-computed `readyForHumanReview` as a security boundary. The existing public RPC only exposes listing ID, slug, title, price and detail description. This milestone does **not** alter those RPCs or extend `ApprovedExtra`. A future public projection must be designed separately once evidence and access controls are available.

## Release plan when separately authorized

1. Obtain *official* provider contract and authenticated stock/cost sources for all five markets; verify any restrictions on product/media use, variation models, tax and shipping.
2. Register an authorized-media domain policy and legal rights chain; test image downloads and CDN caching with source signatures and private access controls.
3. Implement owner-approval revision workflow, server-locked cross-market category/variant records and audit trail.
4. Extend read-only public RPC(s) **only after release is approved**, then implement category-specific queries and galleries.
5. Check stock again **transactionally at the time of checkout** with durable order idempotency and supplier acknowledgment. Publication is never enough to guarantee stock.
6. Security review (RLS, privacy, retention, copyright, SSRF, signed webhooks, supply chain) and five-country owner signoff.

## Milestone verification

```bash
bun install --frozen-lockfile
node scripts/check-simulation-boundary.mjs
node scripts/check-storefront-truth.mjs
node scripts/check-handoff-manifest.mjs
bun run build
bun run test
```

This PR is documentation and pure source/test code only: **no** Taager/Woo API requests, Supabase/Cloudflare changes, downloads, DNS, tokens, media uploads, payment/checkout, AI spend, advertising or deployment.

## Next

M4C — offline owner dashboard experience and role-review planning, retaining auth and privacy constraints; assess market switcher, review queues, empty states, reports, mobile accessibility and evidence-derived approvals. Keep improvements source-only. All forty M3A launch gates remain blocked.
