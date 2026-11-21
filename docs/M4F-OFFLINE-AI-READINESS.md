# M4F — Offline AI Research, Copy, Localization and Recommendation Readiness

**Date:** 21 November 2026. **Base:** M4E PR #97 merged into `main` at `33291f996f9360d95f6ac45f04d63765f7730d75`.

## What has been added

`src/lib/store/offline-ai-workflows.ts` prepares deterministic, **offline only** workflows for all five markets: `sa` (`ar-SA`), `ae` (`ar-AE`), `om` (`ar-OM`), `eg` (`ar-EG`), and `iq` (`ar-IQ`).

| Task | Offline implementation | Deliberate limitation |
|---|---|---|
| Product research | Reuses existing source freshness/scoring of profit, demand, viral, pricing, stock, COD and audience evidence | No web/supplier observations acquired; 'verified' flags are untrusted mock values |
| Product copy | Prepares citation-grounded briefs and checks proposed segment/fact IDs | Citations do **not** guarantee claims are supported; human fact, safety, language and copyright review required |
| Arabic localization | Checks distinct source and target countries and uses the market-specific locale | No translation model invoked; native localized nuance and source fidelity not verified |
| Recommendations | Requires separately provided candidate identifiers and product research; refuses to claim that candidates' evidence was checked | No public AI product recommendations; catalog, market, variant and stock provenance must be verified separately |

This extends existing `research-evidence.ts`, `intelligence.ts`, `ai-content.server.ts` and `anthropic-content.server.ts` without editing those provider-facing code paths. The existing server-side provider and persistence adapters are **not enabled, connected or executed** in this milestone.

### Fail-closed return contract

Every review returns:

- `mode: "OFFLINE_ONLY_NO_SPEND"` and `requiresHumanReview: true`.
- `canCallModel: false`, `canPublish: false`, `canLaunchAds: false`, `canSpend: false`, `canRecommendPublicly: false`.
- Source/revision/market mismatch and missing evidence findings for operator review.
- Citation/membership validation and advisory suspicious-claim scanning, **not** substantive entailment assurance.

Market plans retain `activeProvider: false`, `aiDailyBudgetMicrousd: 0`, `autoPublish: false` and `autoAds: false`.

### Approval process required for a future build

1. Independent source verification of the *actual* market product's title, category, legal media rights, supplier identity, inventory/cost and variation matrix.
2. Research source age/credibility audit and consent/privacy clearance. Do not import other sites' text or private user content without permission.
3. Human approval of the exact content revision in the target Arabic dialect, including safety, consumer law, substantiation, accurate country payment/delivery/returns guidance and source attribution.
4. Server-side transactional authorization to generate, budget reservation/usage accounting, bounded token spend, job idempotency, cancellation and rollback.
5. Only when separately authorized: connect a paid model and persistence path in trusted server runtime; never expose provider keys in client code.
6. Isolate promotion or ad campaigns behind an additional independently approved launch and spending gate.

### How to test

```bash
node scripts/check-simulation-boundary.mjs
node scripts/check-storefront-truth.mjs
node scripts/check-handoff-manifest.mjs
bun run build
bun run test
```

Unit tests: `src/test/m4f-offline-ai-workflows.test.ts`, plus prior AI provider/mock and owner/server tests. GitHub storefront browser QA still covers five market previews and local synthetic owner review, not real provider usage.

## Not done, and not implied

No Anthropic API calls, paid AI credits, production prompt executions, real product ingestion, social publishing, advertising, auto-email/WhatsApp messaging, web scraping, real recommendations, actual customer personalization, order placement, Supabase migrations, Cloudflare changes, domain purchases, hosted deployment or indexing.

**Next free milestone:** M4G — full cross-country source, security, UX and QA acceptance/release-blocker audit. M4H — refreshed Claude engineering handoff. Every five-market launch gate remains blocked until genuinely proven.
