# Yawmiyati — build-to-launch execution gates (20 November 2026)

**Authority:** GitHub `tarikhtube-stack/saudi-store-spark` is the source of truth. Existing Frankfurt Supabase project `skhtunkknshvolturqlm` is the only Yawmiyati staging database. Do not use Lovable paid agent turns, create another database, or touch unrelated projects. PRs with CI before merges. No real order, supplier dispatch, public indexing, ad spend or AI spend without explicit release authorization.

## Verified starting point (not production sign-off)
- Five market records: `sa`, `ae`, `om`, `eg`, `iq`; per-market currency and minor digits; authenticated owner workspace source; public catalog RPCs and editorial pages.
- Database inspection on 20 November: 0 catalog products, 0 country listings, 0 variants, 0 import candidates, 0 orders. All five `catalog_release_enabled`, `checkout_enabled`, and `fulfillment_enabled` are **false**.
- Old TasteWP test supplier retired. Current Woo reader/import adapter is read-only, not a verified new supplier contract. Paid assistant budgets remain disabled.
- `src/lib/store/catalog-approval.ts` and `src/lib/store/supplier-evidence.ts` are advisory; server-side authorization, provenance, locks, and release gates must independently enforce approval.
- PRs #70–#71 fixed inline search entry points and editorial CTAs, added localized four-country homepage descriptions. PR #72 introduces viewport/browser QA (track its CI and visual evidence; do not claim pass before confirmation).

## Parallel work lanes and acceptance

### A. Storefront and accessibility — can proceed without supplier credentials
1. CI-gated Playwright browser matrix for five markets at widths 320/390/768/1440, full screenshots; check no horizontal overflow, hero/search/modal, country selector, categories, info/footer, product unavailable states, keyboard and mobile bottom navigation.
2. Add authenticated **staging** owner login browser tests with test fixtures and no personal data; do not commit passwords or bypass blocked deployment.
3. Fix measured RTL layout, color contrast, font-load behavior, image CLS, reduced-motion and navigation bugs; test at touch sizes.
4. Verify actual Core Web Vitals, Lighthouse accessibility/performance and third-party network requests against deployed staging after deployment is authorized, rather than guessing scores from CI.
**Gate A:** browser CI passes and owner signs off screenshots, interactions and accessible keyboard behavior across all four viewport widths.

### B. Supplier contract discovery — mandatory before real catalog or orders
For EACH country obtain and verify: actual provider identity and terms, supported product/variant feed, SKU identity, data refresh limits, stock proof, wholesale cost currency/tax treatment, order-acceptance API or manual operator process, delivery zones/courier, COD collection/remittance, refusal/return charges, cancellation/refund mechanics, privacy/data-processing terms, test/sandbox credentials, webhook signatures and replay behavior. Provider capabilities are discovered, not assumed. No automated dispatch on an unverified connector.
- Implement provider-specific read-only adapters behind the shared normalized import contract with source observation timestamp, provenance and market isolation.
- Import candidates into owner review only. Unknown supplier cost, variant mapping or stock remains UNKNOWN, not 0 or available.
- Use freshness requirements per real provider SLA; 15 minutes is the maximum threshold for the existing publication gate, not a claim that every provider supports live queries.
**Gate B:** at least one operationally verified provider per launch market, or an explicitly authorized alternate fulfillment plan, with demonstrated sample cost/stock/order-status evidence.

### C. Product/category/media contract — depends on B for real records
- Add admin-controlled category mapping and taxonomy, listing-to-category membership, server-filtered public catalog RPC, paginated sorting, stable URL filters. Do not infer categories from image or text without review.
- Variant identity: supplier SKU + market + provider + option values (size, color, weight, scent); enforce collisions and full price/stock evidence per sellable variant.
- Ingest licensed product photography to durable storage with attribution/rights evidence, signed owner approval, alt text and responsive image renditions. Do not hotlink temporary supplier hosts.
- Product detail exposes only approved material/dimensions/warranty/availability claims; unknown metadata omitted, not generated.
- Every public product row must be owner-approved, market-scoped, currently eligible and backed by verified provenance; a stale stock observation suppresses purchasability.
**Gate C:** test real (approved) sample products/variants/images in staging for each supplier; correct category result, price, currency, unknown stock and release behavior. No sample becomes public without release approval.

### D. COD checkout, orders and reconciliation — depends on B/C
- Price with actual supplier cost, forward/return courier, COD fees, ad cost, tax treatment and observed refusal probability. Existing `pricing.ts` scenario calculator is advisory, not a price approval or tax engine.
- Capture minimum market/courier-required address; normalize phones and verified consent. OTP and abuse controls should be applied based on observed risk, provider coverage, privacy rules and false-positive review—not blanket blocking of customers.
- Build market-isolated cart, server-authoritative price and stock rechecks, idempotent internal checkout, duplicate-safe supplier handoff and audit/outbox receipts. An internal order is not a supplier-accepted order.
- Courier tracking, failed COD, customer cancellation, return, refund and financial ledger reconciled against supplier/courier settlement. Handle unknown and inconsistent external states via owner exception queue.
- Keep external order creation, dispatch and payments sandbox-only until individually approved.
**Gate D:** synthetic end-to-end transactions with provider mocks/sandboxes across all countries, replay/race/failure tests, exactly one internal checkout record and no accidental real dispatch.

### E. Owner operation + AI (owner console operational before AI scale)
- Browser-test owner identity, role and per-market authorization. Real queues: candidate review/version conflict, margin/stock exceptions, order state, courier settlement, daily reporting and manual reconciliation.
- Introduce AI only for high-value grounded tasks (catalog cleanup, localized approved product copy, support guidance, product discovery, supplier anomaly summaries). Separate research suggestions from publishable claims.
- All paid models server-side with per-market USD daily/monthly caps, reservations and accounting; owner approval for published content and money-spending actions; never let a model synthesize stock, tax or delivery promises.
**Gate E:** authenticated owner can complete staged operating day, identify stuck jobs and reconcile orders; AI quality/factuality tests pass with zero unauthorized spend.

### F. Infrastructure, safety and commercial launch — depends on gates A–E
- Choose production domain topology and cloud deployment; restore authorized Cloudflare CI or alternate expressly approved host. Staging is not production; preserve current source and unrelated Kabsi resources.
- Secure API keys, RLS, RBAC, provider webhooks, rate limits, logging retention, backup/restore, operational monitoring, rollback and incident playbooks.
- Country-specific legal checkout disclosures (actual seller identity, support, taxes, returns, refunds, COD, privacy and consumer rights) vetted by qualified local reviewers. Never invent commercial registration/verification badges or impose one 14-day return statement across all countries.
- After approved domains and equivalent localized pages exist: production canonical/hreflang, crawlable sitemap, valid structured data only for genuine products, search analytics and consented conversion telemetry.
- Transfer only this repository and the named Yawmiyati Supabase project to approved owner account after access/CI and rollback are verified.
**Gate F:** written owner release authorization per store, all acceptance suites green, actual provider/account/legal signoffs, tested rollback, monitored limited traffic. Five simultaneous markets remain the requested scope; do not silently launch only Saudi.

## Important corrections to Lovable Chat Mode's suggested plan
- **Not all supplier providers expose `createOrder`, `checkStock` or prices through API.** Demand capability proof and establish reviewed manual fallback where authorized.
- **No blanket OTP, blacklist, shipping SLA, free returns, Mada/Tabby badges or store registration numbers.** Only verified services, lawful protections and contractual policies can be advertised.
- **No hard-coded IQD display change.** Current staging DB and source use IQD with 3 stored minor digits; make locale display decisions based on business requirements without changing money storage.
- **No publication based solely on a "15-minute TTL".** Provenance, actual authorization, current content/commercial approval and release flag remain separate mandatory conditions.
- **No schema rich-result promises.** SearchAction/FAQ/Product schema must meet actual search platform policies, and noindex remains in prelaunch environments.

## Work order
1. Complete and merge PR #72 only after successful browser CI and screenshot review; fix regressions.
2. Prepare provider-by-provider verified connectivity matrix and stage read-only sample import without listing publication.
3. Extend existing catalog/variant/category/media models and integration tests (don't rebuild).
4. Build sandbox checkout + owner exceptions/reconciliation; perform cross-country failure scenarios.
5. Finish owner console/AI budget controls; deploy to authorized staging; independently audit live browser.
6. Resolve domain, supplier, legal, security and account handoff gates before any production release.

## Explicit external blockers
Real supplier/provider access and contractual costs, shipping/COD/refund terms, licensed product images, final seller identities, country legal disclosures, production domains, authorized deployment and production account transfer. These cannot be fabricated or replaced by green frontend tests. Any unresolved dependency should be tracked as **blocked**, not reported as complete.
