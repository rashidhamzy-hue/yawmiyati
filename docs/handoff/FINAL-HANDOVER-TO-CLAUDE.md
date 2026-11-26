# FINAL HANDOVER TO CLAUDE — Yawmiyati

Audit date: 26 November 2026 (UTC)
Repository: `tarikhtube-stack/saudi-store-spark`
Default branch: `main`
Pre-documentation source snapshot after restoring the two applied migration files: `b525584a940d741489804af026dc5e9bdd06dea6`
Supabase project: `skhtunkknshvolturqlm` (Frankfurt staging)

## Scope and safety

This handover audit made no product/design changes, no schema changes, no Cloudflare configuration changes, no Lovable settings changes, no secret-value changes, and no account transfers. The two missing migration files were restored from the exact SQL recorded in the live Supabase migration history. They were **not** re-applied.

## GitHub state

- Repository exists, is private, and the connected GitHub identity has admin/push access.
- `main` was at `3fadccbcff7f315e7cb3aa17e6143d27b96c7903` before this handover work.
- Two migration-file commits were made directly to `main`; the second was `b525584a940d741489804af026dc5e9bdd06dea6`.
- No open pull requests were returned by GitHub at audit time.
- Numerous historical feature/build/fix branches remain. They were not deleted. This audit did not exhaustively compare every branch tip against `main`, so Claude must check branch divergence before treating any branch as disposable or claiming there is no unmerged work.
- Lovable is connected to this repository; `AGENTS.md` explicitly warns against rewriting published history. Do not force-push, rebase, amend, or squash pushed commits.

## Supabase migrations

Live migration history contains 27 applied migrations. For every row below, the SQL stored in `supabase_migrations.schema_migrations.statements[1]` was compared byte-for-byte with the matching repository file; all 27 match. The two newest files were missing at the start of this audit and have now been restored from the database history.

| Applied version | Migration | Repository file | SQL parity |
|---|---|---|---|
| 20261119175424 | commerce_foundation | `20261119000001_commerce_foundation.sql` | Exact |
| 20261119175614 | test_checkout | `20261119000002_test_checkout.sql` | Exact |
| 20261119175834 | supplier_events | `20261119000003_supplier_events.sql` | Exact |
| 20261119180029 | customer_finance_dashboard | `20261119000004_customer_finance_dashboard.sql` | Exact |
| 20261119180221 | reconciliation_history | `20261119000005_reconciliation_history.sql` | Exact |
| 20261119181154 | dashboard_catalog | `20261119000006_dashboard_catalog.sql` | Exact |
| 20261119181319 | commercial_intelligence | `20261119000007_commercial_intelligence.sql` | Exact |
| 20261119181527 | ai_policy | `20261119000008_ai_policy.sql` | Exact |
| 20261119181749 | runtime_safety | `20261119000009_runtime_safety.sql` | Exact |
| 20261119182021 | public_catalog | `20261119000010_public_catalog.sql` | Exact |
| 20261119182300 | verified_analytics | `20261119000011_verified_analytics.sql` | Exact |
| 20261119193721 | sa_supplier_bridge | `20261119000012_sa_supplier_bridge.sql` | Exact |
| 20261119204626 | candidate_commercial_review | `20261119210000_candidate_commercial_review.sql` | Exact |
| 20261119213813 | candidate_draft_transaction | `20261119213000_candidate_draft_transaction.sql` | Exact |
| 20261119214556 | catalog_release | `20261119220000_catalog_release.sql` | Exact |
| 20261120045613 | catalog_readiness | `20261120060000_catalog_readiness.sql` | Exact |
| 20261120050031 | localized_content_job_lifecycle | `20261120073000_localized_content_job_lifecycle.sql` | Exact |
| 20261120050107 | market_reporting | `20261120080000_market_reporting.sql` | Exact |
| 20261120051024 | commercial_review_cas | `20261120090000_commercial_review_cas.sql` | Exact |
| 20261120054201 | retire_tastewp_bridge | `20261120093000_retire_tastewp_bridge.sql` | Exact |
| 20261120062911 | shopping_assistant_budget_gate | `20261120102000_shopping_assistant_budget_gate.sql` | Exact |
| 20261120074434 | public_catalog_search | `20261120110000_public_catalog_search.sql` | Exact |
| 20261122042603 | candidate_review_page | `20261121090000_candidate_review_page.sql` | Exact |
| 20261122042612 | offline_offer_decisions | `20261121210000_offline_offer_decisions.sql` | Exact |
| 20261122042814 | batch_editorial | `20261122050000_batch_editorial.sql` | Exact |
| 20261126073455 | product_merchandising_intelligence | `20261126073455_product_merchandising_intelligence.sql` | Exact — restored from DB history |
| 20261126073717 | schedule_merchandising_refresh | `20261126073717_schedule_merchandising_refresh.sql` | Exact — restored from DB history |

Important: Supabase's migration history records the applied SQL statements and rollback metadata. The latest two files were copied from those recorded statements, not reconstructed or re-run.

## Deployed Supabase Edge Functions

| Function | Live version | JWT verification | Repository parity |
|---|---:|---|---|
| `yawmiyati-shopping-assistant` | 2 | Enabled | Exact match for `index.ts` and shared `payment-policy.ts` |
| `sa-supplier-sync` | 2 | Enabled | Not byte-identical. Live and repo implementations both return HTTP 410 and identify the legacy Saudi supplier integration as retired; reconcile the source before any future deployment. |

The Saudi supplier sync function is retired/inert. Do not reconnect TasteWP or use it as a production supplier integration.

### Supabase runtime variable names (names only; values were not read)

The active shopping-assistant function references:
- `YAWMIYATI_ASSISTANT_ALLOWED_ORIGINS`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `YAWMIYATI_ASSISTANT_MODEL`
- `YAWMIYATI_ASSISTANT_AI_ENABLED`

These are code references, not proof that every variable is currently configured. Secret values were not accessed or printed. Historical handoff documents also mention `WOO_SA_ORIGIN`, `WOO_SA_CONSUMER_KEY`, and `WOO_SA_CONSUMER_SECRET`; their current presence is unverified and they relate to the retired Saudi proof integration.

## Cloudflare Workers

The connected Cloudflare account currently lists one Yawmiyati Worker:

- `yawmiyati-owner-staging` — private owner/staging operations interface that calls the existing Supabase staging project. It is not the public customer storefront and is not a production commerce deployment. Its latest listed modification was 20 Nov 2026.

The former `yawmiyati-sa-integration` supplier Worker is not present in the current Worker list; historical handoff notes say it was deleted when the TasteWP integration was retired. Other Workers in the Cloudflare account belong to unrelated projects and are intentionally not listed or touched.

## Database changes outside migration files

- This handover task made no database/schema changes.
- The live migration history exposes the full recorded SQL for all 27 migrations, and all 27 now have byte-identical repository files.
- This audit did not have a historical database audit log sufficient to certify that no ad-hoc SQL was ever executed outside migration history. Do not infer that from migration parity alone.

## Lovable-hosted image assets

The 15 `src/assets/*.asset.json` files remain Lovable asset pointers. The GitHub file interface used for this audit cannot retrieve their binary image payloads, so they were not replaced and visual identity was not re-verified after relocation. Their public preview URLs are listed below; keep the original asset references until Claude can download and commit the actual JPEGs, update imports, and visually compare the rendered site.

Base: `https://preview--souq-of-saudi.lovable.app`

- [cat-beauty.jpg](https://preview--souq-of-saudi.lovable.app/__l5e/assets-v1/243d9bfe-d577-4fe5-887f-bf880efd904e/cat-beauty.jpg)
- [cat-fashion.jpg](https://preview--souq-of-saudi.lovable.app/__l5e/assets-v1/f5b33d41-c962-429a-b133-ece9d5aa9d8d/cat-fashion.jpg)
- [cat-home.jpg](https://preview--souq-of-saudi.lovable.app/__l5e/assets-v1/07cee2c2-5b4a-4f2d-8c83-9f0850bca84c/cat-home.jpg)
- [cat-kitchen.jpg](https://preview--souq-of-saudi.lovable.app/__l5e/assets-v1/dadb7b21-c229-451d-a596-9e4d8c459918/cat-kitchen.jpg)
- [cat-organize.jpg](https://preview--souq-of-saudi.lovable.app/__l5e/assets-v1/8e510036-3ccc-432e-b0ad-a8d32d265516/cat-organize.jpg)
- [cat-wellness.jpg](https://preview--souq-of-saudi.lovable.app/__l5e/assets-v1/84d476b2-695b-4666-a603-f976a89d1d22/cat-wellness.jpg)
- [hero.jpg](https://preview--souq-of-saudi.lovable.app/__l5e/assets-v1/bca31879-0411-4de2-81e2-2d077935870e/hero.jpg)
- [p1.jpg](https://preview--souq-of-saudi.lovable.app/__l5e/assets-v1/3e3f7501-99a8-49d9-9327-fc6ab815761b/p1.jpg)
- [p2.jpg](https://preview--souq-of-saudi.lovable.app/__l5e/assets-v1/747bd116-ed29-4f49-9ba8-396da7d5ae28/p2.jpg)
- [p3.jpg](https://preview--souq-of-saudi.lovable.app/__l5e/assets-v1/a0b968a3-ef65-4cd9-a8e6-53f023365ac3/p3.jpg)
- [p4.jpg](https://preview--souq-of-saudi.lovable.app/__l5e/assets-v1/13fdeec2-a222-474c-a0c1-5b5346c81ce4/p4.jpg)
- [p5.jpg](https://preview--souq-of-saudi.lovable.app/__l5e/assets-v1/37850591-8604-4803-8fb7-4ff11495c4f4/p5.jpg)
- [p6.jpg](https://preview--souq-of-saudi.lovable.app/__l5e/assets-v1/4a4727f3-1a16-41d5-8586-6c453d06fb56/p6.jpg)
- [p7.jpg](https://preview--souq-of-saudi.lovable.app/__l5e/assets-v1/7f16d4d2-a1e9-4109-bff0-837c00d2876c/p7.jpg)
- [p8.jpg](https://preview--souq-of-saudi.lovable.app/__l5e/assets-v1/e3fc7948-6f0c-4076-a8c5-343871832fed/p8.jpg)

## CI and test evidence

The latest GitHub Actions workflow observed before the handover-file commit was run `45778211852` on commit `3fadccbcff7f315e7cb3aa17e6143d27b96c7903`, and completed successfully. Its steps explicitly passed:
- `bun install --frozen-lockfile`
- `bun run build`
- `bun run test`
- storefront, release-boundary, handoff, and fixture-isolation guard scripts.

Vitest reported **95 test files passed and 568 tests passed**. This is CI evidence for that exact commit, not a claim that commands were run locally in this audit. Re-run all three requested commands on the final `main` SHA after this documentation commit.

## Broken, incomplete, or not verified

- The 15 storefront images are still Lovable-hosted pointers; binary download, repository portability, import updates, and visual parity remain unfinished.
- `sa-supplier-sync` live source is not byte-identical to the repository file, although both are retired HTTP 410 implementations.
- No open PRs exist, but branch divergence has not been exhaustively audited across all historical refs.
- The current staging owner Worker is not a production deployment. Updated owner UI deployment and public storefront deployment remain subject to existing staging/release controls.
- README and prior handoff docs state all five catalog publication, checkout, and fulfillment flags are OFF. No live supplier fulfillment, production checkout, customer dispatch, or commercial launch is authorized.
- No end-to-end live supplier order was tested. Do not send real orders or activate Taager/WooCommerce connections.
- Supabase function secret configuration and Cloudflare Worker secret bindings were not inspected; only variable names referenced by source are listed above.
- The local Bun commands were not executed from a local checkout in this audit; use the passing GitHub Actions evidence above and re-run on final `main`.

## Claude takeover instructions

Claude is the sole builder after this handover. Start from the final `main` branch, read `AGENTS.md`, `CLAUDE.md`, the current M12/M11 and M10 handoff documents, and this file. First verify the final commit and rerun `bun install --frozen-lockfile`, `bun run test`, and `bun run build`. Then reconcile the retired Edge Function source and make the 15 image assets portable. Do not apply any migration again. Do not activate catalog publication, checkout, fulfillment, supplier credentials, AI spending, SEO indexing, or public launch without the owner's explicit approval.
