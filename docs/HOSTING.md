# Hosting — storefront on Cloudflare Workers (staging)

The storefront (TanStack Start, built by Nitro with the `cloudflare-module` preset) deploys as one Cloudflare Worker that serves all five markets (`/sa /ae /om /eg /iq`).

| Item | Value |
|---|---|
| Worker | `yawmiyati-storefront-staging` (name set in `wrangler.jsonc`, merged into the generated `.output/server/wrangler.json`) |
| Build command | `bun install --frozen-lockfile && bun run build` |
| Deploy command | `npx wrangler deploy` (Nitro writes `.wrangler/deploy/config.json` pointing at the generated config) |
| Public config | `.env.production` — Supabase URL + publishable key only (public by design) |
| Indexing | Blocked: every page renders `<meta name="robots" content="noindex,nofollow">` until launch approval |
| Production branch | `main`; every other branch gets a preview URL |

Separate and untouched: `yawmiyati-owner-staging` (standalone owner Worker from `workers/owner-preview`). Do not overwrite it with the storefront build.

## One-time connection (owner, ~3 minutes)
Cloudflare dashboard → Workers & Pages → Create → Import a repository → connect GitHub as `rashidhamzy-hue` → choose `yawmiyati` → project name `yawmiyati-storefront-staging` → build command and deploy command as above → Deploy.
After that, every merge to `main` redeploys automatically and every pull request gets its own preview link.

## Later (launch only, owner approval)
Custom domain `yawmiyati.com` on the Worker, remove noindex, production Supabase plan.
