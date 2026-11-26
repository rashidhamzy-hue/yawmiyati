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

## Money model (Taager published policy)
Customer pays product price + Taager delivery fee (SA 28 SAR, AE 19 AED, OM 3 OMR, EG 95–105 EGP, IQ 7,000 IQD). Delivered profit = price − Taager cost; Saudi: 15 % of profit added above Taager's minimum is deducted (VAT). Refused order: no profit; Egypt charges 5 EGP. Free delivery = we absorb the fee. Expected profit per submitted order uses a planning delivery rate (SA/AE 75 %, OM/IQ 70 %, EG 65 %) until real orders exist. All money is integer minor units. Code: `supabase/functions/_shared/brain/economics.ts`.

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

## Not built yet (next)
1. **Publish approved products to the storefront** (bridge approved rows → `catalog_products`/`country_listings` + editorial pages + media rehosting) — release flags stay off until launch.
2. **Autopilot scheduler** (daily: refresh stock/prices, add N products/store, retire weak ones) — toggle exists, disabled.
3. **Brain C learning** from real visits/orders (attribution is captured now; order outcomes come with Phase 6).
4. Native bundle composition beyond what Woo exposes (M11): bundles are labelled, never invented.
5. Field-mapping override UI (owner can set `brain_settings.field_mapping` with `confidence:"owner"` via SQL today).
