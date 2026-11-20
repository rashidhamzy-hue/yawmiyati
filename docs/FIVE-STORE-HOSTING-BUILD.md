# Yawmiyati — five hosted stores build plan
Owner-approved direction: no TasteWP, no temporary WooCommerce installation, no single-country-only launch. Keep the original Lovable visual design and the existing independent Supabase database. Prepare five market experiences together.

## Infrastructure and responsibility
- Lovable / GitHub: original branded frontend and shared source, preserve hero, six image categories, editorial sections and Arabic RTL. Do not silently switch to a plain staging shell when the catalog is empty.
- One central Supabase control plane: market-isolated records, catalog approval, shipping/COD rules, customers, evidence, orders, financial reporting and owner authentication. Do not create five Supabase projects.
- Hosting not chosen yet. **Never assume a PHP WordPress host can run a React/TanStack Start frontend.** It may host five separate WooCommerce merchant/supplier installations if that is the chosen commerce backend; React frontend needs a compatible runtime or static/edge deployment.
- All five stores: Saudi Arabia (SAR, ar-SA), UAE (AED, ar-AE), Oman (OMR, ar-OM), Egypt (EGP, ar-EG), Iraq (IQD, ar-IQ). Country URLs already implemented as /sa, /ae, /om, /eg, /iq.
- Choose the actual domain model only after owner provides domains and hosting details: country domains, subdomains or paths. Maintain separate canonical URLs, hreflang and content per market.
- No credentials in client builds; each production supplier connector gets its own endpoint, secrets, rate budget, source identity and market membership.

## Provider choices to resolve before deployment
1. Which hosting vendor and package are being used? Confirm Node/edge runtime vs managed WooCommerce PHP support, environments, DNS, SSL, backup/export and volume limits.
2. Are there exactly five independent WooCommerce installations for checkout/order routing, or is WooCommerce only a supplier staging bridge? Identify Taager access/API capabilities **per country** before designing fulfillment.
3. Which domains, country-specific shipping/courier agreements, COD failure fees, taxes and returns terms are verified? Unknown terms must stay unset, not invented.
4. Where should approved product images live after Lovable? Existing pointers under `/__l5e/assets-v1` are project-managed preview assets; export or move to an owned static/CDN origin before relying on external hosting.

## Implementation batches (no live activation)
**Foundation:** five independent runtime/tenant configurations in the single app, domain-routing logic, market-specific currencies/locale, SEO metadata, secrets, backups and audit logs. No cross-market cart or product leakage.

**Catalog:** independently import supplier offers into review queues; validate real costs and stock at source; reject malformed product claims; resize and moderate product images to owned storage; approve multilingual content revisions; create private listings; publish only on explicit owner authorization and verified stock.

**Customer journey:** regional mobile-first product search, categories, variants, localized checkout and legal policies. Only after provider integrations are verified should checkout be enabled. All orders require idempotency and supplier acceptance evidence. No test order may dispatch or charge real people.

**Operations:** centralized owner dashboard with market switcher, product research, COD contribution, order exceptions, courier reconciliation, financial ledger, content approvals and explicit AI budget caps.

**Go-live:** test five isolated stores in preview and mobile with synthetic orders; verify stock freshness, payment/COD, customer privacy, failures, returns, webhooks, logs, backups and response procedures. Launch all five only when owner signs off all five checklists.

## Existing state as of 20 Nov 2026
- PR47 restored the photographed Lovable storefront visual system for all five previews; not proof of a fully operational hosted shop.
- PR48 retired the temporary Woo/TasteWP integration: live Saudi Edge URL returns 410, nine old rows deleted, SA-only staging RPCs dropped, legacy private Cloudflare Worker deleted and binding removed. Reusable WooCommerce adapter code remains unconnected pending future architecture selection.
- All five catalog release, checkout and fulfillment flags OFF; AI policies OFF. No published products or orders.
- Old Supabase Edge credentials may remain stored as secrets even though the function no longer uses them. Owner must delete `WOO_SA_ORIGIN`, `WOO_SA_CONSUMER_KEY` and `WOO_SA_CONSUMER_SECRET` via Supabase project secret settings if their removal cannot be performed through the connected interface. The old TasteWP-hosted site must be deleted separately from the TasteWP account.
- Owner dashboard Cloudflare upload/redeployment still requires authorized resolution. Keep the current functioning Worker intact.
- Do not charge hosting, Lovable credits or Anthropic credits without owner permission.

## Definition of done
Five beautiful independent country storefront experiences, using verified inventory with supported checkout and fulfillment, synchronized with one shared management system, tested on real hosting; all data, domains, credentials and integrations owned by the main user account. Current source is staging foundation, not this outcome.
