# Yawmiyati — Ownership transfer preflight and verification

**Read-only audit:** 21 November 2026. **Audience:** owner and Claude. **Do not run transfers automatically.** This describes one project only; preserve Kabsi and every unrelated project.

## Verified inventory (before transfer)

| Asset | Current state | Action |
|---|---|---|
| GitHub repository | Private `tarikhtube-stack/saudi-store-spark`, ID `1464468394`, `main` commit at audit `312eb7ef9705cc385e82e3aca274e07c1b6d1a1a`, current connection has admin access | Transfer to confirmed `rashidhamzy-hue` after Lovable destination-account Git sync is installed |
| Receiving GitHub account | The old repository reports no collaborator permissions for `rashidhamzy-hue`; connected GitHub app has only `tarikhtube-stack` installed | Verify recipient owns account, 2FA, no same-name repository, accepting transfer, install GitHub/Lovable integrations afterward |
| Lovable project | `Souq Of Saudi` project `6bc552b8-1629-4a0b-8706-8bc21c5c1279`; workspace `F3viTNtlzAwO8AtXmQ4E` (`Tarikh's Lovable`, Free, contains 13 projects), currently associated with an old login | Connect recipient GitHub owner to this workspace **before** transferring repository; consider moving only this Lovable project to new personal workspace after verifying sync |
| Lovable built-in DB | Disabled for this project | Do not enable or create a second database |
| Supabase | `yawmiyati-staging` ref `skhtunkknshvolturqlm`, Frankfurt, ACTIVE_HEALTHY; source org `auljgumpfwsorkmpdeaa` (`itskaysyoga-gif's Org`) | Transfer **project only**, preserving ref, after target organization/membership and eligibility checks |
| Shared Supabase org | Also contains `kabsi-prod` ref `ynjdqjlmdwjgbfezevxy` | **Never transfer, mutate, delete or recreate Kabsi** |
| Supabase contents | 30 public tables (RLS on), five market rows; zero products, listings, candidates, orders, AI jobs in verified snapshot | No source-to-production claim. Back up before moving |
| Supabase gates | All five catalog release/checkout/fulfillment OFF; market AI disabled, $0 allowance | Remain OFF during and after transfer |
| Supabase pending code | `supabase/migrations/20261121090000_candidate_review_page.sql` merged into GitHub but both new pagination RPC functions are absent in staging | Apply **only after** transfer with explicit separate staging authorization and authenticated QA |
| Supabase Edge Functions | JWT-protected `sa-supplier-sync` (retired source tombstone) and `yawmiyati-shopping-assistant` (paid usage disabled) | Preserve current functions/secrets; do not restore retired supplier or enable paid assistant |
| Cloudflare | Existing account `f0a48b06f5db2ce3cca8c98a62ccbc3b` is already under owner's preferred login and contains Worker `yawmiyati-owner-staging`. Other Workers belong to unrelated apps | **No Cloudflare account transfer**. Validate Worker binding/repo deploy access after GitHub transfer; owner Worker source is historically older than current React source |
| Vercel | Connected account showed only unrelated `kabsi-canvas` project, no Yawmiyati/Souq project | No Vercel project transfer is indicated. Do not modify Kabsi |
| Domains | No Cloudflare zone named `yawmiyati` found by exact-name lookup | Domain registrar/DNS ownership remains a separate owner check; absence of exact-name zone does **not** prove no related domain exists |

## Read-only security advisor snapshot

Supabase project advisor (21 Nov 2026): **health returned zero notices**; security raised:
- INFO: 30 public tables have RLS enabled without ordinary RLS policies. This may be deliberate deny-by-default plus owner-only RPC access; do **not** add broad table policies just to silence the advisor.
- WARN: 3 anonymous-executable SECURITY DEFINER RPCs (public read endpoints), and 18 authenticated-executable SECURITY DEFINER RPCs. A security reviewer must verify intended grants, membership checks, safe search_path, public-only data selection and no bypass — warnings alone do not prove an exploit.
- WARN: leaked-password protection not enabled. Review Auth security configuration and plan availability in the personal destination org.

References: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable , https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

These notices do **not** justify loosening RLS or running migrations before ownership transfer. Include them in the post-transfer Claude security acceptance checklist.

## Hard requirement: Lovable GitHub sync before GitHub repository transfer

Lovable docs: https://docs.lovable.dev/integrations/github

**Before** clicking GitHub Transfer:
1. Log in to the current Lovable workspace and open **Workspace settings → Git → GitHub**. Add a GitHub connection for recipient account `rashidhamzy-hue` and authorize the Lovable GitHub App for that account.
2. Open **Souq Of Saudi → Project settings → Git → GitHub**. Confirm current repository, branch (`main`), connection and sync status. Resolve divergence **before** moving anything.
3. Back up repository history (mirror clone) and project settings. Do not disconnect or delete original Lovable GitHub connection or repository.
4. From current repository admin **Settings → General → Danger Zone → Transfer**, specify `rashidhamzy-hue`, keep `saudi-store-spark` name. Recipient accepts GitHub's email invitation within the allotted time.
5. Check project Git sync updates to `rashidhamzy-hue/saudi-store-spark`. If not connected, **stop and investigate**, do not click Lovable Disconnect/Reconnect blindly (that can create a second repository). Resolve GitHub App install access or contact Lovable support.
6. Update local remote URLs, deployment pipelines and Claude/ChatGPT GitHub connectors. Re-run repository CI from the new owner. Verify repo history, branch protections and access. GitHub Free plan can remove certain private repository protection features.

**Optional, not automatic:** Move only the Lovable `Souq Of Saudi` project to a personal Lovable workspace. The destination workspace must be accessible to the source project owner; use **Project settings → General → Project actions → Move to workspace** when eligible, then check Git sync and sharing again. Do not move the 12 unrelated projects, and do not select Remix unless knowingly making an independent copy. If a workspace move would break the required existing-repository sync, defer that move and consult Lovable support before acting.

## Supabase project transfer (preserve exact ref)

Official instructions: https://supabase.com/docs/guides/platform/project-transfer

1. Sign in to personal Supabase account and create/identify the target organization under the preferred login. Check plan, project limits and billing. Do not copy or recreate the database.
2. Confirm the current Supabase login is **Owner** of source org. Supabase requires the transfer initiator to be Owner of source org and a full organization member of target, **using the same signed-in account**. The personal target organization can invite the current source Owner as a member; complete that invitation first. Alternatively use another account that meets both conditions.
3. In Yawmiyati's **Project Settings → General → Transfer project**, select only `skhtunkknshvolturqlm`. Inspect eligibility checks, pending GitHub integration, scoped roles, plan limitations, any changes in compute/billing, before confirming. Do not transfer the source org or `kabsi-prod`.
4. After transfer, confirm the target Supabase organization lists project ref `skhtunkknshvolturqlm`, status ACTIVE_HEALTHY, the same 30 public tables/5 markets, no unexpected data, unchanged safe flags, and owner membership. Verify Auth, existing JWT-protected Edge Functions, secrets (names only), RLS, client publishable key and server-side key use (never reveal keys).
5. Scoped management access tokens/OAuth integrations can stop working after organization change; reconnect Supabase MCP clients in Claude/ChatGPT, Lovable and any infrastructure as needed. If project GitHub integration is enabled, disconnect it **before** Supabase transfer as the official requirement, and reconnect after.
6. When access works under the new org, optionally remove obsolete membership to avoid inadvertent old-account access. Retain a tested rollback/backup plan.

Supabase's in-place project transfer retains DB, Auth users/sessions, storage, Edge Functions and secrets, project ref/URL and API keys. **It does not** move source organization's billing method, credits, membership, or its other projects. New plan limitations can remove add-ons. Never paste project secret values into a support ticket, chat or GitHub.

## Independent accounts and setup to review (only if Yawmiyati currently uses them)

- **Cloudflare:** Already under the preferred login; maintain same account and Worker. Re-authorize deployment connection to new GitHub owner if configured; do not overwrite unrelated Workers.
- **Domain/DNS:** Verify domain registrar owner, DNS zone, SSL and mailbox recovery before modifying nameservers. Do not transfer a domain merely because source code ownership changes.
- **Meta:** Review actual Yawmiyati Facebook Page, Instagram, Meta Business Manager, ad account, catalog/pixel and billing administrators. Transfer access/ownership only if currently on the wrong business account; avoid changing shared assets without verification.
- **Supplier providers:** Taager/Zambeel and each market's authorized stock/fulfillment service. Their accounts, API keys, supplier agreements and billing do not move with GitHub/Supabase.
- **AI and other services:** API-provider login/billing, email sender, analytics, error tracking, payment gateway/courier accounts only where actually in use. Reconnect OAuth and rotate/re-scope credentials where appropriate. No payment or paid AI currently authorized.
- **Claude/ChatGPT:** After transfers, reconnect GitHub recipient and moved Supabase project; verify exact repository, RLS-protected staging project and safe flags before continuing the M6C migration or any real integration.

## Stop conditions

Stop and ask owner before: repository transfer, Lovable move/transfer/remix, Supabase project transfer, database migration, new provider connection using real credentials, live deployment, AI spend, ad spend, real supplier imports or dispatch, checkout/catalog enablement, deleting old account assets. Do not work around product or security restrictions.

## Verified versus unverified

All checks here were non-mutating. We did **not** verify destination Supabase organization membership or billing, the receiving personal GitHub account's GitHub App installation, current Lovable Git sync status, domain registrar or live authenticated dashboard. Do not treat source CI success as production deploy verification.
