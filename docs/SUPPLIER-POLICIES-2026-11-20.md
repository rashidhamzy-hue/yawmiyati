# Yawmiyati — supplier policy evidence & review ledger (20 Nov 2026)
Internal operations document. **Do not surface provider name or internal payout mechanics in the customer storefront.**
Source: owner-supplied quotations/screenshots of country-specific Taager policies, 20 Nov 2026. **Not independently revalidated** against current provider contracts. Staging suppliers remain disconnected and checkout disabled.

## Saudi Arabia (first storefront to perfect)
- Quoted nationwide forward-shipping fee **SAR 28**, all regions.
- Quoted delivery ETA **2–3 days** for Riyadh, Jeddah, Dammam; **4–5 days** for other areas. Do not promise an exact delivery date; countdown begins after confirmation and provider acceptance, subject to serviceability.
- Quoted supplier return period **7 days**. Supplier says refund to bank account. Consumer legal remedies may differ; must have reviewed seller policy and customer-support/contact details before publication.
- Provider says confirmation calls 09:00–17:00 and same-day processing for some orders before 15:00; other section says **17:00 Egypt time**. Conflicting time-zone/cutoff rules: **do not advertise call hours or cutoffs** until clarified.
- Quoted 15% tax deduction on **additional merchant profit** (not tax on customer order, not blanket product price VAT). Finance-only, needs tax review.
- Screenshot: live chat service inquiries stock/product two working hours, delayed orders and designs 24 working hours, bestsellers 6 hours; Sunday–Thursday 10–19 and Saturday–Thursday 10–19 headings mixed; **support staff hours are not customer service SLAs**. Screenshot is internal only.

## UAE
- Quoted flat shipping **AED 19** nationwide, delivery **24–48 hours**. Treat ETA as supplier guidance; confirm start point, weekends/cutoffs and courier serviceability.
- Supplier return **7 days**, bank refund.
- Provider confirmation copy includes Egypt-based clock references; **not approved to publish**.
- COD-only is Yawmiyati's intended sales configuration, not evidence of enabled checkout.

## Oman
- Quoted shipping **OMR 3** nationwide.
- Supplier return/exchange **15 days only for defect or not-as-described**, cash refund through courier for COD once returned product received and inspected.
- No clearly established Oman delivery SLA in the supplied material. Do not invent one.
- Merchant payout instructions reference Egyptian mobile wallets and minimum **EGP 3000**; appears copied from another market, needs provider clarification and must not be published.

## Egypt
- Delivery estimates after confirmation: Cairo/Giza/Alexandria **2 working days**, Lower Egypt/Qalyubia **3 working days**, Upper Egypt/Sinai/Matrouh/Red Sea **2–5 working days**.
- Supplied shipping-rate table is broken: `info.eg.shippingPriceTable.title`. **Egypt customer shipping amount UNKNOWN** until current governorate rate table is supplied.
- Seller return fee quoted **EGP 5** for shipped-not-delivered and EGP 5 for delivered-then-returned; do not assume this is the customer's return fee.
- Supplier after-sales uses an external form; customer-facing Yawmiyati should provide its own approved support route once live.
- Supplier says personal-care items cannot be returned/exchanged. Requires category- and law-specific legal review, no blanket public no-return claim.
- Refund on return described as 72 hours after warehouse inspection; method and exact customer rights need review.
- Conflicting 11:00–21:00 and 09:00–17:00 Egypt confirmation schedule in different policy copies; don't advertise until verified.

## Iraq
- Quoted flat shipping **IQD 7,000** nationwide.
- Supplier states **3-day return** with cash handback through courier; separate general tips claim **14 days for defective goods**. Do not combine into a 14-day general guarantee: material contradiction requires written clarification and local legal review.
- No verifiable nationwide delivery ETA given.
- Payout section mentions Vodafone/Etisalat/Orange/WE and **EGP 3000** threshold (Egyptian details), not Iraqi payout instructions; do not publish.
- Provider says customer must answer confirmation call; exact confirmation hours/cutoff inconsistent with another Egypt-time section.

## Shared provider process (internal, not a guaranteed customer SLA)
1. Order recorded → supplier may call customer to confirm customer details and item.
2. Unanswered calls: multiple retry attempts, potentially up to seven over three days before hold.
3. Confirmed → awaiting courier pickup → out for delivery → delivered; delivery may pause for unresponsive customer, bad address or rescheduling.
4. Refusal/cancellation → supplier marks refused; no merchant profit credited.
5. Delivered profit may first appear provisionally after **6–12 hours**, eligible payout around **24 hours** after delivery, subject to country-specific settlement and supplier terms.
6. Customer should see accurate final price **including shipping** before submission, clear call expectation, no fabricated guaranteed times, and no claim that internal provider acceptance equals customer confirmation.

## Customer-facing publication rules
- Site uses **Yawmiyati** only. No supplier name or referral links on customer storefront.
- Present COD as the **only planned payment method**. Never show card, installment, Apple Pay or Mada logos unless a real provider is later integrated and approved.
- Until checkout is enabled, write `الدفع عند الاستلام عند تفعيل الطلبات` / an equivalent conditional phrase: no false statement that purchases can now be placed.
- Separate **supplier policy evidence** from **seller's legally reviewed promises**; supplier periods do not waive statutory rights or substitute for verified actual seller identity.
- For Saudi first, display SAR 28/2–3/4–5/7 day figures **as supplied provider guidance explicitly subject to validation before orders reopen**, not unconditional commitments.
- Egypt shipping fee, all supplier APIs, supplier costs, stock accuracy, customer support contacts and legal terms are blocking gaps.
- Save exact policy version/source capture, country, last-checked time, owner signoff and policy revision before activation. Do not auto-publish provider changes.

## Implementation sequence
1. Saudi storefront: conditional COD, guided shipping cost/estimates and returns page, headline/FAQ hooks, test.
2. Approved design system for market-local variation (not five cloned landing pages). Separate typography/content accents, tone, hero, category ordering, customer FAQ, trust copy and zone disclosures per country.
3. Validate country terms, delivery zones, rate quotes and return exceptions against current accounts before enabling per-country published policy or checkout.
4. Create live supplier connection only with approved API/workflow evidence, then operator-reviewed catalog, pricing, and order acceptance.
