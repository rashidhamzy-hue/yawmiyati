# Milestone 2D — secure localhost-only owner review & browser QA

Date: 20 November 2026. Zero-spend, source-only. Based on `main` after M2B #87 and M2C #88 were merged.

## Delivered
1. `scripts/m2d-local-access.mjs` rejects all access unless a strong, ephemeral Basic credential is presented to an exact loopback host. `scripts/m2d-local-preview.mjs` cannot start unless `YAWMIYATI_LOCAL_OWNER_PREVIEW=offline-owner-test-only`, the secret is at least 32 valid characters and `NODE_ENV` is not `production`. It binds **only** to `127.0.0.1:4174`. Every request to the HTML, modules and static assets must authenticate; requests without credentials return 401.
2. The preview is a **separate Vite middleware**; its HTML and React entry are under `scripts/` and `src/test/` rather than TanStack production routes. No synthetic fixture is imported by public or authenticated production app code. `scripts/check-simulation-boundary.mjs` remains active.
3. `src/test/m2d-owner-review-workspace.tsx` provides a local Arabic RTL review workspace with an explicit synthetic warning, five-country context, M2A catalog and M2C COD views, and five pass/needs-fix/not-reviewed checkpoints per market/view (50 total). Export is an in-memory read-only JSON text area. These findings are **not publication authorization** and are not saved to any database.
4. M2A/M2C demo components accept optional `lockedMarket` so the owner controls the country from one review selector; existing independent demo behavior remains unchanged.
5. `src/test/m2d-owner-review.test.tsx` tests environment and credential gates, rejects remote hosts/unauthorized access, checks review scope, synthetic warnings, in-memory export and no network use.
6. The existing `Storefront browser QA` GitHub workflow retains its public storefront checks and adds `scripts/m2d-browser-qa.cjs` to exercise the isolated **authenticated localhost-only review** at 320, 390, 768 and 1440 pixels in all 5 markets. It checks 401 denials for HTML and JS, RTL, viewport overflow, correct market and currency, review export, complete COD demo receipts, and keyboard focus. Screenshots are uploaded to the existing short-retention QA artifact.

## Why this is not a deployed owner dashboard route
Reusing `/admin` for synthetic fixtures or adding a public path would violate M1's CI isolation boundary and could expose fictional product/shipping information. The current project has an authenticated Supabase dashboard, but enabling a hosted demo there would require a **separate server-authorized owner check**, preview-only deployment policy, anti-cache controls and approval. Those are **not** implied by a local Basic credential and are **not** attempted here. The local Basic credential authenticates access to the machine-local review server only; it does **not** verify the user's identity against Supabase.

## Local instructions (no integrations)
1. Install repository's frozen dependencies: `bun install --frozen-lockfile`.
2. Generate an ephemeral random value in your shell, e.g. `export YAWMIYATI_LOCAL_PREVIEW_SECRET=$(openssl rand -hex 32)`. Never commit, paste or share the value.
3. Set `YAWMIYATI_LOCAL_OWNER_PREVIEW=offline-owner-test-only NODE_ENV=development` and run `node scripts/m2d-local-preview.mjs` from the repository root.
4. Visit `http://127.0.0.1:4174/__local_owner_review` **on the same machine** and enter Basic username `owner` with the generated secret. Do not expose port 4174 through tunnels or proxies. You may inspect the 5 markets, switch catalog/COD, complete a synthetic receipt and copy the local acceptance JSON.
5. Shut down the server to revoke access. No state survives reload.

## Non-negotiable exclusions
No public preview, no real owner Supabase sign-in for this harness, no deployment, no saved review data, no uploads of actual customer/supplier data, no production cart/checkout, no courier, no Taager/WooCommerce, no payments, no live orders, no AI spend, no external provider calls or database writes.

## Acceptance and limitations
- Run `node scripts/check-simulation-boundary.mjs`, `bun run build`, `bun run test`, and GitHub's `Storefront browser QA`. Browser automation uses ephemeral local credentials; test screenshots contain synthetic data only and expire from CI artifacts after 7 days.
- Browser checks are automated smoke/a11y heuristics (RTL, overflow, keyboard focus and accessible labels). They do **not** replace screen-reader audits, WCAG contrast analysis, manual device testing, security penetration testing or a real authenticated production owner-flow review.
- No new release flags are enabled. All five markets remain blocked from real commercial operations pending the blueprint's evidence and supplier gates.
