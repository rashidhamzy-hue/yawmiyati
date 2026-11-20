# START HERE — Claude Code / engineering takeover

You are taking over **Yawmiyati**, an Arabic-first, five-country COD-oriented e-commerce project. **First action: inspect GitHub main and read this handoff.** Do not assume the full Blueprint v2.2 has been built or connected.

## 0. Unambiguous guardrails

**Owner instruction on 20 November 2026:** finish all possible **free, source-only building** first. No Taager integration today, no Woo, no supplier API calls, no paid AI, no real checkout, no real orders, no cloud deployment, no database changes, no purchased domains/services, no ad spend and no transfer to another account unless the owner separately and explicitly authorizes that exact step. Do NOT change any real market release flags. Do NOT connect real customer details to the offline harness.

**Five markets together:** SA, AE, OM, EG, IQ. Keep per-market SKU, currency, price precision, evidence, policy and checkout isolation. Do not weaken M1's `SIMULATION_ONLY` boundary or mount synthetic fixtures in a public route. No product, stock level, delivery charge, refund promise or review invented for sales copy. Legacy `src/lib/store/catalog.ts` contains fictional examples and must not be used as public catalog data.

## 1. Read in this order

1. `docs/handoff/ENGINEERING-HANDOFF.md`
2. `docs/handoff/ENGINEERING-MANIFEST.json`
3. `docs/BLUEPRINT-ACCEPTANCE-STATUS.md`
4. `docs/SUPPLIER-POLICIES-2026-11-20.md`
5. `docs/M1-OFFLINE-SIMULATION.md`
6. `docs/M2-PRODUCT-EXPERIENCE.md`, `docs/M2B-APPROVED-PRODUCT-EXPERIENCE.md`, `docs/M2C-OFFLINE-COD-CHECKOUT.md`, `docs/M2D-LOCAL-OWNER-REVIEW-QA.md`
7. `docs/M3A-OFFLINE-LAUNCH-READINESS.md`, `docs/M3B-OFFLINE-FAILURE-RECOVERY.md`
8. `docs/handoff/OPERATIONS-RUNBOOKS.md`

Use the repo's checked-in code and CURRENT HEAD as authority. The manifest baseline `1a50db53ee78cbb2549cb9e53b9ac44209b053ab` is the commit after M3B, not the permanent head SHA. Old snapshots of staging status are historical. Verify rather than infer new deployment/integration status.

## 2. Reproduce local status

```bash
bun install --frozen-lockfile
node scripts/check-simulation-boundary.mjs
node scripts/check-handoff-manifest.mjs
bun run build
bun run test
```

GitHub Actions workflows:
- `.github/workflows/commerce-checks.yml`
- `.github/workflows/storefront-browser-qa.yml`

Last pre-handoff verified M3B PR #91 had **203 passing unit/component tests across 52 test files and green browser QA**. Re-run; do not simply repeat those numbers as evidence for future commits. Browser QA covers public routes with a local server and separately a credential-gated **local synthetic** owner preview, not real authenticated owner operations. AI, supplier and production connectors are not part of those tests.

## 3. Resume safe building — in this recommended order

**Milestone 4A — source-only storefront truth/SEO audit:**
- Trace all public routes and any legacy fictional `catalog.ts` imports; identify/rewrite unproven price, discount, stock, delivery, return, reviews, guarantees, urgency and country availability claims. Keep categories editorial only when no real approved products exist.
- Audit market canonical URLs, page head metadata, crawler index gating, sitemap/hreflang, JSON-LD and programmatic SEO. Build bounded, differentiated, verified-data-only templates with no thin-page mass publishing. Unit-test all five locales and a set of edge cases.
- Browser QA at 320/390/768/1440 remains mandatory.

**Milestone 4B — approved product/media/variant contracts and fail-closed fixtures:**
- Draft pure validators for real released-media provenance, owner sign-off, allowed hosts, category release, variant matrix and stock TTL. Tests only; no Supabase migration applied, no external calls.

**Milestone 4C — dashboard and legal/consent source UX:**
- Improve empty states, market-selector clarity, review queue and reports (with source evidence only). Label country terms provisional pending legal review. Do not connect or deploy.

**Milestone 4D — security and operational hardening:**
- Broaden import-boundary protection (resolve alias/dynamic imports); validate build outputs for simulation leakage; add dependency/security lint, OWASP-style checklists and redacted handoff artifacts. Do not publish secrets.

At each step: **one focused branch, one tested PR, no blind merge**; report source changes, tests, regressions and limitations. Do not open many PRs at once. Maintain a live `docs/BLUEPRINT-ACCEPTANCE-STATUS.md` with **source / CI / database / deployed / commercial** tiers.

## 4. Before ANY integration or real launch, require owner decision and separate evidence

- Provider integration authorization, chosen identity and country terms; provider's **official API or permitted workflow** (do not scrape private dashboards or bypass auth).
- Source-specific SKU, stock freshness, wholesale cost, supplier evidence revision and content/media rights.
- Zone-specific COD delivery, refusal, returns, tax and customer contact terms; especially **Egypt shipping unknown**.
- RLS and server-side permissions, customer data minimization, consent, durable order queue, signed webhooks, idempotency, reconciliation, backups, incident/rollback.
- Cloud credentials/access boundaries and a confirmed no-side-effects staging test plan, **then** a separate explicit approval for any rollout.
- Five-market readiness signoff or an explicit changed owner strategy.

## 5. Response format for each milestone

1. **Baseline:** main SHA, verified docs, tests before change.
2. **Scope:** free/no-integration exact change and paths.
3. **Implementation:** changed files and decisions.
4. **Safety:** evidence about synthetic isolation and disabled release paths.
5. **Verification:** exact CI run and test counts, UI/browser coverage and known gaps.
6. **PR:** URL, head SHA, draft/merge state; stop for approval unless owner explicitly requested continuation.
7. **Remaining work:** what is only code, what is tested, and what still requires live evidence or explicit authorization.

Do NOT tell the owner the complete website, SEO, AI agents, five shops, Taager and order processing are operational until there is direct evidence for each. The immediate objective is to finish useful free development, then obtain explicit permission for integration/deployment phase.
