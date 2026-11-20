# Yawmiyati account ownership consolidation — 20 November 2026

**Owner direction:** All Yawmiyati assets ultimately controlled from `rashid.hamzy@gmail.com`. Keep existing resources and history. NEVER move, modify or delete Kabsi or other projects.

## Verified resources and status
| Resource | Current owner / provider | Destination | Status |
|---|---|---|---|
| Private GitHub `tarikhtube-stack/saudi-store-spark`, repo ID `1464468394` | `tarikhtube@gmail.com` GitHub user `tarikhtube-stack` | GitHub user `rashidhamzy-hue` at main email | NOT TRANSFERRED; target collaborator permission reported `none` |
| Supabase `yawmiyati-staging` ID `skhtunkknshvolturqlm` | `itskaysyoga@gmail.com` Supabase org `auljgumpfwsorkmpdeaa` | New/existing Supabase organization owned under main email | NOT TRANSFERRED |
| Lovable Souq Of Saudi project `6bc552b8-1629-4a0b-8706-8bc21c5c1279` | User reports main email | Remains | GitHub sync working at latest merged commit |
| Cloudflare account `f0a48b06f5db2ce3cca8c98a62ccbc3b` | User reports main email | Remains | Public owner staging Worker retained |
| Sentry, PostHog, Anthropic, Claude | User reports main email | Remain | Need Yawmiyati-specific access validation; do not touch unrelated orgs |

**CRITICAL:** Original Supabase organization also contains `kabsi-prod` project `ynjdqjlmdwjgbfezevxy`. Do **not** transfer, rename, deactivate or otherwise change the source organization. Move the **Yawmiyati project alone**.

## Transfer sequence — user confirmation at each handoff
1. Under destination `rashid.hamzy@gmail.com`, make sure `rashidhamzy-hue` GitHub is signed in and no repository named `saudi-store-spark` conflicts.
2. While signed into source GitHub `tarikhtube-stack`: repository `Settings → General → Danger Zone → Transfer ownership`. Enter destination GitHub username `rashidhamzy-hue` and confirm repository name. Accept transfer from the destination account's confirmation email. GitHub retains issue/commit history and redirects the old repository URL, but update integrations to the new canonical URL.
3. Verify the new canonical private URL `https://github.com/rashidhamzy-hue/saudi-store-spark`, `main` HEAD SHA, GitHub Actions and repo permissions. Make sure Lovable GitHub app is installed and authorized for this exact transferred repo under the destination GitHub identity. Verify a no-op change appears in Lovable and that previews build, before changing anything further.
4. On Supabase main account, create or use a target organization owned by main email. Using current `itskaysyoga@gmail.com` source account, grant appropriate access to the destination organization for the transfer if required by Supabase, then open **Yawmiyati project only** (`skhtunkknshvolturqlm`) → Settings → General → Transfer project. Select the target main-owned organization. Confirm the target org's billing and access implications before clicking transfer. No region change and no project recreation.
5. Verify project ID `skhtunkknshvolturqlm`, URL `https://skhtunkknshvolturqlm.supabase.co`, migrations, RPCs, RLS, Auth users, Edge Function status, project backups, key material, DNS/restrictions and all five market gates. Do not print secrets or rotate keys unless necessary. Destination must have owner rights. Verify source membership can then be removed without impacting `kabsi-prod`.
6. Reconnect destination Supabase organization to Lovable and Claude as needed; confirm Lovable cloud database stays DISABLED and existing external project is used. Reconnect GitHub to Cloudflare Builds/Claude, maintaining separate app targets. Recheck Sentry, PostHog, Anthropic project scoping on main email and do not create duplicates by default.
7. Re-run GitHub CI and Supabase rollback-only SQL tests; screenshot desktop/mobile Lovable storefront. Ensure old Cloudflare Worker owner preview is not confused with latest React owner dashboard.
8. Once verified, update `CLAUDE.md`, `README.md`, links, and owner-specific setup references. Notify owner of validated destination access and unresolved items. Do not delete old GitHub/Supabase accounts merely because transfers completed.

## Engineering truth and acceptance gates
- Original photographic Lovable design restored via PR47 and synchronized.
- TasteWP temporary test integration retired via PR48. Nine import candidates cleared; old private Cloudflare supplier Worker deleted and owner service binding removed. The `sa-supplier-sync` Edge Function remains a JWT-protected inert HTTP 410 endpoint until deletion is possible. Old environment secrets must still be removed from Supabase via secret management UI; avoid printing them.
- PR49 specifies the five hosted store plan in `docs/FIVE-STORE-HOSTING-BUILD.md`. Hosting provider, domains, supplier credentials, Taager contracts and per-country fulfillment are not yet supplied.
- All five market catalog release, checkout and fulfillment gates OFF, AI policy budgets OFF. No published products, real orders or current supplier data.
- Source tests green and Lovable synchronized; this is NOT equivalent to five production deployed stores. Cloudflare owner UI deploy block remains open. Do not circumvent tool safety restrictions.
- No actual model calls, customer campaigns, payments, supplier dispatches or hosting purchases without explicit authorization.

## Claude project handoff after transfers
Ask the Claude Yawmiyati project to open `CLAUDE.md`, `AGENTS.md`, `docs/HANDOFF-STATUS.md`, this checklist and `docs/FIVE-STORE-HOSTING-BUILD.md`. Verify tool identity and allowed project IDs before touching anything. Run independent architecture/security/design audits, then execute the five-store production plan using only newly supplied hosting + credentials. Avoid promises of complete production functionality until live verified acceptance tests pass.
