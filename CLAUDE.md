> **OWNERSHIP TRANSFER PREFLIGHT — 21 Nov 2026:** Before moving accounts or beginning any production integrations, read `docs/handoff/M7-OWNERSHIP-TRANSFER-PREFLIGHT.md`. It inventories GitHub, Supabase, Lovable and Cloudflare and explains the required Lovable Git sync setup *before* transferring `saudi-store-spark` to `rashidhamzy-hue`. No transfers, production deployment, provider activation or SQL migrations were executed. Preserve unrelated Kabsi and other projects.

> **CURRENT M6 OWNER WORKFLOW STATUS — 21 Nov 2026:** Read `docs/handoff/M6-OWNER-WORKFLOWS.md` FIRST and `docs/handoff/M5-CONTINUATION.md` second. M6A/M6B are merged CI-tested source changes. M6C's owner-candidate paging source and tests are now merged, but its staging SQL migration is NOT APPLIED; real pages beyond 100 still require authorized staging rollout and owner-JWT E2E. Existing first-page RPC remains compatible. Commercial launch, real supplier imports/orders, paid AI, deployment and public indexing remain blocked without explicit owner authorization. Do not modify other projects.

> **CURRENT M5 SOURCE HANDOFF — 21 Nov 2026:** Read `docs/handoff/M5-CONTINUATION.md` first for merged offline M5 modules, remaining owner/provider blockers and the stop/wait/resume contract. M5 modules are source/CI work, NOT a deployed live catalog or autonomous AI system. The retired temporary supplier must remain retired. The historical M4H update and subsequent content below remain for provenance.

> **CURRENT OVERRIDE — 21 Nov 2026, M4H:** Start with `docs/handoff/M4H-CLAUDE-START-HERE.md` and `docs/handoff/M4H-STATUS.json`. Older sections below are dated historical snapshots and may incorrectly say a temporary Woo/Taager connection or nine products are still active; the temporary integration was retired. All five supplier connections, real orders, paid AI and public indexing remain OFF. Never show upstream supplier identities, prior-source language, or internal payout terms to shoppers. M4G is merged; M4H is a source/CI handoff, not proof of production launch. Do not activate services or spend without owner approval.

> **Blueprint status discipline (20 Nov 2026):** Read `docs/BLUEPRINT-ACCEPTANCE-STATUS.md` BEFORE any more implementation or claims. The owner asked whether all features are operational: they are not. Landing/other pages are being unified and browser-authenticated staging is being reconnected; catalog is empty, AI spending and checkout are off, and supplier production integrations/recommendation personalization/courier workflows are incomplete. Never conflate CI, database migration, preview sync and end-to-end production. Prioritize provable functionality over broad feature claims.

> **20 Nov 2026 — latest storefront baseline:** PR #54 replaced prelaunch/coming-soon banners and fictional demo routes with polished evergreen Saudi lifestyle copy and a visible interactive five-market Arabic shopping assistant. The assistant's local verified-answer mode works in the browser. Supabase Edge Function `yawmiyati-shopping-assistant` v1 deployed with `verify_jwt=true` and paid Anthropic calls OFF; database `shopping_assistant_policy` remains disabled at zero cap in all five markets. Do not switch to public anonymous access or enable API/model spending without explicit owner approval, hardened identity/abuse controls, verified model price caps and actual usage accounting. `docs/SHOPPING-ASSISTANT.md` and `docs/shopping-assistant-budget-test.sql` contain the integration details. No paid tokens used. This is not a confirmed live Anthropic shopper.

> **20 Nov 2026 superseding update:** The old temporary TasteWP/WooCommerce Saudi integration is RETIRED. The nine staging import candidates have been cleared, the Supabase Edge endpoint is a JWT-protected 410 tombstone, and the old Cloudflare supplier Worker has been deleted. All supplier credentials must be replaced on the new hosting; do not reconnect or reuse the temporary source. The full original Lovable visual storefront was restored in PR #47. All five market storefronts are to be provisioned together, with separate country configurations, supplier credentials and hosting environments. Do not spend on hosting or activate orders without owner approval.

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

## 20 November 2026 additional verified development
- Read-only Arabic market preview routes now exist for all five markets, but only Saudi has an actual imported supplier proof; release flags are off and the four new market previews are empty. Product detail uses approved public content only.
- Owner commercial review writes now use `dashboard_save_candidate_review_v2` with optimistic concurrency; old no-version RPC access revoked. Both React and standalone owner Worker source updated.
- Owner content workspace includes private drafts, blocker report, and an explicit publication button that remains disabled until the server readiness gate reports zero blockers. Server independently rechecks publication.
- Validated rollback-only smoke checks: `docs/commercial-review-concurrency-test.sql`, `docs/catalog-draft-test.sql`, `docs/catalog-release-test.sql`, `docs/ai-job-lifecycle-test.sql`, `docs/staging-security-smoke.sql`. Anon and nonmember owner access is denied. No release flags changed.
- `bun run build` must run before `bun run test` because TanStack generates `src/routeTree.gen.ts` on build; CI now uses that order. Do not edit the generated route tree.
- Latest merged source is not deployed to Cloudflare; do not conflate CI status with runtime verification.
