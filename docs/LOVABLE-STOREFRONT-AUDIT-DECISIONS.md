# Lovable storefront audit: verified decisions and next implementation priorities
2026-11-20. Audit source: Lovable project `6bc552b8-1629-4a0b-8706-8bc21c5c1279`, user-provided audit text and connected chat message. Some reported timings and exhaustive click coverage were asserted by Lovable; they have **not** been independently reproduced by the current GitHub automation.

## Acted on now
- PR65: Fix `تصفّحي اختياراتنا` CTA by scrolling to visible categories, make header search and hero action open an in-page discovery overlay; add mobile navigation, position chat clear of bar and purchase area.
- PR66: Trap modal keyboard focus, restore focus on close, prevent cross-market cached results, handle missing catalog connection, test bottom search and CTA.
- This PR: Premium RTL Arabic 404/error screens; noindex staging by default. Production indexability requires explicit `VITE_YAWMIYATI_PUBLIC_INDEXING_ENABLED=true` **only after verified domain ownership, country canonical/hreflang, actual catalog/legal/privacy readiness**. Do not enable on Lovable preview.
- PR61–64: Arabic synonym search, search across approved titles/descriptions, photo-rich help and information pages, five-market search URLs.

## Audit claims needing independent verification
- Lovable reported 1.19s DOM load and ~110KB gzip, but these cannot establish production LCP/INP/CLS or Riyadh/Jeddah latency. Run Lighthouse and WebPageTest against actual production hosting and mobile network.
- Lovable reported 91 tests and browser clicks. This covers tested routes, not real checkout, supplier or Auth sessions. CI and SQL smoke tests still do not replace real deploy acceptance.
- SEO/AIO: WebSite site-name metadata and product structured data can help search engines understand factual content. Do not invent merchant identities, product offers or testimonials. Google removed sitelinks Search Box (November 2024); do not justify `SearchAction` as a path to that visual feature. FAQ rich-result eligibility is limited/non-general; do not promise FAQ snippets. Sources:
  - https://developers.google.com/search/blog/2024/10/sitelinks-search-box
  - https://developers.google.com/search/blog/2023/08/howto-faq-changes
- Saudi e-commerce trust: official Ministry evaluation calls out store registration, required licensing and tax identifiers, policies, complaint handling, contact methods and secure site. Show **only real verified identifiers** and approved policy/legal details, not fabricated badges. Source: https://mc.gov.sa/en/mediacenter/News/Pages/18-08-25-01.aspx

## Immediate P0 still unresolved
1. Owner-approved source of actual products (Taager contracts and/or independent supplier sources for all five markets); verified cost, variants, media rights, stock and reliable updates.
2. Proper catalog category membership and filters: current category screens are editorial; product/category joins are missing.
3. Genuine semantic search requires indexable approved attributes, descriptions, spelling lexicon, evaluation against representative Saudi queries, and possibly embeddings with explicit cost approval. Current search is lexical/synonym and server-approved-description search.
4. End-to-end cart, COD, payment, shipping, returns, supplier acceptance and courier reconciliation: none currently operational. Do not claim COD or payment badges.
5. Live Anthropic shopper: API budget/abuse, prompt grounding, security and verified product source need launch approval; local assistant is not paid model.
6. Production domains, hosting, image CDN/export, SEO country canonical/hreflang, Search Console, event/analytics consent and technical monitoring.
7. Staff/owner operations acceptance, synthetic end-to-end order testing, cross-market isolation and real browser mobile QA.
8. Final legally vetted Saudi policies and exact identity, merchant registration/contact and accurate verified payment/shipping contracts.

## P1 experience investments when data and operations exist
- Product discovery and merchandising: fast typeahead, filters, sort, genuine photo galleries, variants, reviews from real buyers, favorites with consent, cart preview, guided recommendations and transparent personalization.
- Support: real verified WhatsApp/contact channel (only after owner chooses official contact), customer returns/order tracking, handoff from AI to human.
- AI/marketing: source-proven research, audited Arabic content drafts, paid model/campaign budget controls, human approval, conversions and consented analytics.
- Saudi accessibility: full browser 320/390/768/1440px keyboard/VoiceOver regression, monitor text contrast on image overlays, network slowdowns and Core Web Vitals.

## Do not implement simply because audit suggested it
- Fake Mada/Visa/Tabby/Tamara badges, fake Saudi e-commerce verification, non-existent VAT/CR number.
- Claim free COD, fast Riyadh/Jeddah delivery or 14-day returns without a real policy and operational evidence.
- Make product availability, urgency, ratings or sales volume claims from demo/test data.
- Expose service-role, supplier or Anthropic secrets in client bundle.
