# Security audit — 26 Nov 2026 (Supabase staging `skhtunkknshvolturqlm`, org Yawmiyati)

Read-only audit after the account transfer. No schema, data or secret changes were made.

## Findings
| Area | Result | Status |
|---|---|---|
| Table access | All 33 public tables have RLS enabled with **no** policies, so direct table access from the browser is denied (default deny). All access goes through SECURITY DEFINER functions. | OK by design |
| Public functions (anon) | `public_catalog`, `public_catalog_detail`, `public_catalog_search`, `public_editorial_page` read only from `current_catalog_release` (released listings, release flags per market). Limits/offsets clamped. | OK by design |
| Owner functions (authenticated) | All 22 callable owner/dashboard functions check `auth.uid()` + `dashboard_members` for the requested store and raise `42501` otherwise. Legacy `dashboard_save_candidate_review` has no grant. | OK |
| Owner identity | Only one auth user exists: rashid.hamzy@gmail.com, member of all five stores. | OK |
| Edge Functions | `yawmiyati-shopping-assistant` v2 matches repo. `sa-supplier-sync` v2 is an inert HTTP 410 tombstone; repo file now byte-identical to the deployed source. Both `verify_jwt=true`. | OK |
| Leaked-password protection | Disabled in Supabase Auth. Owner sign-in is passwordless/OTP per `docs/owner-passwordless.md`; enable when available on the plan. | Owner action, low |
| Old WooCommerce secrets | `WOO_SA_ORIGIN`, `WOO_SA_CONSUMER_KEY`, `WOO_SA_CONSUMER_SECRET` may still exist (TasteWP site already deleted, no code reads them). The connector cannot list or delete secrets. | Owner action: delete in Supabase → Edge Functions → Secrets |
| Account MFA | Supabase org owner has no MFA (seen 26 Nov). | Owner action: enable MFA on Supabase and GitHub |
| Free-plan quota | Org shows "Grace period is over" with egress above the free 5 GB from earlier usage in that org. Project currently ACTIVE_HEALTHY. | Owner to review Usage before deciding on Pro |

## Not yet audited (later phases)
Order submission, webhooks and connector secrets do not exist yet; they get their own review in Phase 4/6 (signed webhooks, idempotency, per-market secret isolation, rate limits).
