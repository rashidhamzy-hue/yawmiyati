# M13 — Order-value offers with owner approval (28 Nov 2026)

**Status:** migration `20261128120000_store_offers.sql` APPLIED to staging; `docs/store-offers-test.sql` passed on staging (rolled back).
Source CI-PASSED. Not yet used with real published products (waits for the first real brain run).

## What exists
| Offer | Proposed by | Shown when |
|---|---|---|
| Quantity discount ("2 for X") | brain decision per product (`quantityOffers`) | owner approved that exact price **and** it still earns at Taager's current cost |
| Our own set (two published single products) | `bundleProposals` in `_shared/brain/offers.ts` | approved, both pieces on the store, cheaper than singles, profitable even as two parcels |
| Free delivery above a basket value | `freeDeliveryPlan` (sized on the LEAST profitable basket) | approved and the thinnest basket still pays for delivery |
| Taager's own bundles | are products | approved in the product list like any product; contents only from declared `bundleItems` (M11) |

- **Never a loss, checked in the database on every read** (`store_offer_state`): full Taager cost of every piece; for multi-piece prices
  VAT is taken on ALL the profit (how Taager computes VAT for several pieces in one order is unproven until G1); delivery fee counted
  wherever we pay it (`store_commerce_facts`).
- **Owner flow:** `/admin` → *Bundles, discounts and offers* → **Work out offers** (reads published products with costs through
  `brain_offer_inputs`, computes in the browser, saves with `brain_offers_save` as *proposed*) → **Approve** each or **Approve all safe**.
  Profit per delivered order is shown in US dollars. A changed price goes back to *proposed*.
- **Public contract:** `public_store_offers(store)` → `{free_delivery:{threshold_minor}|null, bundles:[{id,slug,title,price_minor,items}]}`;
  `public_catalog` rows gain `rank`, `kind`, `offer`; `public_product_page` gains `stock_signal` and returns approved quantity offers only.
- **Storefront:** `/<market>/offers` (landing), `/<market>/set/<slug>` (our sets), cart and order form (`ShopCartPage`), product page buy box.
  Everyone sees the same offers and prices. Order submission is OFF (G3).

## 27 Nov sync files, current rules (offline, no AI prices)
Saudi: 8 sets proposed; free delivery possible at about $173 (worst basket earns about $1.5, typical about $33). Iraq: no sets and no free
delivery: Taager's minimum profit (about $1.5) cannot pay a $5.3 delivery fee. Real numbers come from the first brain run.

## Not built
Order submission and server-side order pricing (G3); offers in the brain's edge function (proposals run in the owner's browser);
three-piece sets; per-section free-delivery rules.
