# Milestone 1 — Offline foundation and simulation boundary
Date: 20 November 2026. Scope: **GitHub only; zero external integration or spend.**

## Why this exists
The Blueprint v2.2 requires five-country isolation, evidence-backed product selection,
COD lifecycle simulation, budgets, audit logs and deterministic testing **before**
enabling real provider integrations. The existing code already includes market money,
price-risk functions, supplier-evidence checks, import adapters, owner approvals and
a dormant catalog. This milestone **does not duplicate those services**.

## Delivered in PR
- `src/lib/store/simulation/fixtures.ts`: immutable, deterministic catalog,
  30 synthetic products × 5 markets (150 total), 60 synthetic variants/market,
  category coverage, varied stock states, synthetic wholesale costs and explicit
  `mayPublish:false` on every product.
- `src/lib/store/simulation/offline-commerce.ts`: zero-network, in-memory COD
  simulation: market-specific pricing/stock, request idempotency, order-state
  transitions, event deduplication, immutable snapshots.
- `src/test/offline-five-market-simulation.test.ts`: fixture, isolation,
  currency, no-network, stock, replay, mutation and lifecycle failure tests.
- No staging/production DB migrations or data writes. All five real catalog,
  checkout, supplier and AI execution release flags remain unchanged.

## Strict rules
1. **Only import `simulation/` inside test runners and explicitly labeled owner
   *demo* tooling.** Do not import into public storefront, production admin,
   Supabase Edge Functions, checkout API, webhooks, publish workers or adapters.
2. Every item has `synthetic:true`, `kind:"simulation_product"`,
   `mayPublish:false`, an obvious `[تجريبي]` title and synthetic evidence.
   Simulated orders are `SIM-` namespaced, have `supplierAcknowledged:false`
   and `paymentCollected:false`. No fixture is customer-orderable.
3. The simulator requires the exact `SIMULATION_ONLY` mode to create or advance
   an order, deliberately exposes **no network adapter**, and never maps its
   events into verified supplier settlement.
4. Synthetic prices and costs exist for testing; they are not wholesale data,
   verified contribution margin or customer prices. Do not use simulator output
   as real analytics or AI training outcomes without an explicit synthetic label.
5. Saudi 28 SAR, UAE 19 AED, Oman 3 OMR and Iraq 7,000 IQD appear as
   **offline fixture inputs only**. Egypt's 60 EGP test-shipping number is
   deliberately invented for arithmetic coverage because its actual governorate
   matrix is unknown. **Never publish that Egypt figure.**
6. Monetary values are stored in minor units using the existing `markets.ts`
   table, including three decimal places for OMR and IQD (ISO precision).
7. No personally identifiable information is included in fixtures. All
   events are synthetic; no claims of shipment, delivery or settled revenue.
8. Simulation status transitions deliberately do not reuse the
   `assessOrderObservation` provider evidence checker: a fake test event must
   never be treated as authenticated fulfillment proof.

## Existing components reused, not rebuilt
`markets.ts`, `pricing.ts`, `fulfillment-state.ts`,
`supplier-evidence.ts`, `reconciliation.ts`, existing SQL and CI.

## Milestone 1 second PR: adapter boundaries and offline processing
- `src/lib/store/supplier-contracts.ts`: Zod-validated supplier catalog and order receipt contracts; explicit market/currency checks, synthetic identity rejection, typed transport/clock injection interfaces. **No network implementations or credentials.**
- `src/lib/store/simulation/outbox.ts`: deterministic in-memory queue with export/restore snapshots, market-specific deduplication, attempt-fenced leases, bounded retries and dead-letter state. **Not a durable production outbox**; the snapshot must be saved by an external test harness to survive process exit.
- `src/lib/store/simulation/signed-webhook.ts`: synthetic HMAC-signed webhook fixture harness using the existing Woo verification helper. All jobs stay synthetic, nothing changes real supplier order state.
- `src/lib/store/simulation/addresses.ts`: five fake, non-personal country-specific address shapes for future checkout UI testing.
- `scripts/check-simulation-boundary.mjs`: CI check forbidding simulation imports in app/server production source.

## Scope still outstanding in Milestone 1 / next PRs
- No active provider adapters have been connected. Future integrations require authenticated source data, webhook signatures and independent settlement evidence.
- The outbox uses snapshots for offline replay; a real durable queue/database outbox and concurrency locking require a separately approved production milestone.
- Product photo ownership and category-mapping fixtures are deferred to Milestone 2.
- Owner dashboard synthetic-demo integration is deferred to Milestone 3; do not expose fixtures on public routes.
- Extend the CI guard beyond direct import scanning if dynamic loaders or bundler aliases are later added.
- Audit of `src/lib/store/catalog.ts` legacy hard-coded fictional product
  examples before any UI reuse; this file must not provide public products.

## Acceptance for this PR
`bun run build`, `bun run test` and existing browser smoke workflow green;
no external calls or schema mutations; 150 synthetic products isolated by market;
idempotent simulated orders, invalid transitions rejected, zero real dispatch.

## Future integration handoff
Real supplier contracts are **not** inferred from this simulator.
Revisit Blueprint Sections 02–05 and 20–24, plus
`docs/SUPPLIER-POLICIES-2026-11-20.md`, after owner authorization.
