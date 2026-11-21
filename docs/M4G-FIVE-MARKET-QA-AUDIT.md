> **21 November 2026 M4I update:** Egypt's shipping-fee table, originally missing at the M4G audit, has since been supplied via an image with EGP 95/100/105 destination bands. Preserve the historical audit record below; the *remaining* Egypt blocker is current rate confirmation, unsupported/unknown destinations, legal review and authorization for checkout, not absence of the screenshot. Refer to `docs/M4I-EGYPT-SHIPPING-SCREENSHOT.md`.

# Yawmiyati M4G — Five-Market QA and Evidence-Based Release Audit

**Audit date:** 21 November 2026. **Baseline:** M4F PR #98 merged into `main` at `0adcd41f6b5d89f6c1e3902fdd0d16689f71b668`. **Access:** source repository + GitHub Actions results only. No supplier, deployment, live staging owner account, production database, DNS or paid model was accessed.

## Summary

The system has a tested Arabic-first five-market source foundation, not an operational cross-border ecommerce service. The current acceptance benchmark is **source and synthetic browser CI**, not actual end-to-end Taager or order fulfillment. The former supplier staging configuration was retired. Any stale earlier statement implying nine live imports or a functioning Woo/Taager connector is **historical** and must not be treated as current evidence. Do not use the old `docs/HANDOFF-STATUS.md` snapshot as an authoritative live-state report; use this audit, `docs/BUILD-TO-LAUNCH-EXECUTION.md`, and the future M4H reconciliation.

## QA findings

| ID | Severity | Observed issue or confirmed boundary | Evidence | Status / owner action |
|---|---|---|---|---|
| QA-01 | High | M4D storefront-truth source scanner had double-escaped quote-detection regex and literal `\\n` line split, letting unqualified delivery figures evade the intended check | `scripts/check-storefront-truth.mjs` | **Fixed in M4G**. Real fixture-based adversarial subprocess tests added to CI. |
| QA-02 | High | No real Taager product import, wholesale costs, verified current inventory, image rights, category/variant mapping or supplier dispatch | `docs/BLUEPRINT-ACCEPTANCE-STATUS.md`, `docs/BUILD-TO-LAUNCH-EXECUTION.md`, `src/lib/store/market-import.server.ts` | **Blocked** until authorized supplier proof; existing Woo reader is not evidence Taager exposes Woo endpoints. |
| QA-03 | High | User-provided supplier shipping quotations are historical and not current checkout prices. Egypt governorate rate table missing; conflicting Iraq supplier return windows | `docs/SUPPLIER-POLICIES-2026-11-20.md`, `src/lib/store/historic-supplier-terms.ts` | **Blocked** from live pricing. Source contains qualified guidance only. |
| QA-04 | High | Public cart, COD order placement, courier handoff, settlement, refund/returns remain simulated or off | `src/lib/store/simulation/`, `src/lib/store/catalog-approval.ts` | **Blocked**; no real orders or dispatch permitted. |
| QA-05 | High | Actual owner mobile sign-in, role permissions, long-running data feeds, staging deployment, real customer order E2E and security testing have not been reverified in this workstream | `src/routes/admin.tsx`, `scripts/m2d-browser-qa.cjs` | **Open**. Local owner QA is a separate synthetic/basic-auth harness, not Supabase owner E2E. |
| QA-06 | High | Source SEO is deliberately nonindexable; canonical, hreflang, sitemap and Product/Offer data must not be inferred from untrusted approvals | `src/lib/store/seo-planning.ts`, `src/lib/store/offline-seo-release.ts`, `src/routes/__root.tsx` | **Correctly blocked** for launch. |
| QA-07 | High | Model adapters exist but no authorized live model execution, automatic translation, approved localized product generation, independent citations, ads or research feed is operational | `src/lib/store/ai-content.server.ts`, `src/lib/store/offline-ai-workflows.ts` | **Correctly blocked** by source-only zero-spend policy. |
| QA-08 | Medium | Catalog product images/variants and real category-filtered results are not populated. Browser CI only proves sample storefront navigation and local synthetic flows | `docs/BLUEPRINT-ACCEPTANCE-STATUS.md`, `scripts/browser-qa.cjs` | **Open**, must test real approved products after provider onboarding. |
| QA-09 | Medium | Browser QA checks layout and interactions for five markets at 320, 390, 768, 1440; real Core Web Vitals, full screen reader accessibility, server auth and production rollback are not established | `scripts/browser-qa.cjs`, `scripts/m2d-browser-qa.cjs` | **CI coverage exists; deeper verification open**. |
| QA-10 | Medium | Existing M3C manifest intentionally snapshots M1–M3B at its Nov 20 baseline; old handoff records carry previously retired supplier status. | `docs/handoff/ENGINEERING-MANIFEST.json`, `docs/HANDOFF-STATUS.md` | **Open for M4H**; preserve historical snapshots and create a current reconciled handoff instead of retroactively claiming earlier checks cover M4F. |
| QA-11 | Medium | Images may depend on external image delivery. CI checks editorial images in its configured runtime, not permanent rights/hosting guarantees | `scripts/browser-qa.cjs`, `docs/EDITORIAL-IMAGE-SOURCES.md` | **Open**: audit legal license and durable hosting before launch. |
| QA-12 | Medium | Full blueprint source PDF was not re-parsed as part of the repository audit; this compares implementation against the existing repo blueprint acceptance map and engineering docs | `docs/BLUEPRINT-ACCEPTANCE-STATUS.md`, `docs/BUILD-TO-LAUNCH-EXECUTION.md` | **Explicit scope limitation**; M4H handoff should link the original master blueprint and classify each requirement precisely. |

## Market readiness

| Market | Currency precision | Supplier shipping quotation in repo | Confirmed price for real checkout | Live supplier & checkout |
|---|---|---|---|---|
| SA | SAR 2 | SAR 28 (historic) | No | No |
| AE | AED 2 | AED 19 (historic) | No | No |
| OM | OMR 3 | OMR 3 (historic) | No | No |
| EG | EGP 2 | Actual governorate fee table missing; delivery-window information exists | No | No |
| IQ | IQD 3 | IQD 7,000 (historic); return-period conflict | No | No |

**All five launch authorizations remain blocked.** Price quotations are planning evidence, not legally binding consumer policy or authenticated supplier fees.

## Work implemented in M4G

1. Fix the broken M4D quote scanner to detect Arabic amounts and split actual source lines.
2. Add `scripts/test-storefront-truth-guard.mjs`: fixture-based executable checks to prove that unqualified prices, legacy cart imports and relaxed noindex fail CI, whereas qualified historic quotations pass.
3. Add `scripts/check-m4g-release-boundary.mjs`: fail-closed source checks for five currencies, historic-only shipping records, disabled paid model/SEO flags, catalog approval requirements and offline modules' absence of network invocations.
4. Wire both checks into Commerce CI without enabling integrations, changing a database or affecting production.
5. Produce this evidence table for the M4H Claude handoff and preserve honest distinctions between source, synthetic test, staging data, deployed runtime and production operation.

## Acceptance and limitations

CI: `node scripts/check-simulation-boundary.mjs`, `node scripts/check-storefront-truth.mjs`, `node scripts/test-storefront-truth-guard.mjs`, `node scripts/check-m4g-release-boundary.mjs`, `node scripts/check-handoff-manifest.mjs`, `bun run build`, `bun run test`, plus the existing GitHub browser QA at five markets × four viewports and local synthetic owner preview at five × four.

Do not describe these as real supplier, AI, checkout, authenticated owner or security penetration tests. **M4G closes a source-QA milestone; it does not close the commercial launch gates.**

**Next:** M4H — current Claude engineering handoff, delta from M3C, PR provenance, required owner approvals and prioritized integration plan.
