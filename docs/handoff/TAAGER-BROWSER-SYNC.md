# Taager → Yawmiyati: how products and their data get in (27 Nov 2026)

Status: **owner-tested tools + verified data map.** Add-all and the recorder were run by the owner on the live
Taager merchant site (Saudi). The full-sync button (`tools/taager/sync.js`) is tested against mocked responses
only until its first real run. Nothing here places orders or contacts Taager.

## 1. What does NOT work (do not retry)
| Route | Result | Evidence |
|---|---|---|
| Taager API / bulk import | None public. Old WordPress plugin `taager` closed 28 Aug 2024 (security); current `taager-addon` only creates shipping zones. Linked-store modal: products are added one by one via the store icon. | wordpress.org pages, owner screenshot |
| Claude cloud browser login | Taager answers every login (Google, email+password, ~8 hours apart) with "try again after one hour". Datacenter sign-ins are refused. | 26–27 Nov, 4 attempts |
| Google sign-in in a remote browser | Owner's Google account offers passkey only → impossible off his own device. | 26 Nov |
| Claude in Chrome / Claude desktop built-in browser | taager.com is in Claude's default blocked categories (financial). The same site list governs both. Users cannot unblock it. | "This site is blocked by your site permissions"; support.claude.com troubleshooting + admin docs |
| Claude desktop app on the owner's Mac | Needs macOS 13+; the Mac is a 2017 MacBook Pro on Monterey 12.1 (max Ventura); owner declined to update. | 27 Nov |
| Hidden Taager session token on a server | Rejected: Taager blocks server logins and it risks the owner's only supplier account. | decision 27 Nov |

## 2. What works: owner-run buttons in his own Chrome
Bookmarklets the owner clicks while signed in to taager.com in his own Chrome (his IP, his session, normal pace).
Sources in `tools/taager/`; `node tools/taager/build-bookmarklets.mjs` prints the one-line versions.

| Tool | What it does | Proven |
|---|---|---|
| `add-all.js` (v2) | On any Taager listing page: for each card opens the store icon box, clicks **WooCommerce ⊕** when enabled, skips greyed-out (already added) and risky titles (regex), 1.2–2.6 s between adds, Stop button, auto-scroll. Typing **0** = record card facts only. Records card text per product (price, crossed price, piece offers, stock range) to localStorage → "Download facts". | 5/5 then 100/100 ×3 added on 27 Nov; store went 94 → ~400 products |
| `recorder.js` (v2) | Records the Taager web app's own merchant-API responses (+ header *names*, auth scheme and length only — never the token) for mapping. Skips auth/wallet/payout/payment URLs, blanks emails/phones. | 2 recordings 27 Nov |
| `sync.js` (v3) | Full catalogue read: picks up the app's own request headers in memory (never saved), then pages `GET /api/products/variants` and for each product `GET /merchant-info` (Arabic) + `/alternatives`, 0.4–0.8 s pacing, downloads one JSON. Prompt: number of products (0 = all). | mocked test only |

Card DOM facts (for add-all): store icon `button#store-actions-button` (ids are not unique) opens a Radix popover
(`aria-controls`); inside it `button#add-to-store-stores.wooCommerce-btn` — **enabled = not added (⊕), `disabled` = already in store (✓)**.
Cards: `a[id^="product-<24hex>-image-link"]`, title `a[id$="-title-link"] p`, card root `div.flex.size-full`.

## 3. Taager merchant API (private, used by taager.com; observed 27 Nov, app version 2.265.0)
Base `https://merchant.api.taager.com`. Requests are XHR with headers `Authorization: Bearer <JWT ~1950 chars>`,
`country: SAU|ARE|OMN|EGY|IRQ`, `platform: web`, `version`, `ui-session-key`, `taagerId`, `Accept-Language: en|ar`;
`withCredentials=false` (token auth, not cookies).

| Call | Use |
|---|---|
| `GET /api/products/variants?pageSize=25&page=N&sortBy=introducedAt&sortOrder=descending&query=&categoryId=C` | Listing: productId, sku, name, `type` product/bundle, thumbnail, `financials` (price, profit, originalPrice, maxPrice, tieredPricing, pricingRange, discountType/discountedPrice), stockAvailability, createdAt |
| `GET /api/products/{productId}/merchant-info` | Full detail: variants[] with sku, description, specifications, howToUse, financials (incl. dated `discounts`), stock (`merchantInfo.remainingQuantity`, buckets), `analytics.confirmationRate/deliveryRate`, images[], videos[], attributes[], `bundleItems[{productId,sku,quantity}]`, weight |
| `GET /api/products/{productId}/merchant-info/alternatives` | Taager's own "EXACT" alternatives (same item, other SKU) with their financials → duplicate detection |
| `POST /admin/orders/product-prices` body `{country, taagerId, products:[{productId:SKU, quantity, desiredPrice}]}` | Taager's own price validation: priceWithoutProfit, finalProfit, vat, netProfitPerItem, validity |
| `POST /api/products/{SKU}/pricing-calculator` body `{productId, price, netDeliveryRate}` | Taager's break-even CPA for a price and delivery rate |
| `GET /api/stores` | Linked stores: `{storeId:"defeatedwindow.s3-tastewp.com", provider:"WOOCOMMERCE", market:"SAU"}` |

### Field meanings, verified on SKU `SA051001NELY299` (4-in-1 garden set, product 22241)
- `originalPrice` 305 = Taager's regular cost to us (`priceWithoutProfit`).
- `profit` 75 = Taager's **minimum** profit; `price` 380 = default selling price = cost + min profit.
- `discounts[{type:"sale", price:365, profit:75, startsAt, expiresAt}]` = temporary sale: during it the min selling
  price is 365 and the cost 290 (page shows 290 with 305 crossed). Sales expire → never treat as permanent (M11).
- `tieredPricing[{quantity:2, price:631, profit:85}]` = Taager's quantity offer: min price and min profit for 2 pieces in one order.
- `maxPrice` / `pricingRange` = Taager's **maximum** allowed selling price (exists on many products; must be respected).
- Saudi VAT: `vat = 15% × (selling price − min selling price)`. At 380: 15 × 0.15 = 2.25 → net 87.75 (profit 90 = 380 − 290). Confirms brain rule.
- `analytics` confirmation 0.909 / delivery 0.583 (0 = no data yet) → expected profit per order.
- Other discount types: `second_placement`, `second_confirmation` (call-centre second-item upsell; e.g. price 22 profit 3).
- Bundles (`type:"bundle"`) carry `bundleItems` — component SKUs and quantities **declared by Taager** (M11-safe). Example
  21900 = 4 items; 21416 = 2 × SA050401UHV899. Many bundle names/descriptions are "." in English → read with `Accept-Language: ar`.
- Images/videos: `https://media.taager.com/<uuid>.<ext>`; sizes via `/360x360/`, `/100x100/` path prefixes.

### WooCommerce side (what the Taager store icon creates)
Simple product, Arabic name + description, **all images copied to the Woo site**, SKU = Taager SKU, category, in stock.
No cost, no tiers, no Taager id in public data. Woo price (garden set 408 SAR) matches none of Taager's numbers → the brain
ignores Woo prices and uses Taager financials. Matching key Woo ↔ Taager: **SKU**.

## 4. Operating model (per country store)
1. Owner opens Taager in his Chrome (country selected) → **Taager sync** → 0 → Download → attach / import (Claude loads it into `supplier_offers` + brain tables).
2. Brain studies the whole catalogue (cost, min/max price, tiers, sale dates, rates, stock, alternatives, bundles, media, text) → picks.
3. Owner runs **Taager add all** on the picks (next step: an "add these SKUs" mode) so only chosen products enter WooCommerce, where orders route to Taager.
4. Weekly: sync again (prices, sales, stock change) + New Arrivals.

## 5. Only a real test order can prove (G1)
What Taager actually charges/credits for a 2–3 piece order placed through WooCommerce; final delivered profit; refusal handling.

## 6. Related blocker (27 Nov)
Supabase org "Yawmiyati" (free) is **restricted**: egress 6.55/5 GB, log ingestion 6.04/1 GB → every API request returns
402 (owner sign-in, brain). Current traffic is tiny (~3k small requests/day), so the overage predates this week.
Billing period resets on the 29th (lifts automatically, short delay possible). The owner's free-project limit (2) is reached,
so a second free project is not possible; second accounts would breach Supabase fair use. Direct SQL (MCP) still works.
Pro ($25/mo) becomes mandatory before real orders.
