# Yawmiyati engineering handoff
Baseline: 19 November 2026, main commit 098ec29e2a8d07f63e58ca6c02a81934a65f4435 (PR 21).

## Scope
One commerce control plane for Saudi Arabia, UAE, Oman, Egypt and Iraq; isolated per-market data and Taager WooCommerce bridges. Saudi is engineering proof, not a separate commercial launch. All five markets must be ready before launch. TasteWP is disposable testing infrastructure. Do not purchase hosting or consume paid AI credits without authorization. Do not touch other projects.

## Verified evidence
- Private repository tarikhtube-stack/saudi-store-spark; main branch.
- Supabase staging project skhtunkknshvolturqlm, Frankfurt; project active.
- Owner staging: https://yawmiyati-owner-staging.rashid-hamzy.workers.dev/
- Direct browser Supabase password authentication and candidate RPC succeeded in production staging.
- Supabase Edge Function sa-supplier-sync version 1, JWT verification enabled, fixed staging origin, membership RPC before Woo requests. Live user sync returned 9 received / 9 staged / 0 skipped. Independent SQL count: 9 candidates, 9 distinct SKUs, 9 priced, 9 descriptions, 9 image arrays, 9 supplier-reported instock. This verifies ingestion, not sellable inventory or cost.
- Supplier credentials are server-side in Supabase function secrets: WOO_SA_ORIGIN, WOO_SA_CONSUMER_KEY, WOO_SA_CONSUMER_SECRET. Never retrieve or paste values. Existing Cloudflare private supplier Worker remains a legacy fallback, not the proven active integration.
- PR 21 commercial review table and RPCs applied to staging and owner read/write tested in rolled-back transaction; 9 candidate images verified, zero persisted synthetic reviews. PR 21 CI green and merged. Dashboard upload blocked; deployed UI is still PR 20. Cloudflare GitHub connection redirects to authorized GitHub app settings; don't repeatedly reauthorize or widen repo permissions.
- Checkout and fulfillment disabled. No real orders or payments authorized.

## Ownership migration (manual, coordinate after code handoff)
1. Confirm exact destination GitHub username (email alone is not a transfer target). Transfer ONLY this repository via Settings > General > Danger Zone > Transfer ownership. Accept as destination. Verify private visibility, branches, history, CI and app access. Update remotes. Lovable sync may require reconnecting; don't rewrite history. Existing app installation currently scoped to this repository.
2. Supabase: destination account must have appropriate ownership access; use existing project transfer into a destination organization only if eligible and no unexpected cost. Otherwise invite main account with appropriate role in the existing organization and verify access first. Never move other projects. Check billing, project ref, URL, data, Auth users, migrations, secrets, Edge Function and access after transfer. Do not delete old account or project.
3. Cloudflare: retain two named Workers, scopes and secrets; verify current account ownership separately. Do not transfer unrelated services. Establish supported deployment workflow and review changes before release.
4. Reconnect Claude to transferred resources only. Re-run staging login/sync and candidate count. Rotate supplier secrets if necessary; never commit secrets.

## Remaining engineering acceptance gates
- Review existing code and reconcile Lovable AGENTS.md managed-scope constraints with the independently managed staging backend before schema changes; no edits to generated files or history rewriting.
- Deploy PR 21 via supported Cloudflare workflow after source/security review; verify mobile/desktop, owner auth, filters, save/reload, image failures, stale sessions and cross-market denial. Unknown costs stay null. Protect unsaved edits and handle concurrent updates.
- Verify actual supplier acquisition cost (Woo price is not cost), shipping, COD fees, refusals, returns, tax and FX; deterministic contribution model, evidence and downside scenarios.
- Product research and ranking: transparent scoring, source provenance, manual shortlist, reject unsupported claims. No fabricated demand/sales data. Existing AI policies disabled and budgets zero; use offline briefs and mocks until authorized.
- Arabic localized content pipeline for all markets; grounded source attributes, claims review, safety categories, human approval, AI budget reservation and evals. No auto-publication.
- Candidate-to-listing promotion transaction, country-scoped supplier mapping and idempotency; approve content and price; verified freshness and stock policy; private preview, no live checkout.
- Storefront: replace demo-only paths/data with real approved catalog, RTL/mobile accessibility, category/product pages, metadata, legal disclosures, country-specific currency and shipping; no fake checkout confirmations.
- Orders: test only with synthetic data, guarded state transitions, idempotent webhook/reconciliation and COD ledger; no Taager order submission absent explicit authorization. Verify supplier fulfillment semantics with documented integration.
- Four additional market bridges, separate credentials, country-level access and configs; prove import and isolation individually before launch.
- Reporting/marketing intelligence: events, contribution, attribution, privacy, UTM, creative drafts; no automatic ad spend or customer messages.
- Release: CI unit/integration/build, browser smoke tests, migration rollback strategy, least privilege, secret scanning, backups, incident runbook, cost controls, explicit launch gate.

## Handoff honesty
Not a finished production system. Existing staging import is proven; all later phases must be verified. Do not describe mocked tests as live integration. Keep a running evidence log with dates/commits and mark blockers clearly.
