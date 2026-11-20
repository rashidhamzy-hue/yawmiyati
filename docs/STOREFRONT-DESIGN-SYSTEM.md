# Yawmiyati storefront design contract — 20 November 2026

This is the canonical **customer-facing design baseline**, authored before the GitHub and Supabase account transfers. The Saudi Lovable design was restored in PR47, substantially improved in PR51, and the focused Saudi search route fixed in PR52. The shared MarketPreview component drives **all five** country storefront previews.

## Design direction (preserve)
- **Positioning:** warm, contemporary Arabic lifestyle commerce for women, with product-led editorial storytelling rather than noisy discount or countdown advertising.
- **Visual identity:** soft ivory/warm-neutral canvas, deep muted teal accents, gold details, generous rounded corners, calm photography. The existing project's exact color tokens and typography in `src/styles.css` are authoritative.
- **Photography:** use the already-owned Lovable project hero and six category asset pointers, not third-party hotlinks. Current assets are project-managed `/__l5e/assets-v1/` references; production host must support/export them before migration.
- **Typography:** Tajawal Arabic first, clear hierarchy, generous line-height and legible mobile sizes. Layout direction RTL; numbers/prices must retain locale-specific formatting and 3-decimal Oman minor units.
- **Navigation:** sticky compact header, meaningful search link, mobile menu with actual destinations, keyboard focus, skip-link, responsive country choices in footer.
- **Homepage composition:** announcement strip; impactful photographic hero; three trust/process-value cards (no unverified shipping claims); six-image editorial taxonomy; large storytelling photography section; two photographic campaigns; verified product shelf with empty, loading and failure states; product-quality values; accessible FAQ; deep contrasting footer.
- **Content tone:** clear, human, elegant Arabic suited to Saudi shoppers. Do not translate English marketing clichés literally. Do not invent user reviews, rating stars, 'best selling' claims, discounts, stock, shipping speed, payment acceptance or certifications.

## Current truth vs future commerce
This preview is NOT live checkout. There are no approved products currently. The site must remain visually compelling when the catalog is empty and must explicitly say orders/payments are not available. Never swap the homepage for a generic maintenance shell, or substitute fictional product rows when the backend fails.

Once real products exist, populate cards from the approved public Supabase RPC only; image URLs must come from an approved durable image pipeline with alt text. Product detail pages should include image galleries, variants, key verified facts, ingredient/material specifications when proven, transparent shipping/payment/returns terms, and price evidence; they must not imply availability without verified stock.

## Design acceptance checklist
- Desktop QA: 1440px viewport, 1024px tablet, 768px, 390px and 320px phone, no horizontal scrolling or unintended clipped controls.
- Mobile QA: Arabic RTL text wrapping; one obvious primary CTA in hero; gallery readable; category cards balanced; large touch targets; footer and menu navigable with one thumb; keyboard-only navigation and visible focus; reduced motion; contrast for text over photography.
- State QA: backend not configured, loading, empty catalog, invalid product URL, API failure/retry, approved products, long Arabic name, long description, mixed Arabic/Latin SKUs and currency formatting.
- Interaction QA: hero discovery CTA scrolls to categories; product CTA to actual collection; search filters only approved real products; FAQ expands by keyboard; country links keep market isolation; mobile menu closes after selection; no cart/order button visible when checkout disabled.
- Accessibility: semantic landmarks/headings, descriptive image alts, skip link, menu expanded state, status messaging, labeled search, FAQ native disclosure. Real-world WCAG audit needed after browser deploy; automated unit tests are not a WCAG certification.
- Performance: preserve hero image priority, lazy-load below-the-fold photos, export/optimize assets before permanent hosting, avoid unnecessary animation and oversized fonts, verify real Core Web Vitals once hosted.
- SEO: current pages intentionally noindexed in prelaunch. Before production, configure country-specific domains/canonical URLs/hreflang, meta titles/descriptions, product structured data only for real verified listings, XML sitemap and robots policy. Do not index staging/dummy product pages.

## Across the five country storefronts
Saudi Arabia, UAE, Oman, Egypt and Iraq share the brand's visual system. Each market retains its own currency, verified catalog, supplier identity, COD/shipping/return policies, checkout gate and customer data boundary. Localized product terms and campaigns should be market-specific; do not overwrite Saudi copy from a generic automatic translation. No country may enter production just because the same React shell renders.

## Transfer and handoff boundary
This design is fully source-built and CI-tested, but not yet independently visually signed off via a fresh desktop/mobile browser screenshot. Before calling the website visually **finished**, inspect actual Lovable preview at both sizes and resolve any photo crop, hierarchy, overflow or text contrast issues. New hosting, supplier information, real catalog images and delivery policies are required for final commerce readiness. No purchases, AI credits or live release flags were activated for this design work.

Key sources: `src/components/store/MarketPreview.tsx`, `src/styles.css`, `src/lib/store/images.ts`, `src/routes/sa.*`, `docs/FIVE-STORE-HOSTING-BUILD.md`.
