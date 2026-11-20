# Cloudflare staging — currently deployed resources

**Account:** Existing Workers Paid account (base subscription already paid; additional usage remains metered). Do not create or purchase resources, change billing, or touch unrelated Workers.

## Verified existing Workers
- `yawmiyati-owner-staging`: public workers.dev staging URL, previews disabled. Settings bindings: `SA_INTEGRATION` service binding and `SUPABASE_PUBLISHABLE_KEY` (public).
- `yawmiyati-sa-integration`: workers.dev disabled and previews disabled; preserved Woo secret bindings, not the proven active sync route.
- **Actual working import:** browser -> Supabase Edge Function `sa-supplier-sync`, independent of Cloudflare Worker-to-Supabase network issue.
- Deployed owner Worker is older than the merged owner UI. Direct API Worker upload was blocked by safety review, so do not claim a deployment or bypass the block.

## Supported deployment investigation
Cloudflare Workers Settings -> Builds -> Connect -> GitHub. Cloudflare changed GitHub app selection to user-scoped access in November 2026. App installation (repo permission) and user OAuth authorization are separate. User's installer showed `tarikhtube-stack/saudi-store-spark` already selected, but clicking GitHub returned to the app configuration page. Verify GitHub signed-in identity before any reauthorization; planned repo transfer to `rashidhamzy-hue` is another reason not to churn permissions now.

Inspect Cloudflare Build configuration and `wrangler` worker `name` matching before deploying; this repo's TanStack/Nitro site and standalone owner Worker are DISTINCT build targets. Never overwrite owner Worker with the storefront build or remove existing encrypted bindings. Follow platform safety review; do not route around blocked uploads. Stop on a tool safety block and request authorized review.

## Acceptance gate
- Confirm exact build artifact, deploy target and bindings. Protect staging access, retain noindex headers and secure secrets.
- Run Bun 1.3.14 `bun install --frozen-lockfile`, `bun run test`, `bun run build`.
- Browser-check owner auth, candidate sync, save/reload, cross-market denial, unsafe supplier images, mobile, out-of-date sessions, public catalog fail-closed, disabled checkout.
- Independently verify Cloudflare deployed revision and rollback plan. Green GitHub CI is not a deploy receipt.
