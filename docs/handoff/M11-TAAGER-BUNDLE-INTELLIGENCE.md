# M11 — Taager bundle intelligence, offer graph and pricing (integration specification)

**Authored:** 21 November 2026. **Status:** engineering specification, not a built or deployed bundle feature. No supplier API connection, new database migration, paid AI task, product import, discount activation, checkout or customer orders are authorized by this document.

**Canonical stack:** `tarikhtube-stack/saudi-store-spark` (GitHub) + existing project `skhtunkknshvolturqlm` (Supabase STAGING). Markets: SA, AE, OM, EG, IQ. Do not touch other projects or reactivate the retired TasteWP/Woo bridge.

## 1. Evidence and uncertainty from owner screenshots

The owner showed four screenshots of authenticated Taager **Saudi** seller catalog/product views (21 Nov 2026). Examples:
- Three-piece drain-cleaner promotional offer: supplier-dashboard price SAR 100, minimum selling price SAR 170, displayed spread SAR 70.
- Two-piece drain-cleaner promotional offer: price SAR 90, minimum selling price SAR 170, displayed spread SAR 80.
- Two-component refrigerator accessory bundle: price SAR 60, minimum selling price SAR 90, displayed spread SAR 30.
- Taager `home → Home Bundles` catalog shows multiple independent supplier listings and separate SKUs. Bundle composition and the presence of component SKU labels vary by listing.
- Promotions printed **inside** media include `40%`, `Black Friday`, `November`, free gifts and product performance claims. These are artwork, **not** audited consumer discount evidence, licensed reusable creatives, or current promotions.

A screenshot alone **does not prove** matching products across different brands, a stable component mapping, shared inventory, a valid minimum-resale-price contract, stock, fee inclusions, promotions' validity or whether a mixed kit is atomically fulfillable. The dashboard's displayed profit spread is **not delivered contribution** after fees, taxes, advertising and COD refusals.

**Country availability:** Taager's public materials explicitly name Egypt, Saudi Arabia, UAE and Iraq. A third-party Vondera importer offers `OMN → OMR` selection, but this is **not proof** Taager currently fulfills orders in Oman. Verify by Taager's written confirmation, supplier account and supported API; otherwise configure an independent approved Omani supplier adapter.

References (external, not integration authorization):
- https://taager.com/sa/about-us
- https://www.vondera.app/help/app-taager-catalog
- https://www.vondera.app/en/help/import-data
- https://www.wphive.com/plugins/taager/ (third-party documentation of plugin behavior; verify against official provider release)

## 2. Canonical data model: supplier offer != physical product != customer listing

Use distinct immutable, market-scoped identities and revisioned observations:

1. **ProviderOffer**: `provider_id`, `market`, `provider_product_id`, `provider_offer_sku`, `provider_revision`, `observed_at`, `provider_status`, `currency`, `offer_kind`. A Taager bundle SKU is a **distinct orderable offer**, not a synthetic alias for component SKUs.
2. **CanonicalProduct**: internal factual identity for one physical item (brand/manufacturer/model/GTIN when verified, formula/size/variant). Never merge by Arabic title or image resemblance alone. A canonical identity can have multiple supplier SKUs and markets.
3. **OfferComponent**: evidence-backed `offer_id`, `canonical_product_id`, `component_supplier_sku` (only when verified), `quantity`, `unit`, `variant_id`, `source_evidence_id`, `verification_state`. Explicit unknown component allowed; no invented component SKU.
4. **OfferKind**: `single`, `same_sku_multipack`, `fixed_mixed_bundle`, `provider_native_promo`, `configurable_bundle` (ONLY if supplier supports configurable fulfillment), `unknown`. Distinguish marketing terms such as "bundle" from verified physical composition.
5. **OfferRelationship**: directed evidence-backed edges: `contains`, `same_product_family`, `same_components`, `alternative_pack_size`, `complementary_item`, `potential_duplicate`, `unknown`. Only verified edges may affect pricing/availability/fulfillment. Never infer `same_components` from image text or near-identical descriptions.
6. **ProviderAvailability**: market- and SKU-scoped stock/availability report, freshness timestamp, provider orderability flag, fulfillment mode and separate inventory pool ID **if supplied**. Product stock is not interchangeable with native-bundle stock unless confirmed.
7. **CommercialTerms**: observed supplier amount, **verified acquisition cost** (distinguished), minimum allowable selling price, provider retail recommendation, taxes, shipping/COD/return/refusal charges, settlement and expiry/effective dates. Costs and floors all in **integer minor units** plus explicit market currency. Record whether dashboard figures include shipping/taxes/other fees.
8. **ContentAssetRights**: media URL/hash and provenance, usage permissions, claim review, offer-specific versus reusable photos, promotion period, and `customer_display_allowed`. A supplier's marketing banner does not prove savings, medical/cleaning effectiveness or perpetual offer validity.
9. **CustomerListing**: Yawmiyati listing/slug, store, approved revision, exact offer ID(s), display title, image, approved description, customer price and category. Multiple listings from one canonical product do not imply separate demand or inventory. Do not automatically cross-publish to other markets.
10. **OfferProposal / OwnerApproval / PricingExperiment**: proposals can be automatically generated, but live price/discount/offer publication requires a market + revision-specific authorized policy and audit record. For v1, owner approves individual commercial changes.

**Database implementation direction:** existing `catalog_import_candidates` primary key is `(store_code,woo_product_id,woo_variation_id)`, so it **cannot express** arbitrary Taager bundle components, non-Woo provider IDs or cross-listing mappings without additive tables. Design versioned `supplier_offers`, `canonical_products`, `offer_components`, `offer_relationship_evidence`, `offer_commercial_terms`, `offer_inventory_evidence`, `listing_offer_mapping`, `promotion_proposals`, `promotion_approvals`. Store raw provider payloads privately (with strict retention, redaction and access); no direct customer access. Draft migration and test on isolated staging **after owner authorization**, never alter existing five release flags as a side effect. Supabase uses deny-by-default/RPC access; preserve all existing permissions.

## 3. Catalog reconciliation on every permitted supplier synchronization

A. Enumerate all supplier products/offers for a **specific market** with pagination and stable provider IDs. Capture both ordinary and `Home Bundles`/special-offer categories, not just the first 100/150 results.

B. Normalize offer observations, market and currency, source revision, SKU, availability and economics. Source title/description/media are untrusted data; supplier labels like `highest profit` or `40%` are NOT audited conversion evidence.

C. Derive a provisional composition from explicit provider component records. If only screenshot/title/image quantities are available, mark `needs_composition_review`; do not publish the unit count as fact until verified. For a provider-native bundle, keep **one** supplier order line for the bundle SKU.

D. Build relationships via **verified component signatures** (canonical ID × quantity, sorted), not fuzzy text alone:
- Exact signature + same offer provider may mean duplicate offers; compare price/floor/stock/revision, retain distinct provider SKU.
- Same canonical item with quantities 1/2/3 → quantity/pack alternatives; compare price **per verified unit**, not overall offer price.
- A fixed mixed bundle → graph of its declared constituents, with its own identity and orderability.
- Partial overlap → potential cross-sell or bundle alternative, not necessarily duplicates.
- Same-looking creative across differing formula/brand/SKU → **review only**.

E. Rank catalog selection by **independent product families and distinct offer propositions**. Avoid filling 150 slots with near-identical 2-packs, 3-packs, mixed combinations and brand aliases. A family may show one primary offer with pack-size alternatives; exceptionally strong alternative bundles can have separate customer listings after margin/content/stock review.

F. Reconcile disappearance, expiry, changed cost, loss of verified media or stock: invalidate dependent pricing and promotion approvals; freeze unpublished drafts, unpublish/disable sellable offers according to release policy; log every event for the owner.

G. Incremental + full reconciliation: idempotent upsert keyed by `provider + market + provider_offer_sku + provider_revision`, provider event IDs, dedupe, ETags/cursors if supported. Source-delete is not immediate internal delete; maintain a time-bounded tombstone for audit and active-order resolution.

## 4. Inventory and order routing — supplier-native first

- **Native Taager bundle:** checkout line is its exact native Taager offer SKU/variant and quantity. Do not break it into component SKUs, because the bundle might have its own stock, packaging, return rules and economics.
- **Merchant-created combination:** only if Taager explicitly permits order submission as multiple lines, combined shipping, package handling, COD collection and returns together. Otherwise do **not** offer it as a single guaranteed bundle.
- Quantity limits, max cart combinations, member inventory reservations and simultaneous purchase cases require supplier-specific documented support. If only an availability boolean exists, display availability conservatively.
- A supplier may share stock between bundles and singles or maintain separate pre-packed stock. Never subtract both inferred component stock and native bundle stock without confirmed inventory model; avoid double reservations.
- At checkout: re-read current supplier SKU availability, floor and cost terms; validate exact authorized market and currency; freeze customer price, order totals and source revision; submit with idempotency key; map provider acknowledgment and partial failures to the existing order lifecycle.
- Cancellation/refund/restock: bundle-level vs component-level policy must be confirmed for that offer. Require deterministic reconciliation if a mixed bundle has partial delivery/return.

## 5. Pricing Intelligence — recommend, simulate, approve, monitor

All calculations use integer minor units/BigInt, never floating-point retail amounts.

**Baseline per sellable offer:**
- `supplier_cost`: verified Taager procurement/settlement amount for the bundle SKU, **not** sum of component list prices unless confirmed.
- `seller_floor`: latest verified market-specific Taager minimum sale price or contractual rule, effective period and restrictions; keep unknowns as blockers.
- `delivered_contribution` = customer revenue less supplier offer cost, seller-borne shipping/COD charges, taxes, handling/payment fees, expected discounts and acquisition/advertising costs, including applicable refund/return reserves.
- `expected_contribution`: incorporate delivered versus refused/cancelled COD outcomes, costs and measured delivery probability from actual market/offer evidence. Use existing `pricing.ts` break-even/refusal logic; unknown costs are **not zero**.
- `target_price`: evaluate compliant candidates at verified price floor plus target delivered contribution, market positioning and competitor evidence. Do not choose the highest margin blindly if it suppresses conversion.
- `discount_cap` = minimum of: verified legal/contractual floor headroom, owner budget cap, expected-margin headroom, permitted experiment/approval scope and valid comparison-price evidence.

**Promotion types (candidate generation, not automatically live):**
1. **Pack economics:** compare verified unit prices for one-piece vs two-piece vs three-piece alternatives; promote a larger pack only if the total and unit-price claims are accurate.
2. **Supplier-native bundle merchandising:** show "together" or "two-piece set" as product facts; a supplier bundle price does **not** automatically justify "save X%" relative to buying separately.
3. **Higher AOV:** complementary accessories from the approved catalog, threshold/quantity offers only if split-shipment/combined-shipping rules are confirmed, and owner-approved merchandising placements.
4. **Basket rescue:** clear shipping threshold only when actually profitable/available; abandoned-cart recovery only with user consent, permitted channel and frequency limits.
5. **Measured price optimization:** small owner-approved price tests by market/offer cohort, track delivered margin, conversion, returns/COD refusal and contribution rather than CTR alone; holdout and confidence thresholds before ramping.
6. **Repeat purchase and personalization:** only with consent and category-specific purchase evidence; never use invented behavioral metrics.

**Hard exclusions:** no fake urgency/stock counters/reviews, no meaningless crossed-out prices, no generic percentage-off badges copied from old supplier artwork, no stacking a supplier discount with a store coupon unless explicitly authorized. Preserve owner-approved min margins and floor. Do not discount below Taager's verified floor; if minimum seller price has a different legal meaning, confirm contract first.

For the screenshots: a SAR 90 supplier bundle with displayed minimum selling price SAR 170 has a **displayed spread of SAR 80** before costs. A SAR 100 bundle against SAR 170 has SAR 70. These are distinct offers even if the images appear related. At SAR 170, a further discount may violate the provider floor or erase the economic hurdle; do not auto-generate one.

## 6. Safety/compliance and creative guardrails

- Scan promotional images/embedded captions for dates, fake/stale sales, false reference prices, cleaning-effectiveness claims, safety labels and regulatory restrictions. A `Black Friday` graphic must never silently become year-round primary media.
- Check regional rules, delivery restrictions and accurate usage/safety information for drain cleaners, chemicals, fragrances, cosmetics, electrical products and children's goods before listing. This is a provenance/owner/legal review step, not AI medical or safety certification.
- A discount is a legitimate `(approved_comparison_price - current_price) / approved_comparison_price` only with applicable jurisdiction evidence and price-history/marketing compliance. Store the evidence and validity window.
- Store all approved title/description, variant count, components, images and discount claims per country and revision. Use M9 customer-copy rules and M10 noindex/release-gate contracts.
- All AI outputs are proposals grounded in component evidence; owner approves revisions in v1. Do not authorize payments, campaign spend, publishing or consumer messaging in this milestone.

## 7. Dashboard UX and guardrails

Add a **Bundle Intelligence** tab to authenticated owner console (future scope):
- Family explorer: `single item`, `2-pack`, `3-pack`, `mixed bundle`, provider bundle, other overlapping Taager offers.
- Family graph with source SKUs, verified constituent quantities and confidence/evidence status.
- Side-by-side native offer prices, per-unit cost, minimum supplier selling floor, potential seller price, delivered contribution after costs and COD-risk scenarios.
- Flags: `composition unclear`, `same image different SKU`, `minimum price outdated`, `bundle stock unverified`, `creative contains expired promotion`, `missing media rights`, `unknown return rules`, `unsafe/regulated claims`.
- Smart recommendations: `primary listing`, `add pack variation`, `cross-sell`, `reject duplicate`, `do not publish`, `request Taager clarification`.
- Revision-bound buttons: `Approve offer`, `Approve price`, `Approve promotion`, `Reject`, with immutable decision log and no auto-spend.
- Reporting: bundle share of real delivered orders, incremental contribution, refusal/return rate, attach rate, discounts granted, revenue cannibalization, component/offer overlaps and anomaly alerts. Never invent statistics with an empty catalog.

## 8. Integration acceptance suite (all five markets)

A. Supplier native SKU is preserved on item-level order receipt; mixed bundle is never split without confirmed permission.
B. Different SKUs referencing verified identical components are related but not silently merged across providers/markets.
C. Similar imagery/title with no explicit mapping stays unresolved; AI suggestions cannot bypass ownership gates.
D. Provider stock/inventory at different offers cannot be double-counted.
E. All prices/floors obey market decimal precision (SAR/AED/EGP two decimals, OMR/IQD three as configured).
F. Missing seller floor, fees, media rights, shipping coverage, product composition, or stock evidence → no auto-offer/auto-discount.
G. Promotion expiration/repricing/stock change revokes stale approval; checkout recomputes authoritative current seller constraints.
H. Customers see only valid, dated comparison prices and honest unit quantities; no fake savings, old Black Friday artwork or supplier identity.
I. COD refusal, return or courier failure reserve tested; lowest safe price still yields owner-approved expected contribution.
J. Supplier bundle/individual item mixed-cart cases, partial fulfillment, cancellation and refund behavior tested with provider-approved sandbox/fixtures.
K. SEO canonical URLs, structured data and categories represent the exact approved offer revision only; no cross-country contamination.
L. Native Omani Taager fulfillment and API rights **must be separately verified**; third-party import selector alone is insufficient.
M. Price/discount decision and AI policy have owner authorization, a bounded budget, immutable audit and rollback.

## 9. Exact information to collect from Taager (before implementation)

**Highest priority: request official API docs with a redacted JSON response from one single SKU, one same-SKU pack offer and one mixed-SKU native bundle.** For each include:
- `productId`, `sku`, `bundleId`, `parentId`, `variantIds`, `components[{sku, quantity}]`, title, images, categories, current stock and timestamp **if these fields actually exist** (field names are illustrative, not claims about Taager's API).
- How native bundles are ordered: bundle SKU alone, component lines or both? Can packs be shipped as one COD shipment, and how are mixed returns processed?
- Is a supplier bundle prepacked? Does inventory share single-component stock? Is supplier availability independent? How does out-of-stock/expiry propagate?
- Currency/minimum selling price semantics (hard enforced floor vs recommendation), VAT/tax, supplier cost meaning, COD/last-mile fees, region rates, return/refusal charges, shipping caps and whether bundles alter any fee.
- Which API environments, pagination, rate limits, stock refresh and order webhooks exist; provider-supported export or safe sandbox; media usage rights.
- SKU stability and whether promotions, component mapping, and supplier media carry separate expiration fields.
- Operational account support **per country**: SA, AE, EG, IQ, and confirm specifically whether OM supports full product+order+COD fulfillment, not merely product import.
- Supplier marketing asset rights and whether the user can replace embedded expired promotion creatives with neutral licensed images.
- Seller-level promotions, quantity tiers, supplier native bundles, coupon constraints, allowed list/compare price treatment.

**Screenshots if docs are unavailable:** for each relevant market, full single-item detail, 2-pack detail, mixed-bundle detail, constituent SKU cards showing SKU and current sell floor, and the supplier order/fee/returns documentation; share no account tokens, customer data, personal email, sessions or order history.

## 10. Phased delivery — distinct from current M10 completion

**M11A (now):** validated design and required supplier evidence (this file). No code, schema or deployed behavior. Owner may provide nonsecret screenshots and support answers.

**M11B (Claude, read-only/offline):** implement deterministic bundle composition schema, relationship graph, contract validators, exact economics simulation, discount engine, safety blocks and synthetic adversarial tests. Do not use screenshot titles as verified components.

**M11C (authorized staging):** versioned additive market-isolated Supabase schema and authenticated review RPCs; read-only provider adapter with approved country keys; sample source mapping and stock evidence. No production publication or real order submission.

**M11D (authorized staging):** owner-facing review/approval UI, publish-safe offer registry, real media licenses and provider order fixtures; market-specific pricing/COD economics with revision locks.

**M11E (launch acceptance):** after signed provider commercial and fulfillment terms, perform staged order routing, reconciliation, rollback, lawful offer claims, A/B tests and explicit owner release authorization per country.

**Definition of done:** system can identify and link real seller-offer families across single items and native bundles with verified components, propose evidence-backed and profitable prices/discounts, safely route one real native bundle order after authorized launch, block unverified relationships/promotions, and reconcile actual supplier reports. Zero supplier connections or production effects were made to write this document.
