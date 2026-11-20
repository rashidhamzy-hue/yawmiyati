# Milestone 3B — deterministic offline failure and recovery rehearsal

Date: 20 November 2026. GitHub-only, $0 spend. Branch based on `main` after M3A #90 was merged.

## What this adds

- `src/lib/store/simulation/failure-rehearsal.ts`: six browser-safe scenarios × five markets = **30 offline cases**, plus five real HMAC signature-tamper tests in the Node-only CI suite = **35 offline cases**. Reuses existing, already-tested pure contracts: `assessSupplierEvidence`, `evaluateCodEvidence`, `createOfflineCommerceSandbox`, `createSimulatedOutbox`, `compareOrderSnapshots` and the synthetic signed-webhook harness.
- `src/test/m3b-failure-rehearsal-panel.tsx`: read-only local owner review of detected synthetic faults and a JSON report; no controls for publishing, dispatch, payments or provider activation.
- `src/test/m2d-owner-review-workspace.tsx`: mounts the panel ONLY within M2D's localhost-only, credential-protected review harness (not `/admin` or the public site).
- `src/test/m3b-failure-rehearsal.test.tsx`: reproducibility, 35 fault detections, all-five-market containment, no live authorization and no outbound fetch.

## Per-market fault cases

1. **Expired stock evidence:** rejects a stock observation older than the existing 15-minute advisory window.
2. **Wrong market/currency and missing cost:** recognizes identity and currency mismatches and missing wholesale-cost evidence.
3. **Incomplete COD/returns economics:** identifies missing outbound shipping, delivered fees, returns costs and delivery probability rather than assuming zero.
4. **Failed order:** rejects premature shipment and attempted delivery from `failed`; duplicate event cannot create a second status transition or payment.
5. **Outbox retries:** verifies attempt fencing, 3 failures → dead letter, deduplication, no late lease and cross-market denial. This uses the existing **in-memory emulator**, not a durable production queue.
6. **Reconciliation exceptions:** finds absent counterpart orders, conflicting states, unrecognized remote orders and duplicate local records in **synthetic snapshots only**.
7. **Tampered signed event (Node CI only):** five separate tests alter a synthetic signed webhook body and verify real HMAC rejection and zero queued jobs. Node cryptography is deliberately never bundled into the browser owner review. It does not authenticate any actual provider.

## Meaning of a pass

`allDetected:true` means the offline test harness successfully detected or rejected every **injected artificial fault**. It is NOT a real integration, authenticated production confirmation, COD settlement, real stock proof, paid service, working courier, signed-off launch, or external security audit. All five markets remain blocked by M3A's 40 launch gates.

## Explicit exclusions

No supplier or Woo/Taager calls, external credentials, production data, online checkout, database migrations/writes, Cloudflare deployment, paid AI, customer information or actual money. The local preview UI cannot generate real purchase actions, alter orders, or authorize a launch.

## Acceptance

Require the existing GitHub CI `node scripts/check-simulation-boundary.mjs`, `bun run build`, `bun run test` and storefront browser QA. Keep PR draft and unmerged until results are reviewed.

## Further offline work

After M3B, build independently reviewed runbooks and a handoff manifest for Claude, including verified file paths, known limitations, country-by-country source requirements and which steps require owner approval. Do not simulate evidence as though it came from real providers.
