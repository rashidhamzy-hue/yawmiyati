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

## Update 29 Nov 2026: free delivery as a complete system (`20261129090000_brain_commerce_v2.sql`)
**Status:** DATABASE-TESTED (`docs/brain-commerce-v2-test.sql`); source CI-PASSED.
- **Cart threshold over eligible products.** The rule stores a threshold and a minimum margin (`meta.min_margin_bps`). A product counts toward the
  threshold only while its own margin at Taager's current cost is at least that minimum, so the thinnest possible eligible basket still pays the
  delivery fee (Egypt: the dearest band, 105 EGP) and keeps about US$1. Thin products are left out and listed for the owner
  (`brain_free_delivery_report`) instead of pushing the threshold out of reach. Quantity offers, sale prices and sets carry their own eligibility flag.
- **Delivery included** (`kind = 'delivery_included'`): a single product whose price carries the fee; an order containing one ships free. It must keep
  about US$1 after the fee and loses its approval when the product's price changes.
- **Self-checking:** `store_offer_state` re-checks every read: `loss_on_thinnest_basket`, `no_eligible_products`, `not_started`, `ended`,
  `loss_after_delivery`, `price_changed`. Start and end dates on every rule.
- **Proposals** (`freeDeliveryPlan`, `deliveryIncludedProposals`): the brain leaves out the thinnest 0–40% of products, whichever gives a reachable
  threshold (at most 3 typical products, at least 1.5 typical products so it lifts order value).
- **Public contract:** `public_store_offers.free_delivery = {threshold_minor, ends_at}`, `delivery_included = [listing ids]`; `public_catalog` rows and
  `public_product_page` carry `free_delivery`, `delivery_included`, `sale_price_minor`/`sale`, `is_new`, `trending`.
