# Yawmiyati — offline operating and incident runbooks

**Scope:** paper/on-repository procedures only, dated 2026-11-20. No active alerts, provider connections, or production procedures are claimed to be running. These are instructions for a future authenticated implementation, NOT permission to execute one.

## Severity and authority

| Severity | Trigger | Immediate response | Can anyone self-recover? |
|---|---|---|---|
| Blocker | Synthetic catalog on public route, checkout/fulfillment flag unexpectedly ON, live supplier request without written approval, unauthorized credential/PII access | Stop work; prevent further effects; preserve non-sensitive incident record; notify owner | **No** — only explicit owner authorization |
| High | Cross-market leakage, contradictory totals, duplicate supplier submission risk, false delivered/payment evidence, stale stock despite orderability | Disable affected operation using already-approved controls where available; quarantine event; audit idempotency; request human review | No automatic real dispatch |
| Medium | Unknown supplier state, mismatched reconciliation, stale product images/policies, provider timeout | Hold disputed data, mark unavailable or pending, assign manual owner review | Offline diagnosis only |
| Low | UI test/accessibility regression, sparse catalog/SEO metadata | Create tracked issue/PR; run source tests | Yes, source-only fix with review |

**Never** report a synthetic receipt as a real order, supplier acceptance, payment or customer outcome.

## Runbook A — supplier/catalog data freshness failure

1. Detect missing, expired, conflicting or unauthenticated stock/cost observation. The advisory `assessSupplierEvidence` currently regards observations older than 15 minutes as stale; this is **not yet a production SLA**.
2. Keep public catalog publication and checkout OFF; do not infer available inventory from a prior fixture or a supplier screenshot.
3. Record affected market, provider/source ID, observation timestamp, expected currency, evidence revision and reason. Do not paste credentials or customer details into tickets.
4. Require a freshly authenticated source observation and an explicit owner-approved product/media/variant revision **before** a future release workflow could proceed.
5. Check multiple-supplier attribution and market isolation (SA/AE/OM/EG/IQ). A product available in SA is not available in other markets by implication.
6. Re-run `bun run test`, market-specific unit and future integration acceptance tests. No database write until owner explicitly authorizes integration.

## Runbook B — COD quote, shipping or policy uncertainty

1. If supplier cost, return/refusal cost, delivery zone, COD fee, tax or estimated SLA is missing, do **not** treat null as zero. `evaluateCodEvidence` should return `incomplete`.
2. Use `docs/SUPPLIER-POLICIES-2026-11-20.md` only as *historical quotations*, not customer-facing verified policy. Preserve the source and version.
3. Particularly for Egypt: governorate shipping rates are unknown; the 60 EGP amount in synthetic fixtures is invented. **No public Egypt price/shipping promise** based on that number.
4. Hold product/checkout release until seller obligations, local consumer law, courier zone and supplier settlement math are verified and approved.
5. Before any future live sale: display confirmed grand total, delivery/returns terms and clear COD consent; verify that the customer can contact Yawmiyati.

## Runbook C — duplicate order, unknown supplier status or failed delivery

1. Start with a market and internal order ID; distinguish `SIM-` objects from real orders.
2. Treat a repeated idempotency key with a different payload as a conflict; do not resend an order just because the first request timed out.
3. Supplier acknowledgement is NOT customer confirmation; a Woo status alone is NOT proof of delivered shipment or paid COD.
4. Use advisory `assessOrderObservation` to classify transitions as apply/ignore/review; apply only through a future row-locked transactional server pipeline with unique event receipts.
5. Failed or returned orders must not automatically book profit. Require delivery, settlement and returns reconciliation from trustworthy independent evidence.
6. Escalate disputed order/finance state to an authorized operator; record outcome without copying customer PII into PRs.

## Runbook D — outbox retries/dead-letter

1. Existing `createSimulatedOutbox` is **memory-only**. It simulates bounded lease attempts and dead-letter outcomes; it does not survive a crash unless a caller explicitly snapshots and restores.
2. In offline rehearsal, use `SIMULATION_ONLY`, attempt fencing, correct market and an idempotent dedupe key. A stale lease must not complete another attempt.
3. After three failed simulated attempts, mark the job `dead_letter`; no uncontrolled retries or real network calls.
4. Real operations require a separately approved durable queue, row locking, visibility timeout, replay audit and non-sensitive monitoring. Never wire the simulator into a production worker.

## Runbook E — reconciliation discrepancy

1. Compare market-qualified internal orders with independently authenticated remote observations.
2. Classify `missing_remote`, `status_mismatch`, `unmapped_remote`, duplicate ID, unknown state and unverified event timestamps.
3. Freeze only the impacted market/order and investigate; do not mutate financial balances based solely on a missing or inconsistent snapshot.
4. Distinguish supplier accepted, courier delivered, customer received, COD collected, merchant payable, actual merchant payout and return/refund.
5. Preserve a redacted audit trail and require human sign-off before correcting a ledger entry.

## Runbook F — webhook tampering / auth failure

1. Reject modified or unsigned events; no order transition or outbox enqueue from an invalid signature.
2. Do not reveal secrets or full payloads in logs. Preserve provider event ID, redacted source, digest, request time and rejection reason.
3. If a real provider incident is suspected, stop affected processing through previously approved controls, rotate secrets via an authorized owner-controlled procedure and revalidate callbacks.
4. Current M3B HMAC tests are synthetic Node-only checks; a real provider's signature scheme, headers, replay windows and key rotation must be verified separately.

## Runbook G — security, data leak or release-flag drift

1. A customer-facing synthetic listing, secret exposure or unexpectedly enabled live operation is a **blocker**.
2. Halt the proposed work; identify the offending commit, branch/route, market and release-control owner. Do not roll out further changes to investigate.
3. Do not touch third-party projects, shared Supabase organizations, live DNS or production credentials without approval.
4. Record safe evidence; plan a minimal source-only fix, tests, owner review and rollback/restore plan.
5. A real production incident requires independently tested incident response, RLS/security, backups, audit retention and notification obligations—none is represented as currently verified.

## Offline review procedure (already supported)

- Read `docs/M2D-LOCAL-OWNER-REVIEW-QA.md`, generate a temporary credential, run the loopback-only preview, and inspect 5 countries.
- Review M3A's 40 **blocked** gates and M3B's 30 browser-safe fault outputs. Five additional synthetic HMAC cases execute in Node CI.
- Local UI selections or passing tests **never** approve supplier data, policies, public products, advertising or checkout.
- Run CI checks and write one narrowly-scoped PR per milestone. Leave preview server stopped when not needed.

## Evidence checklist for future operator sign-off

Every eventual integration must have: exact provider and country; current contractual source; credential custody and scopes; product/variant/media rights and source revision; rate zones and COD fees; tax/seller legal obligations; events and idempotency; data retention/PII controls; failed-order/return/reconciliation; monitoring; rollback; tested release flag; owner's explicit authorization. Missing fields mean **blocked**.
