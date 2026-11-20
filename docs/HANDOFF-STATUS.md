> **Customer-facing design update 20 November:** PR #54 completed evergreen storefront copy and interactive five-market AI shopping assistant UI. Public API to Anthropic is not activated: function deployed with JWT verification, policies disabled with zero caps, no paid requests. All commerce release flags OFF, catalog empty. See `docs/SHOPPING-ASSISTANT.md` for explicit activation gates.

> **Latest update 20 Nov 2026:** Legacy TasteWP/temporary Saudi Woo setup retired: old 9 import rows removed, Edge supplier sync returns 410, Cloudflare private supplier Worker deleted and service binding removed. The current staging catalogue is empty pending five new hosted stores. PR #47 restored branded Lovable storefront UI across all market previews. Statements below about the former live integration are historical evidence only, not current operational availability.

# Yawmiyati engineering handoff — verified as of 20 November 2026

## Goal and architecture
A single commerce control plane for sa/ae/om/eg/iq with separate market supplier integrations, one eventual commercial launch. Saudi is proof only. Lovable handles design/frontend; GitHub is source of truth; existing independent Supabase staging holds data; existing Cloudflare account hosts previews. Supabase directly managed migrations approved by owner and recorded in AGENTS.md. Never touch unrelated projects.

## Evidence with strict status levels
**VERIFIED LIVE:** Supabase staging `skhtunkknshvolturqlm`, owner login in older Cloudflare Worker `yawmiyati-owner-staging`, direct Edge Function `sa-supplier-sync` importing nine real Saudi WooCommerce candidate records. Nine unique SKUs, nonempty descriptions and images, supplier-reported instock. This does NOT establish supplier acquisition cost, guaranteed stock, sellability or fulfillment.

**DATABASE-TESTED in staging:** Owner commercial review RPC, immutable content approvals, atomic private catalog draft creation, catalog release gating and public product detail, per-candidate release readiness, reserve/claim/complete/fail AI content job lifecycle, market performance reporting. Transactions tested via rollback fixtures, with zero synthetic rows persisted.

**CI-PASSED SOURCE-ONLY:** COD economic scenarios; market-specific scoring with verified evidence; Arabic content brief/validation; five-market bounded import helper; order state machine; original storefront isolation, product detail UI; React owner commercial review, draft editor, readiness, performance. Browser/deploy smoke testing pending. AI provider adapter is mock-tested; no actual provider execution authorized.

**BLOCKED / NOT COMPLETE:** Updated Cloudflare Worker upload encountered safety block; GitHub Builds connection redirects repeatedly. Real storefront images/categories/durable media, live stock verifier, product listings and actual supplier costs, AI operator deployment, five supplier connections, live checkout, fulfillment and account transfers remain pending.

## Current flags and data
- All five stores: `catalog_release_enabled=false`, `checkout_enabled=false`, `fulfillment_enabled=false`.
- AI market policies: disabled, daily budget 0.
- Database: nine Saudi import candidates; zero real catalog listings, orders and generated AI content as of latest validation. TasteWP is temporary supplier proof and should not be permanent image/hosting dependency.
- React owner dashboard and newer standalone Worker changes are NOT deployed. Current owner staging Worker predates commercial review UI.
- No paid AI credits spent. No real orders/marketing messages sent.

## Secrets and relevant resources
- GitHub private `tarikhtube-stack/saudi-store-spark`, planned destination `rashidhamzy-hue`. Do not transfer until coordinated by owner; avoid forced Git history changes due Lovable sync.
- Lovable `6bc552b8-1629-4a0b-8706-8bc21c5c1279`, workspace Free, cloud database DISABLED. Existing GitHub and Supabase connectors enabled. No paid Lovable request performed.
- Supabase staging project `skhtunkknshvolturqlm`, Frankfurt, transfer destination main user account. Do not recreate or delete project.
- Existing Cloudflare `yawmiyati-owner-staging` public staging and `yawmiyati-sa-integration` private. Existing supplier Edge Function secrets WOO_SA_ORIGIN, WOO_SA_CONSUMER_KEY, WOO_SA_CONSUMER_SECRET. Never retrieve or print secret values.

## Remaining release acceptance work
1. Verify all merged code for real mobile/desktop frontend and authenticated owner screens, restore authorized deployment workflow without circumventing safety restrictions.
2. Durable approved product media, real category taxonomy, product/variant coverage and accurate supplier acquisition costs; preserve null unknowns.
3. Actual supplier stock verification with provenance and TTL; market release requires explicit owner decision, never inferred from Woo 'instock'.
4. Research evidence integrations, Arabic creative quality evaluation, human-approved localized drafts, real Anthropic execution only with budget owner authorization and audited secret configuration.
5. Authoritative shipping, COD, cancellations, returns, taxes and fulfillment reconciliation for five countries; test idempotently with synthetic data. Never dispatch real orders without approval.
6. Market-specific supplier integrations and isolation, full user journey, analytics, privacy/legal disclosures, e2e regression tests, incident response and billing caps.
7. Transfer only named repo to `rashidhamzy-hue` and existing Supabase project to main account with unchanged IDs, verify Claude Code access. Preserve Lovable connection and secrets. No unrelated account changes.

See `CLAUDE.md`, `docs/INTEGRATION-CONTRACT.md`, `docs/staging-deployment.md`.
