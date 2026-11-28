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

## Domain layout (decided)
One domain, five subfolders: `yawmiyati.shop/sa`, `/ae`, `/om`, `/eg`, `/iq`, with the store chooser at `/`. Every page names itself as canonical; pages that exist in all five stores carry `hreflang` `ar-SA`, `ar-AE`, `ar-OM`, `ar-EG`, `ar-IQ` plus `x-default` (the chooser for home pages, the Saudi page otherwise). `/sitemap.xml` is an index of five per-market sitemaps (shared pages, sections, products, and the offers page and sets while a set is on sale).

The five back-office WooCommerce sites live on hidden subdomains and are set up exactly as written in [handoff/CONNECTOR-SITES.md](handoff/CONNECTOR-SITES.md).

Note: the code uses `yawmiyati.shop` as the production address (`SITE_ORIGIN` in `src/lib/seo/site.ts`). Older notes mention `yawmiyati.com`. The owner confirms which domain he owns before launch; changing it is one constant plus the tests that quote it.

## Later (launch only, owner approval)
Custom domain on the Worker, indexing on (`INDEXING_LIVE` plus the noindex guards in the same PR), production Supabase plan.
