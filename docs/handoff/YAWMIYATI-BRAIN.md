# Yawmiyati Brain — stage A (26 Nov 2026)

**Status:** CI-PASSED source + DATABASE-APPLIED schema (staging `skhtunkknshvolturqlm`). The edge function deploys from GitHub (`deploy-brain.yml`) once the repository secret `SUPABASE_ACCESS_TOKEN` exists. Not yet run against a real Taager store: needs the owner's TasteWP + Taager + keys setup below.

Owner decisions (26 Nov 2026, voice + chat): build the brain before the TasteWP test; free web search only (no paid data tools); research every retailer in each market, not only Amazon/Noon; the brain proposes and the owner approves (Approve all), autopilot later; no fixed $5 floor — margin decided per product, but never a loss; AI budget $10/day while testing ($16 credit available); first full test on the Saudi store with ~50 products; measure the API cost of everything.

## What it does (one run per store)

| Stage | What happens | AI? |
|---|---|---|
| ingest | Reads every WooCommerce product and every variation (100/page) from the store's Woo site (Taager plugin). Keeps the full raw JSON. | no |
| audit | **Capability report:** products, variations, types, stock, prices, images per product, videos (meta + description), SKUs and duplicate SKUs, duplicate families, bundle-like categories, title-claimed packs, linked products, every meta key with examples. Finds where Taager keeps **cost / minimum price / suggested price / pieces / bundle parts** (heuristic, then one cheap Haiku call to confirm). | 1 small call |
| prefilter | Deterministic: kill rules (tobacco/vape, weapons, sexual, medicine claims, counterfeit brands), flags (cosmetic claims, chemicals, electrical, children), excludes out of stock / no images / unknown cost / no margin, keeps the best offer per potential family, 35 % category cap, shortlist (default 80). | no |
| research | Claude Haiku 5.5 + web search (≤3 searches/product, country-located): same item at any retailer in that market, price in local currency, URL, exact vs similar, demand signals. Prices whose page was never in the session's search results are marked unverified (confidence ≤0.3). | yes |
| decide | Taager economics → best price point ≥ Taager minimum, maximising expected profit × competitiveness; blocks anything without cost+minimum or with no profitable price; thin margin (<≈$2) or no competitor evidence → "needs your look". Score → pick 50 with family + category diversity. Free-delivery threshold proposal. | no |
| content | Claude Sonnet 5.5 writes the Arabic page per selected product: title, subtitle, description, bullets, specs (source facts only), SEO title/meta/keywords/slug, FAQ, image alt text, category, tags, upsell angle; validator flags supplier names, prices in text, banned claims. | yes |
| merchandise | Homepage hero, 8 featured (≤2 per category), category order, 3 cross-sells per product. Run cost summary + projections. | no |
| review | Owner sees everything on `/admin` → **Yawmiyati Brain** and approves all or per product. | — |

## Pricing and audience (owner decisions, 27 Nov 2026)
- **Taager's minimum and maximum selling prices are references, not limits.** `decidePrice` searches from just above Taager's cost up to 25% above the market reference and picks the price with the best expected profit × competitiveness. Hard rule: never a loss (profit after Saudi VAT and expected-per-order both > 0). Without market evidence it uses Taager's default selling price as the anchor; when Taager's minimum profit is 0 and no shop is found it returns `needs_market_research`. Decisions record `taager_position` (`below_minimum` / `within` / `above_maximum`) with a note: **whether Taager accepts orders outside its range is unproven until G1** — include one below-minimum test order in G1.
- **Women-only audience** (`audienceCheck` in `selection.ts`, title only): men's products, car accessories, power tools/welding, gaming, fishing/hunting and off-brand gear (surveillance kits, computers, construction, farm, power stations) are excluded with reason `not_for_audience:<kind>`; products outside the six lifestyle departments rank at half weight. Unisex items, "for home and car" items and children's items stay (mothers buy them). On the 27 Nov sync this removes 388 Saudi and 85 Iraqi products.
- Kill rules narrowed after the 27 Nov Saudi sync (false positives: "micro fiber" as vape, "unisex" as sexual, soil activator, heat/sterilising guns, insect zappers, phone cases, pill organisers).

## Mother & kids grouping (28 Nov 2026)
`STORE_CATEGORIES` now starts with `kids` (baby, newborn, nursing, mothers, children's items). It ranks at full weight like the six lifestyle departments and the writer may assign it. The storefront still has six sections (`STOREFRONT_SECTIONS`; the publish step stores any other category as null), so published kids items appear in all products and search. **To open the section:** add a photo `cat-kids`, then add `kids` to `PUBLIC_CATEGORY_SLUGS`, `EDITORIAL_CATEGORIES`, the market tiles/captions, the search overlay and the publish whitelist + `brain_listings.category` check (one PR).

## Planning delivery rate (28 Nov 2026)
Order of precedence: the owner's `brain_settings.delivery_rate_bps` → Taager's market median from the run's catalogue (`run.summary.prefilter.taager_success_median_bps`, confirmed × delivered over products with data, needs ≥ 20 products) → `MARKETS[m].defaultDeliveryRateBps`. A product with its own Taager figures is blended 50/50 with that base (Taager gives no order counts). 27 Nov sync: Saudi 32%, Iraq 33% of placed orders delivered (cautious reading; G1 and the first real weeks of orders replace it).

## Money model (Taager published policy)
Customer pays product price + Taager delivery fee (SA 28 SAR, AE 19 AED, OM 3 OMR, EG 95–105 EGP, IQ 7,000 IQD). Delivered profit = price − Taager cost; Saudi: 15 % of profit added above Taager's minimum is deducted (VAT; none below the minimum). Refused order: no profit; Egypt charges 5 EGP. Free delivery = we absorb the fee. Expected profit per submitted order uses a planning delivery rate (SA/AE 75 %, OM/IQ 70 %, EG 65 %) until real orders exist. All money is integer minor units. Code: `supabase/functions/_shared/brain/economics.ts`.

## Cost tracking
Every paid call → `brain_cost_ledger` (tokens, web searches, exact micro-USD at published prices: Haiku 5.5 $0.10/$0.50 per MTok (≤100k prompt), Sonnet 5.5 $2/$10, web search $10/1,000). Daily cap per store in `brain_settings.daily_budget_microusd` (default $10); a run **pauses** before any call that could exceed it. The run summary reports total, per researched product, per written page, and projections (whole catalogue, one store cycle, five stores, daily autopilot).

## Files
- Core (Deno + vitest): `supabase/functions/_shared/brain/` — `markets.ts`, `woo-normalize.ts`, `catalog-analysis.ts`, `economics.ts`, `selection.ts`, `anthropic.ts`, `prompts.ts`, `db.ts`, `runner.ts`
- Endpoint: `supabase/functions/yawmiyati-brain/index.ts` (verify_jwt; owner membership via `brain_is_member`; actions `test_woo`, `test_ai`, `start`, `step`, `resume`, `cancel`)
- Schema: `supabase/migrations/20261126170000_yawmiyati_brain_a.sql` (applied to staging)
- Dashboard: `src/components/owner/BrainPanel.tsx`, `src/lib/store/brain-client.ts` (screenshots `docs/qa/brain-panel-*.png`)
- Attribution: `src/lib/analytics/attribution.ts` (UTM + fbclid/gclid/ttclid/ScCid, first/last touch, Meta `_fbc`, on every analytics event)
- Tests: `src/test/brain-core.test.ts`, `brain-runner.test.ts` (full run on a fake Taager store + fake Claude, budget pause), `brain-panel.test.tsx`, `attribution.test.ts`
- Deploy: `.github/workflows/deploy-brain.yml`

## Secrets (Supabase → Edge Functions → Secrets; never in the browser or repo)
`ANTHROPIC_API_KEY`, and per market `WOO_SA_URL` (https origin of the Woo site), `WOO_SA_KEY` (ck_…), `WOO_SA_SECRET` (cs_…) — same pattern `WOO_AE_*`, `WOO_OM_*`, `WOO_EG_*`, `WOO_IQ_*`. GitHub repository secret `SUPABASE_ACCESS_TOKEN` for deployment.

## Publish approved picks to the storefront (27 Nov 2026)
**Status:** CI-PASSED source; migration `20261127130000_brain_publish.sql` tested on a local Postgres 16 with every repo migration applied (`docs/brain-publish-test.sql`, rollback-only). **Not yet applied to staging** and not browser-tested with real data.

- `/admin` → Yawmiyati Brain → **On the store**: *Publish approved products* calls `brain_publish_approved(store, run)`. Each approved pick becomes (or refreshes) a `country_listings` + `listing_variants` row plus a `brain_listings` row holding the customer-safe page (title, subtitle, description, bullets, specs, FAQ, SEO title/description), the brain's price, the category and up to 12 Taager picture ids. Picks are left out, with a reason shown to the owner, when they are missing from the Taager sync, unpriced, have page wording to fix, are priced at or below Taager's cost, or have no usable pictures. Taager's minimum and maximum selling prices are references only (owner decision, 27 Nov 2026).
- **Shown only while true, re-checked on every public read** (`brain_listing_state` → `current_catalog_release`): market release flag on; listing published; Taager sync newer than `brain_settings.stock_max_age_hours` (default 72); in stock by Taager's own signals; price still above Taager's cost. A quick sync that reports a product out of stock, or a Taager cost rise to or above our price, hides it without any owner action.
- **Release flag stays with the owner:** *Show store to visitors* / *Hide store from visitors* call `brain_set_release` (membership-checked, every change written to `catalog_release_log`). Checkout flags are untouched. *Take all products off* calls `brain_unpublish`.
- **Public RPCs:** `public_catalog` now also returns `approved_category_slugs`, `category_release`, `image` (picture id); new `public_product_page(store, slug)` returns the approved page for a visible brain listing, else null. Search and detail keep their shape.
- **Pictures:** the storefront Worker serves `/media/p/<uuid>.<ext>` (full) and `/media/p/360/<uuid>.<ext>` (cards) by fetching the same file from Taager's media host and caching it at Cloudflare for 30 days (`src/lib/store/product-media.ts`). Shoppers never see the supplier host; Supabase serves no picture bytes (no egress). Trade-off: a picture Taager deletes disappears after the cache expires. Copying published pictures to Cloudflare R2 is the follow-up once R2 is enabled on the account (free tier, needs the owner to turn it on).
- **Storefront:** cards show the first picture; the product page renders `ReleasedProductPage` (gallery, price, COD/delivery/returns lines from the shared customer copy, bullets, description, specs, FAQ). No order can be placed from it.

## Product page extras (28 Nov 2026)
**Status:** migration `20261128060000_brain_product_extras.sql` APPLIED to staging; `docs/brain-product-extras-test.sql` passed on staging (rolled back).
- **Quantity offers:** `quantityOffers()` in `economics.ts` builds "2 for X" (~10% off) and "3 for X" (~15% off) from our single price. Each must earn at least one single sale's profit while counting the FULL unit cost for every piece. (Taager's tier data is real and since 29 Nov is read too: `docs/handoff/TAAGER-DISCOUNTS.md`.) The publish step keeps only offers above quantity × cost and below quantity × price; `public_product_page` re-checks them against Taager's current cost on every read. **Checkout must support quantities before these can be ordered (G3).**
- **Videos:** up to 3 per product, supplier media host only, served from `/media/v/<uuid>.mp4` (range requests pass through; full responses edge-cached). YouTube and Google Drive links are skipped.
- **Bundle contents:** from Taager's declared `bundleItems` only, resolved by SKU to a catalogue name and picture (M11-safe); unresolved items are left out.
- **SEO:** the product route's server render now reads the approved page: SEO title/description, `og:*` tags and the first picture (as `https://yawmiyati.shop/media/p/<id>`) in Product JSON-LD.

## Brain commerce v2 (29 Nov 2026)
Read `docs/handoff/TAAGER-DISCOUNTS.md`: Taager's quantity / add-on / sale prices with two profit figures and the per-market "Taager discounts proven" switch, sale handling, the call-centre upsell write-up, demand signals, themed bundles, the picture rule and shortlist dedup. Free delivery: `docs/handoff/M13-ORDER-VALUE-OFFERS.md`.

## Not built yet (next)
1. Product videos, Taager quantity offers (tiers) and bundle contents on the product page; SEO head (title/description/image) from the approved page on the server render; R2 copies of published pictures.
2. **Autopilot scheduler** (daily: refresh stock/prices, add N products/store, retire weak ones) — toggle exists, disabled.
3. **Brain C learning** from real visits/orders (attribution is captured now; order outcomes come with Phase 6).
4. Native bundle composition beyond what Woo exposes (M11): bundles are labelled, never invented.
5. Field-mapping override UI (owner can set `brain_settings.field_mapping` with `confidence:"owner"` via SQL today).
