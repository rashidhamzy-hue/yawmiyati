# M9 — Final customer copy standard across five storefronts

**Status:** source-only wording and regression tests. No production activation, DB migration, supplier connection, payment, spending or deployment.

## Why M9 replaces the earlier copy pass

Previous tests required phrases such as "المتوقعة", "سيكون متاحاً" and "قبل بدء استقبال الطلبات" throughout customer content. These placeholders were repeated in homepage FAQs, country policy pages, regional cards, customer assistance, and legal/help pages. The owner rejected that wording across all five countries.

## Single source of customer-facing truth

- `src/lib/store/customer-service-copy.ts` contains Saudi, Emirati, Omani, Egyptian and Iraqi payment, shipping, delivery, returns, tracking, and pre-checkout wording.
- Homepages, shipping/return pages, help/terms/privacy pages, local shopping assistant and regional highlights use those entries rather than duplicating quotations.
- No repeated launch-placeholder slogans, upstream supplier names, or internal sourcing notes appear in standard public-facing content.
- Guarded cart/checkout/order screens **must still disclose** when a transaction cannot be completed. Misrepresenting disabled checkout as active is prohibited.

## Owner-provided shipping numbers are retained internally, not published as guaranteed live prices

- Saudi source quote: SAR 28; UAE: AED 19; Oman: OMR 3; Iraq: IQD 7,000.
- Egypt screenshot: EGP 95 / 100 / 105 for exactly named destinations, plus a separate merchant-only refusal deduction.
- Source files: `src/lib/store/historic-supplier-terms.ts`, `src/lib/store/egypt-shipping-evidence.ts` and `docs/SUPPLIER-POLICIES-2026-11-20.md`.
- The cited supplier quotations have not been revalidated with current seller agreements or activated checkout. Removing 'estimated' does **not** authorize asserting those figures as unconditional shopper charges or service-level promises.
- Once a merchant-approved shipping/returns policy is verified for each market, Claude should expose it through authenticated, versioned commercial configuration rather than editing quoted historical data into storefront strings.

## Launch-ready operations, still blocked pending authorization

1. Keep existing multi-country Supabase catalog/checkout/fulfillment OFF, indexing noindex and AI spend $0.
2. Review actual operator-owned domains and hosted revision; Lovable preview metadata previously showed public audience, which noindex cannot hide.
3. Decide whether the production backend remains the Yawmiyati Supabase commerce schema or whether verified WooCommerce is introduced. Never reactivate the retired TasteWP/Woo bridge or create competing order sources of truth.
4. Connect approved Taager/local provider APIs only after owner authorization; record product provenance, media rights, variant/stock freshness, fees and COD delivery coverage.
5. Select 100–150 evidence-qualified SKUs **only if there are enough verified candidates** per country, then generate market-local Arabic, SEO metadata and AI-search facts with citations for owner approval.
6. Complete verified commercial seller policies, actual shipping fees, returns, support contacts and consent wording before customer payment or dispatch.
7. Run authenticated staging owner E2E, durable AI job processing, checkout and reconciliation simulation, real deployment smoke tests and an explicit launch signoff.

## Regression test contract

`src/test/m9-five-market-verified-customer-copy.test.tsx` and reconciled older tests reject supplier references, rejected placeholder phrases and unverified public shipping amounts, while preserving the original private evidence and denying fictional successful orders.

The user has chosen **not to transfer any accounts yet**. See `docs/handoff/M7-OWNERSHIP-TRANSFER-PREFLIGHT.md` when the owner decides to proceed.