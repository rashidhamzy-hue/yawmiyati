# M4I — Egypt shipping-rate screenshot acceptance

**Date:** 21 November 2026. **Evidence:** owner-uploaded Egyptian delivery-rate infographic (provided in Yawmiyati ChatGPT project conversation). The graphic shows **EGP 95, EGP 100 and EGP 105** by named destination, and a separate **EGP 5 merchant deduction on customer refusal at delivery**. No new provider calls or current shipping-rate authentication were performed.

## Exact transcribed screenshot — destination labels, not exhaustive governorate coverage

| Screenshot price | Destinations as written |
|---|---|
| **95 EGP** | القاهرة، الجيزة، الإسكندرية |
| **100 EGP** | بورسعيد، كفر الشيخ، المحلة، العاشر من رمضان، طنطا، بني سويف، دمياط، البحيرة، الدقهلية، الشرقية، الغربية، القليوبية، الإسماعيلية، السويس، المنوفية |
| **105 EGP** | المنيا، وادي النطرون، مطروح، الأقصر، الساحل الشمالي، البحر الأحمر، سوهاج، أسيوط، الفيوم، العين السخنة، أسوان، قنا |

The image includes cities/areas **and** governorates; never label the entire list as confirmed governorate coverage or silently infer nearby destinations. The source contains **30 names**, all covered by exact `lookupEgyptScreenshotShipping` matches in `src/lib/store/egypt-shipping-evidence.ts`. Unknown, variant spelling or unlisted locations return null/unknown.

## Separate merchant accounting line

The bottom of the supplied screenshot states that **EGP 5 is deducted in a customer refusal case at cash-on-delivery**. Store it as `refusalDeductionMerchantEgp: "5"` and `refusalDeductionIsCustomerCharge: false`. It must not be added to the buyer's shipping fee, invoice, checkout or consumer returns policy. Whether/when it enters COD profitability models needs a future authorized, verified commercial review.

## Customer storefront scope

- Egypt homepage: a short **EGP 95 / 100 / 105 estimated** teaser linked to `/eg/info/shipping-returns`.
- Egypt information page: exact destinations in each band, local Egyptian Arabic and explicit confirmation-before-orders wording.
- No upstream provider identity, previous supplier history or internal EGP 5 deduction displayed to shoppers.
- Keep M4H COD, nontransactional/noindex, legal and approval gates unchanged.
- All four other countries remain as previously documented and require re-confirmation later.

## Known remaining gaps

1. Current rate version, effective date, delivery serviceability and provider-contract validation.
2. Unlisted destination coverage, aliases, city/governorate normalization, remote-area surcharges and whether pickup/return charges differ.
3. Confirmation that the screenshot deduction is actually assessed against the merchant and its current applicability.
4. Delivery-day estimates remain separate, unverified prior notes. Do not assume an ETA for every named screenshot destination.
5. Legal Yawmiyati seller policy, actual checkout rate rules and authorized payment/order routing.

**Status:** source and synthetic CI tested; **not live pricing**, not connected, no supplier requests, no database/storage changes, no real orders.

## Tests

`src/test/m4i-egypt-shipping.test.ts` verifies exact bands and 30 labels, unknown destinations, refusal deduction isolation, and shopper source text. M4D/region/FAQ/M4H tests are reconciled. Commerce CI and five-market/four-viewport browser QA must pass before merge.
