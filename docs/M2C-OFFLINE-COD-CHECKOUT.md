# Milestone 2C — offline COD cart, address and checkout rehearsal

Date: 20 November 2026. GitHub-only, $0 spend. Separate from M2B PR #87 (still unmerged at branch creation). This PR independently targets `main` commit `b34b7670` and requires **no M2B files**.

## Delivered

- `src/lib/store/simulation/checkout-session.ts` — isolated, deterministic in-memory session around the existing M1 `createOfflineCommerceSandbox`. Supports cart add/change/remove with checked variant stock, zero-quantity removal, up to 20 cart lines, market-local exact-minor-unit quotes, one canonical country-specific **synthetic** address, explicit review, acknowledgement and `SIM-` order receipt. Order replay is idempotent; editing is locked after the simulated receipt. Quote is recalculated before mutations, and changing the cart invalidates review.
- `src/lib/store/simulation/OfflineCodCheckoutDemo.tsx` — unmounted Arabic RTL responsive demo screens for cart, synthetic address, review/acknowledgement and simulation receipt. Market switch clears all old-market state. No live/customer checkout route and no human-address entry. The banner and each amount explicitly label every figure as fictional. Egypt's 60 EGP test shipping number **must never be displayed on any public route**.
- `src/test/m2c-offline-checkout.test.tsx` — five-market market/currency checks, cross-market SKU/address rejects, unknown/zero-stock, invalid quantities, atomic updates, explicit simulation capability, review/acknowledgement, canonical address stripping of injected personal information, detached snapshots, idempotency/replay, no-network checks and UI flow.
- `scripts/check-simulation-boundary.mjs` — CI now blocks direct static and dynamic module specifiers containing *any* simulation module from public/production source, not just five original modules.

## Security and acceptance

1. Only `SIMULATION_ONLY` can update checkout, set the address, review or generate a `SIM-` receipt. No authenticated payment, provider receipt, real order dispatch, courier status or real-customer record is generated.
2. `validateSyntheticAddress` canonicalizes to fixed dummy data. Even when given extraneous or human-looking properties, it returns the fixed template; no personal address is stored. UI has no free-form address, name, email or phone fields.
3. Reuses the existing sandbox to reject unsellable test variants, enforce per-market currency, safely compute all values in minor units (OMR/IQD three decimals) and reject double-place attempts.
4. UI **does not import** approved public catalog or legacy fictional `catalog.ts`. No simulation module is mounted from a storefront route, server endpoint or admin route; that owner-only, environment-gated demo mounting belongs to M2D.
5. No changes to catalog release flags, Supabase/Cloudflare, infrastructure, credentials, Taager, WooCommerce, Shopify, Anthropic, payments, live checkout, supplier adapters, customer messaging, hosting or deployments.
6. Simulated state is browser-memory-only and disappears on refresh. It is neither a durable cart nor a production checkout implementation.

## Known gaps (deliberate)

- Address validation for real customers, consent/legal disclosures, courier zones and verifiable country COD/shipping costs are **not built**. Sample country fields do not establish the final real-country address contract.
- The session uses a fixed synthetic idempotency key within each newly-created in-memory sandbox. It is not a model for persistent idempotency across sessions.
- No real supplier inventory, stock TTL, real tax/VAT or checkout payment rails are enabled. Catalog and supplier controls remain OFF.
- Approval-gated owner preview and manual viewport/keyboard tests are scheduled for M2D. This PR provides *tests* of the isolated component, not an owner-accessible public preview.

## Checks

Run `bun run test`, `bun run build` and `node scripts/check-simulation-boundary.mjs` in GitHub CI. The existing responsive storefront QA workflow should also stay green. Do not merge until those checks are verified and this milestone is reviewed.
