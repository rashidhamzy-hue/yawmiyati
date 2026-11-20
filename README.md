# Yawmiyati — five-market commerce operating system (staging)

**Not commercially launched.** Saudi Arabia is the integration proof for one eventual five-market release (Saudi Arabia, UAE, Oman, Egypt, Iraq). All catalog publication, checkout, fulfillment and AI execution flags are OFF. Do not submit real orders or spend advertising/AI budgets.

## Architecture

- **Frontend:** TanStack Start, React, Arabic/RTL routes; Lovable project [Souq Of Saudi](https://lovable.dev/projects/6bc552b8-1629-4a0b-8706-8bc21c5c1279) designs the frontend. Lovable database is disabled.
- **Backend:** independently managed Supabase staging (Frankfurt), schema under `supabase/migrations`, owner-scoped RPCs and Edge Functions.
- **Supplier:** read-only Saudi WooCommerce/Taager staging integration; temporary TasteWP proof, not production fulfillment or durable hosting.
- **Preview:** Cloudflare Worker `yawmiyati-owner-staging`, with separate private supplier Worker. Deployment of the newer Worker UI is blocked pending authorized release review.
- **AI:** deterministic research and commercial gates; disabled-by-default job budgets and human-reviewed content contracts. No paid model execution is currently active.

## Local verification

Install Bun 1.3.14, then:

```sh
bun install --frozen-lockfile
bun run test
bun run build
```

Optional frontend development: `bun run dev`.

## Browser configuration

Only public staging values should ever use `VITE_`:

```sh
VITE_YAWMIYATI_SUPABASE_URL=https://skhtunkknshvolturqlm.supabase.co
VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY=<your staging publishable key>
```

Leave them unset to see an unconfigured preview. To view the original fictional UI locally **without Supabase configured**, explicitly set `VITE_YAWMIYATI_DEMO=true`. Do not confuse demo products with real supplier stock or run live checkout.

Supabase Edge Function supplier credentials are configured server-side only. Never add Woo credentials, Anthropic keys or service-role keys to browser variables or GitHub.

## What is already validated

The original nine Saudi test candidates were imported during integration proof, then deleted at the owner’s request on 20 Nov 2026. The legacy `sa-supplier-sync` endpoint has been retired (HTTP 410); database migrations and rollback SQL fixtures verify draft creation, release gating and AI-job constraints; all five release flags remain off. CI test success does not mean the React owner UI or updated Cloudflare Worker has been deployed.

## Handoff and operational constraints

Read [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md), [integration contract](docs/INTEGRATION-CONTRACT.md) and [handoff status](docs/HANDOFF-STATUS.md). Do not touch other projects. Complete commercial costs, durable media, source stock verification, buyer flow, actual fulfillment contract, cross-country isolation, responsive Arabic UI and full smoke tests before launch.

Ownership transfers remain pending: repository currently `tarikhtube-stack/saudi-store-spark`, target `rashidhamzy-hue`, external Supabase main account transfer also pending. Preserve project history, project ID and secret bindings.
