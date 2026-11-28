# Taager's own prices in the brain: quantity tiers, add-on, sales, call-centre upsell (29 Nov 2026)

**Status:** source CI-PASSED; migration `20261129090000_brain_commerce_v2.sql` DATABASE-TESTED (`docs/brain-commerce-v2-test.sql`, rollback-only).
Never commit a sync file or a supplier cost: this repository is public. Figures below are counts and ratios only.

## What the data says (Saudi sync, 27 Nov 2026, 4,161 variants; Iraq 749)
| Field | Meaning | Evidence |
|---|---|---|
| `financials.tieredPricing[{quantity, price, profit}]` | TOTAL minimum price for N pieces; Taager's cost for N = `price − profit`. | 2,700 of 2,722 tiered Saudi products cost less per piece from 2 pieces up (Iraq 202 of 203). Taager's product page shows it as "x% off two pieces". 22 products have a tier that costs MORE than singles: ignored as noise. |
| `discounts[type=sale]` | Temporary lower minimum price and cost. | 55 products; 41 carry `startsAt`/`expiresAt`, 14 have no dates, a few have no `profit` (unusable). |
| `discounts[type=second_placement]` | Minimum price and profit when the product is ANOTHER product in the same cart (the merchant places it). | 646 products; median price about a third of the regular minimum price. |
| `discounts[type=second_confirmation]` | Price Taager's call centre offers during the confirmation call. | 1,272 products (Iraq 100). See below. |
| `stockAvailability.stockBucket` | Stock in steps of 10 (`from_200_to_210`). | Present on 3,411 Saudi variants, absent in Iraq. |
| `analytics.confirmationRate` / `deliveryRate` | 0 = no data. | Confirmation rate on 508 Saudi and 50 Iraqi products. |
| `listing.createdAt` | When Taager introduced the product. | About 200 new Saudi products a month. |

## The rule: two figures, one switch
Whether Taager applies tier, add-on and sale prices to orders that arrive through WooCommerce is **unproven until G1**.
- Every quantity offer, set and sale offer reports **two profits per delivered order**: `profit_taager` (if Taager applies its price) and `profit_full` (full unit cost of every piece).
- `store_commerce_facts.taager_discounts_proven` (per market, default off, `/admin` → Bundles, discounts and offers → **Taager discounts proven**, every change logged): while off, the never-a-loss check uses `profit_full`. While on, it uses Taager's price and quantity offers may also pass half of Taager's saving on to the shopper.
- Switching it off again hides, on the next read, anything that only earns at Taager's price.
- **G1 must prove, per market:** (1) a 2-piece order is charged the tier cost; (2) a 2-product order charges the second product at its `second_placement` cost and which product Taager treats as "first"; (3) an order placed during a sale is charged the sale cost, also when the confirmation call happens after `expiresAt`; (4) how VAT (Saudi) is computed on several pieces; (5) whether several products ship as one parcel.

## Sales (`salePlan`, `saleProposals`)
Per product the brain either keeps our price and banks the extra margin, or proposes a time-limited offer:
- no end date from Taager, or under 2 days left after the safety gap → keep the price;
- already cheaper than other shops → keep; matched → pass on a third of the saving; dearer or no market evidence → half;
- the offer ends **3 days before** Taager's `expiresAt` (the confirmation call can take 3 days), is at least 5% under our price, and until the market is proven must earn at the REGULAR cost;
- the database hides the offer if Taager ends or shortens its sale (`supplier_sale_over`, `supplier_sale_ends_sooner`);
- a crossed-out price is returned only when the product was on the visible store at that price for at least a day before the owner approved the offer (`brain_listings.price_since`, `catalog_release_log`); otherwise the storefront says "offer until <date>". A countdown may only use `sale.ends_at`.

## Call-centre upsell (`second_confirmation`): researched, NOT built on
What the data shows:
- It exists on 1,272 Saudi products, far more than `second_placement` (646). 553 products have both; in 125 of those the two prices are identical.
- The merchant's `profit` is a small flat amount (3 SAR on 720 products, 5 SAR on 337; 500 IQD in Iraq), whatever the product is worth. On 40 Saudi products `price − profit` is ABOVE the regular cost: Taager keeps the rest of the margin.
- Median `second_confirmation` price is about 31% of the regular minimum price (53% in Iraq).
- `variant.upsellables[{sku}]` (104 products) names OTHER products as upsell candidates; 74 of the 140 targets are missing from the catalogue read.
Reading: Taager's agents offer the customer a second item (the same product, or one of the `upsellables`) at a deep discount during the confirmation call, and the merchant earns a small commission for it. It is Taager's lever, not ours: we do not set the price, the customer hears it from Taager, and it changes what the customer pays at the door.
Unknown (no public merchant documentation was found; Taager's help pages are behind the merchant login): whether it is on for every merchant or opt-in, whether it applies to WooCommerce orders, whether the second item is the same product or an `upsellable`, how it interacts with our own quantity offer in the same order, and whether the customer is told a different total than our order confirmation.
Decision: the brain stores the field (`taager_upsell_discounts`) and uses it for nothing. Ask Taager's account manager these five questions before or during G1 (owner approval needed to contact Taager), and watch the G1 confirmation calls for an upsell offer.

## Demand signals
- `taager_stock_history`: one reading per SKU when its stock bucket changes (trigger on `taager_catalog`), kept 90 days. `taager_stock_velocity(store)` = pieces a day leaving Taager's stock over 14 days (restocks ignored, needs readings a day apart). It is supplier-wide movement, not our sales.
- `demandFactor` (0.85–1.45) multiplies the shortlist and final scores: velocity up to +30%, confirmation rate ±10–15% around 60%, new arrival +5%. No data = 1.
- `public_catalog`: `rank` is lifted by velocity; `is_new` (introduced within 30 days) and `trending` (top fifth by velocity, at least 3 pieces a day) feed the "new" and "in demand" shelves.

## Brain-made themed bundles (`bundles.ts`)
Nine themes (hair care, skin care, makeup, coffee, kitchen prep, relax, closet, bathroom, mother and baby). A role is filled by the best-ranked published single product whose TITLE matches at a word start; 2–4 pieces; never a supplier bundle as a piece (M11). The deepest discount between about 16% and 5% that still earns at least the best piece's single profit and survives a second delivery fee. Cover: a layout of the pieces' own pictures. Owner approves each.

## Picture rule
One vision call per selected product (research model, 360 px thumbnails, classification only): `clean` / `text` / `promo`. Publish orders media clean first and drops promo artwork (`brain_publish_approved` wrapper); a product with promo pictures only keeps one and is flagged. Cost is recorded under ledger step `pictures`. NOT yet run against the live API.

## Shortlist dedup
`nearDuplicates`: Taager's own EXACT alternatives, the same first picture, or titles sharing at least 80% of their words at a cost within 20%. Only the strongest stays (reason `near_duplicate_of:<id>`). On the 27 Nov files this removed 411 Saudi and 68 Iraqi candidates before paid research.
