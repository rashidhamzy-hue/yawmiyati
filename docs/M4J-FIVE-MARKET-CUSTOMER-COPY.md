# Yawmiyati — Five-Country Customer Copy Standard and Audit (21 Nov 2026)

## What prompted this audit

The owner captured a Lovable editor screenshot of `/eg` showing customer-facing copy such as **"الشحن الإرشادي"** and asked for the same problem to be eliminated across all five storefronts, not just for Egypt. The screenshot's example phrase `بحسب عرض المورّد السابق` is **not acceptable in any customer-visible Yawmiyati text**. A technical quote's source belongs only in internal evidence files.

### Scope and what has actually been checked

**Source:** active React storefront, all five market policy modules, home and FAQ editorial modules, brand story, help/terms/privacy pages, product discovery and inactive cart/checkout/order guards, plus GitHub CI regression coverage. Includes 5 home pages, 20 country/topic information-page variants and 15 inactive transaction guards. This audit **does not imply deployed Lovable editor preview or published website has been refreshed**.

**Lovable read-only status before merging this PR:** project `6bc552b8-1629-4a0b-8706-8bc21c5c1279` (Souq Of Saudi) reported latest code commit `7891e318d7fb3cbab948d0829136939ccb25c944`. Its read-back `MarketPromiseStrip.tsx` still contained awkward `الشحن الإرشادي` titles, but not the previously removed `المورّد السابق` phrase. The owner's screenshot may show an older rendered preview; **GitHub source, Lovable editor source and already-published live builds must be checked separately.** Do not claim the screenshot changes immediately after a GitHub PR; do not force publish or spend credits.

## Editorial style rules

- Yawmiyati speaks **directly to the shopper**, never as a broker referring to any upstream provider or historical source. **Banned in customer copy:** `المورّد السابق`, `المورد`, `المورّد`, `Taager`, `عرض المورّد`, and any quote provenance.
- **Avoid bureaucratic and vague headings** such as `الشحن الإرشادي`, `مدد توصيل إرشادية`, `تقديرات سابقة غير مضمونة` and `الدفع عند الاستلام مخطط له`. Use **`رسوم التوصيل المتوقعة`** or in Egypt **`مصاريف الشحن المتوقعة`**; use **`موعد/مدة التوصيل المتوقعة`** and **`الدفع عند الاستلام عند بدء الطلبات`**.
- Use a clear indication that the **rate is not the final checkout rate**: `نؤكد المبلغ حسب العنوان قبل الطلب`; a single explanation per relevant section, not repetitive technical warnings in every sentence.
- Never imply successful checkout, ready-to-order products, guaranteed 24/48-hour delivery, legal refund periods, card payments or confirmed stock when checkout is still disabled.
- Use natural market Arabic: SA `رسوم التوصيل المتوقعة`; AE `رسوم التوصيل المتوقعة` with Gulf feminine address when fitting; OM `رسوم التوصيل المتوقعة`; EG `مصاريف الشحن المتوقعة`; IQ `أجرة التوصيل المتوقعة` with Iraqi vocabulary. Avoid erratic regional slang in legal/privacy policy copy.
- Respect exact supported information: SA 28 SAR and 2–3/4–5-day regional expectations, UAE 19 AED and 24–48-hour expectation, Oman 3 OMR with delivery time unknown, Egypt 95/100/105 EGP only for 30 exact screenshot destinations, Iraq 7,000 IQD with no verified ETA. **All remain conditional previews** and aren't active customer checkout charges.
- Internal EGP 5 merchant cost on refused COD deliveries, seller refund restrictions, payout instructions and historic provider info stay in internal sources only.

## Code and test acceptance

**Changed in M4J:** `src/components/store/MarketPromiseStrip.tsx`, `MarketPreview.tsx`, `StoreInfoPage.tsx`, `StoreCommerceGuard.tsx`; `src/lib/store/market-policy-pages.ts`, `saudi-commerce-content.ts`, `market-experience.ts`, `brand-story.ts`. Preserve the existing original visual identity, country accents, category order, responsive layout and real approved-only catalog boundary.

**Updated regression fixtures:** `scripts/check-storefront-truth.mjs` scans more source files and detects both internal supplier phrases and awkward advisory wording in shopper copy. `scripts/test-storefront-truth-guard.mjs` must show old source phrases are rejected. `src/test/m4j-five-country-copy.test.tsx` renders homepages, all policy/help/privacy/terms pages, and inactive checkout flows for the five markets.

**Before merge:** Commerce build/source guards/all tests and responsive GitHub browser checks must pass. Correct any failing test or source without weakening the noindex/no-checkout/no-spend policy. **Before stating Lovable is fixed:** independently read the Lovable project's post-merge code, confirm the synced SHA, refresh the editor preview and verify the exact `/eg`, `/ae`, `/sa`, `/om`, `/iq` UI. Publishing/deploying requires separate owner authorization.

## Remaining scope

This is a copy and source regression pass, not a professional native-speaker legal translation certification, real catalog/product content audit, verified supplier contract, accessibility review or live release. Dynamic future catalog and AI-generated product copy must pass separate input-time brand and claim review; static source guards cannot guarantee that third-party strings or cached builds are safe.
