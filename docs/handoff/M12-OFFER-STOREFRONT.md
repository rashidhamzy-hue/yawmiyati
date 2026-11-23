# M12 — Approved offer versions in the normal storefront (isolated fixtures)

**Date:** 22 November 2026. **Status:** CI-PASSED source work (locally reproduced), fixture mode only. Not deployed. No Supabase schema change, no RPC, no orders, no tracking, no ad spend, TasteWP untouched.

## What changed

The normal country storefront (`MarketPreview`, product route, `/cart`, `/checkout`) now renders **approved offer versions**: pack selection, margin-qualified add-ons, delivery zone and the exact total at the door. The product-first homepage, top country navigation and shared `MarketPreview` hierarchy are unchanged.

| Piece | File |
|---|---|
| Public contract `yawmiyati.offer_version.v1`, strict parser, owner gate builder, approval digest, cart pricing | `src/lib/store/offer-version.ts` |
| Single offer source (fixture mode only today) | `src/lib/store/offer-source.ts` |
| Per-market browser cart (selections only, no customer data) | `src/lib/store/offer-cart.ts` |
| Product panel: zone, pack, add-on, door total, add to cart | `src/components/store/OfferProductPanel.tsx` |
| Cart and checkout review (submit disabled) | `src/components/store/OfferCartPage.tsx` |
| Fictional five-market fixtures | `src/fixtures/storefront-offers.ts` |
| Isolation guard (source + build output) | `scripts/check-offer-fixture-isolation.mjs` |
| Five-market browser journey | `scripts/offer-journey-qa.cjs` |
| Tests | `src/test/m12-offer-versions.test.ts`, `src/test/m12-offer-storefront.test.tsx` |

`StoreCommerceGuard` delegates to the offer cart only when offers are active **and** that market's cart has selections; otherwise it renders exactly as before. The header shows a cart icon only in the same condition.

## Owner gates (`buildOfferVersion`)

Per pack and per delivery zone: verified components, price ≥ floor, cost known, stock ≥ 1 and checked within 24 h, dated matched-pack local comparison within 30 days, door price ≤ comparable delivered price, expected contribution per submitted COD order ≥ target (80/15/5 retained/refused/returned split in the fixtures, losses rounded down). Packs with the same verified composition (supplier 2-pack vs quantity tier) compete for one slot; the higher expected contribution wins per zone. An add-on is offered in a zone only if both packs are eligible there, it costs the shopper more and it does not lower expected contribution. Publishing requires an approval whose `approved_inputs_digest` equals the FNV-1a digest of all inputs, so any change to cost, floor, stock, price, comparison, zone fee or outcome split withholds the product until re-approved. The public contract carries no cost, floor, stock count, comparison or supplier identity.

## Totals

Integer minor units with BigInt. Each cart line is a separate shipment with its own delivery charge because combined multi-line shipments are not verified (M11 §4). Lines whose approved revision changed, or that are not offered in the chosen zone, are excluded from the total and block checkout review. Egypt requires a zone choice.

## Fixture isolation

* Loaded only by a dynamic import inside `if (import.meta.env.VITE_YAWMIYATI_OFFER_FIXTURES === "true")`; without the flag the chunk is not emitted (verified by `--build .output` in Commerce checks).
* Rendered only on loopback/`.test` hosts; elsewhere the hook reports `off`.
* In fixture mode the storefront makes **zero** Supabase requests (asserted in the browser journey).
* Every screen shows a fixture notice. Values are fictional and deliberately not the historic supplier quotes or Egypt screenshot bands.

What each market demonstrates: SA two-pack + hook add-on; AE add-on withheld (kit lowers contribution); OM quantity tier replaces the costlier two-pack; IQ two-pack out of stock → tier, frother withheld (`approval_stale`); EG three zones, clip add-on only in zones 1–2.

## Run it

```sh
VITE_YAWMIYATI_OFFER_FIXTURES=true bun run dev --host 127.0.0.1 --port 4176
# open http://127.0.0.1:4176/sa  (or /ae /om /eg /iq)
QA_OFFER_BASE_URL=http://127.0.0.1:4176 node scripts/offer-journey-qa.cjs
```

## Still needed before real offers (not done, not authorized)

1. A release-gated public RPC returning `yawmiyati.offer_version.v1` per market (additive Supabase migration under the owner-approved exception; owner approval required). Then `offer-source.ts` gains a `catalog` branch that calls it and drops fixtures.
2. Owner approval UI writing revision + digest (M11D), backed by real supplier floors, costs, stock and dated comparisons.
3. Checkout submission, consent/attribution and order lifecycle remain OFF until explicit owner authorization (stage 6).
