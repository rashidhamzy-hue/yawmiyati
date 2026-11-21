# M10 — Five-market storefront hardening and Claude integration handoff

**Scope:** source and CI work only, on `tarikhtube-stack/saudi-store-spark`. **No project/account transfers.** All real commerce, supplier dispatch, paid AI and public indexing remain disabled.

## M10 milestones and exact boundaries

| Milestone | Pull request | Delivered | Not delivered |
|---|---|---|---|
| M10A | #120 | Localized information/category/story metadata for SA, AE, OM, EG, IQ; unknown categories blocked; safe product metadata helper; `noindex,nofollow` | Real product-specific server-rendered metadata (requires verified public catalog on SSR), indexable canonical/hreflang/sitemaps |
| M10B | #121 | Existing approved-product gallery integrated into real product route, details, variant/gallery/spec UI and image fallback; responsive verified product page | Image/media/variant RPC from trusted service; actual supplier photography or stock selector |
| M10C | #122 | Four balanced Saudi FAQs, local cash-on-delivery message in search, 44px search clear button, outside/Escape country selector, assistant mobile navigation spacing, customer-friendly category and checkout copy | Full live browser device/accessibility acceptance or connected checkout |
| M10D | #123, merged after green Commerce CI/browser QA | Verified-category UI renders only explicitly owner-approved catalog category slugs; new fail-closed parser with tests | Staging backend returning approved assignments; actual populated categories; production API, DB mutation |
| M10E | #124, CI pending at document update | Exact customer-facing currency display using BigInt and locale-aware fraction placement for SAR/AED/OMR/EGP/IQD; tests protect the configured minor units | Actual live product prices, supplier costs, or payments |

## IMPORTANT: Category contract is not live yet

The current `public_catalog` RPC exposes only `listing_id`, `slug`, `title`, `price_minor`, `currency` and is filtered by `current_catalog_release`. There is no category assignment column in the current staging tables. **Do not classify listings from supplier titles, descriptions, photos, raw category labels, or AI guesses**. It would be false to call this a working live category-filtered catalog.

The new frontend accepts optional response fields **only from the existing release-gated public RPC**:

```ts
{
  listing_id: string, slug: string, title: string,
  price_minor: string, currency: string,
  category_release: "owner_approved",
  approved_category_slugs: ("home"|"kitchen"|"beauty"|"fashion"|"wellness"|"organize")[]
}
```

`parsePublicListings` fails closed if the fields are malformed, unknown, duplicated, or missing owner approval; if omitted, it retains the legacy behavior and the category landing page stays purely editorial. Category cards use actual released data only. This M10 pass **does not add or deploy any SQL migration**.

For Claude: after authorized Supabase ownership/staging migration, implement a server-side category approval source with market isolation, release revision/owner audit, licensed product images, and explicit publication checks; return the two optional public category fields **only when a fresh owner approval is still valid for that listing revision**. Test forged categories, stale revisions, wrong markets, unknown slugs and unavailable stock. Keep direct table access blocked. The existing M6C migration must be verified separately.

## Remaining launch blockers

1. Real supplier integrations per country (Taager where supported and authorized), signed contracts/terms, wholesale cost, live stock, shipping/COD and returns.
2. Durable approved product images and variants, source citations, category mapping and secure public RPC proof.
3. Product-specific SEO SSR metadata, absolute canonical/hreflang, structured data and sitemaps only after verified domains and launch authorization.
4. Supabase staging migrations, authenticated owner admin E2E and persistent AI job execution with a bounded approved budget.
5. Actual customer cart/COD/order management, courier API, rejection/return reconciliation, country-local legal policies and verified seller identity.
6. Production hosting, domains, backups, security review, rollout/rollback and explicit release signoff.
7. Real browser accessibility, keyboard, color contrast, load/performance and mobile 320/360/390/768/1440 checks; GitHub browser QA does **not** prove actual authenticated Supabase owner operations or real orders.

## Deploy / wait / stop

**Proceed** with code and CI on GitHub, then verify synchronization with Lovable's noncommercial preview after each merge. **Wait** for all required checks to pass before merging PRs. **Do not** trigger a new public Lovable deployment or Cloudflare Worker deployment until the owner has confirmed the intended staging/production target, revision and rollback; the preview is already published/public according to Lovable metadata. Any external hosting change can expose the site beyond source control.

**Stop before** moving accounts, applying staging SQL, importing live provider products, paying for AI, changing noindex, publishing customer product claims, collecting payments, taking real orders, or dispatching carriers without a separate authorized commercial release.

Original continuation docs: `docs/handoff/M7-OWNERSHIP-TRANSFER-PREFLIGHT.md`, `docs/handoff/M6-OWNER-WORKFLOWS.md`, `docs/M9-FIVE-MARKET-CUSTOMER-COPY.md`.
