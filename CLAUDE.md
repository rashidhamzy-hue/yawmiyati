# CLAUDE.md — Yawmiyati engineering handoff

## Read first
Read `AGENTS.md`, `docs/INTEGRATION-CONTRACT.md`, and `docs/HANDOFF-STATUS.md`. This is Yawmiyati only: do not touch Kabsi, Alo King, Hader, or any other project. All five markets (sa/ae/om/eg/iq) must reach commercial readiness together, with Saudi as the integration proof. No extra spending, paid AI calls, or purchases without owner authorization. No real fulfillment/order submission until explicit owner approval.

## Single architecture
- Lovable project `6bc552b8-1629-4a0b-8706-8bc21c5c1279` (Souq Of Saudi): visual/frontend editing, connected to this GitHub repository. Lovable managed database is DISABLED.
- Canonical source currently GitHub private `tarikhtube-stack/saudi-store-spark`, destination owner `rashidhamzy-hue` (ownership transfer pending).
- Canonical external Supabase STAGING project `skhtunkknshvolturqlm`, URL `https://skhtunkknshvolturqlm.supabase.co`, Frankfurt. Owner approved directly managed `supabase/migrations` in GitHub, exception recorded in `AGENTS.md`. Supabase project ownership transfer pending; preserve project URL/ref.
- Existing Cloudflare account hosts `yawmiyati-owner-staging` (public staging URL) and `yawmiyati-sa-integration` (private). Owner Worker was last successfully deployed at PR 20; newer Worker upload was blocked by tool safety review. GitHub Builds integration loop unresolved. Do NOT deploy around safety restrictions or disable existing bindings.
- Working supplier proof: Supabase Edge Function `sa-supplier-sync` reads WooCommerce/Taager Saudi test via server secrets, owner JWT membership. Nine real Woo product candidates imported and independently counted. SOURCE PRICES ARE OBSERVED RETAIL, NOT VERIFIED ACQUISITION COSTS. Woo-reported instock is not independently verified availability. TasteWP is disposable test infrastructure.

## Feature truth
- Database migrations through catalog release and readiness plus AI-job lifecycle and market reporting applied in staging and rollback-tested.
- Product research `src/lib/store/research-evidence.ts`, COD economics `pricing.ts`, advisory approval `catalog-approval.ts`, five-market import `market-import.server.ts`, guarded fulfillment states `fulfillment-state.ts`.
- React owner `/admin` is source-only, NOT verified in hosted deployment. Commercial review, content approval, draft, readiness and market reporting are implemented, not yet browser smoke-tested.
- Public Saudi `/sa` preview uses only approved/still-live public catalog RPC when build-time Supabase public config exists. Without configuration, demo mode is EXPLICIT `VITE_YAWMIYATI_DEMO=true` only. Customer checkout remains blocked.
- Five markets have `catalog_release_enabled=false`, `checkout_enabled=false`, `fulfillment_enabled=false`. No actual published listings, orders or AI jobs. AI policies disabled and zero budget.
- AI execution (server-only): reserve via service role, claim, injected provider, validate facts, persist human-review draft. Anthropic adapter must remain unconnected until verified secrets, metering, legal facts and owner budget authorization. No auto-publish or promotional sends.
- Do not confuse green GitHub tests with deployed functionality; verify actual product pages and owner workflow before declaring ready.

## Development workflow
1. Inspect code and migration dependencies before editing; avoid generated Lovable files.
2. Branch -> PR -> GitHub commerce-checks CI (Bun 1.3.14 test+build) -> merge only green.
3. Apply each new SQL migration to ONLY staging `skhtunkknshvolturqlm` in order; run transactional rollback fixtures; inspect row counts and RLS.
4. Each developer should document source commit, deployment revision, actual runtime smoke test and unverified claims independently.
5. Do not use service-role, Anthropic or Woo secrets in `VITE_` variables, documentation, logs or repository. Public publishable key is not secret.
6. Live checkout, supplier dispatch, AI budgets, catalog release, ads and marketing broadcasts remain off until explicit owner approval and complete supplier tests.
7. Preserve historical Git commits and Lovable synchronization; avoid force push and rebase of published main.

## Next acceptance work
- Restore authorized Cloudflare deploy path and browser-test owner staging and source build without bypassing existing safety review. Preserve private Worker bindings and preview disablement.
- Create durable approved media workflow; images currently originate from temporary Woo site, cannot be permanent storefront dependencies.
- Complete all-country supplier credentials, variations handling, stock truth, commercial costs, country-specific shipping/COD/returns/legal disclosures, category and media integration.
- Implement transactional supplier order lifecycle with test-only idempotent calls, source signatures and reconciliation. No real dispatch.
- Complete AI operator with secure server-only provider secret, real usage reconciliation under explicit budget, evidence quality evals and human approval. No assumed model pricing.
- Verify responsive Arabic/RTL UX, product imagery and conversion flows with real approved data, security/privacy tests, monitoring, release gates.
- Transfer GitHub to `rashidhamzy-hue` and Supabase to the main user account without changing project ID or other projects. Reconnect Claude access after transfers.

## Status discipline
Status labels: VERIFIED LIVE, DATABASE-TESTED, CI-PASSED, SOURCE-ONLY, BLOCKED, NOT BUILT. Do not mark SOURCE-ONLY as production ready.
