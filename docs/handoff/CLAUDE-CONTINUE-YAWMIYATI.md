# Yawmiyati engineering handoff · 22 November 2026

Start with current main in tarikhtube-stack/saudi-store-spark. Read AGENTS.md. Preserve the Lovable storefront and top country navigation. The owner wants five shopping-first Arabic storefronts, automated product intake and evidence-based decisions, with one private owner console. The account transfer is deferred. There is no active yawmiyati.com hosting. TasteWP and manual product imports are outside the current task. Keep real orders, fulfillment, advertising, production tracking and public catalog publishing off.

## Reproduce the working system

Use Node 24. Run from the repository root.

    node scripts/catalog/run.mjs demo /tmp/yawmiyati-demo
    node scripts/catalog/run.mjs board /tmp/yawmiyati-demo
    node scripts/journey/server.mjs /tmp/yawmiyati-demo

The local studio at http://127.0.0.1:4175 supports five markets and Egypt’s three shipping bands. See scripts/journey/README.md for consent, attribution, Woo metadata, COD state transitions, replay and payout semantics. The offline owner catalog, research and approval workflow is documented in docs/handoff/PREHOST-CATALOG.md. The normal storefront runs with the repo dev command. The catalog is first on every country home. With zero released listings it shows illustrated product types linking to their departments. Empty-state cards never assert an available SKU or price.

## Automated catalog intake

The private connected intake uses the existing Woo REST reader, Woo normalization, revision history, selection analysis and review renderer. For a future authorized store, configure YAWMIYATI_WOO_EG_ORIGIN, YAWMIYATI_WOO_EG_KEY and YAWMIYATI_WOO_EG_SECRET in its server environment. Substitute SA, AE, OM or IQ for other stores. Use read access for the product list and the single store currency setting. The owner does not select SKUs or exchange CSVs. The service operator starts the following on a durable host when one is authorized:

    node scripts/catalog/watch.mjs /private/yawmiyati-catalog eg
    # Or perform a single capture for verification:
    node scripts/catalog/run.mjs sync /private/yawmiyati-catalog eg

The watcher takes one or several market codes, reads each Woo catalog every 15 minutes after the previous cycle completes, and generates the private review board after successful reads. It is a foreground service, not a hosted deployment. It uses the existing market-specific Woo catalog as its source. Empty, interrupted or inconsistent snapshots preserve the previous catalog and report an error. Currency mismatches block capture. Data changes invalidate the affected local review evidence. The owner board shows the last successful snapshot; inspect poll failures and freshness before making decisions.

The product read exposes parent Woo ID, SKU, title, category and variation references. Woo parent prices, stock and candidate cost/floor fields are recorded under woo.parentEvidence. Complex quantity tiers and component signals are fingerprinted for change detection. Their exact semantics and child-level commercial terms remain unresolved until supported supplier evidence can be mapped. A directory of Woo listings cannot establish discovery coverage of products that exist only in Taager. Preserve the retired Saudi integration and previous read-only findings. Do not guess partner endpoints, assume a current Taager plugin or promote an observed Woo price to verified landed cost.

## Delivery sequence and acceptance

| Stage | Existing foundation | Acceptance still needed |
|---|---|---|
| 1. Discover | Country-scoped Woo read, pagination, automatic refresh, safe empty/failure handling | Implement or validate a supported supplier catalog feed or bulk connector. Demonstrate a previously unseen supplier SKU reaching an initially empty bridge automatically, including Oman coverage. |
| 2. Screen and rank | Product research, evidence collection, family grouping and offline selection | Prove exact SKU/pack matches, comparable local prices including delivery, usable images, stock freshness and product-level confidence. Surface holds automatically. |
| 3. Choose the offer | Compare single, quantity tier, supplier pack, merchant kit, low-margin add-on and shipping subsidy in the five-country demo | Map real tier floors, conditional add-on costs, delivery, refusals, returns, tax, fees and acquisition cost. Compare expected contribution and customer total before spending on enrichment. |
| 4. Enrich and approve | Fact-based editorial packages, private drafts, approval revisions, localized store and SEO components | Carry selected version through real-source Arabic listing, verified media, SEO metadata, preview and owner batch approval. Invalidate approval if critical inputs change. |
| 5. Merchandise and sell | Product-first country homepages, category/search/detail routes and protected public catalog. Studio has pack selection and optional margin-qualified cart upgrade | Wire approved offer versions and their pack selectors into normal product pages, cart and checkout. Preserve country navigation, mobile legibility and exact total at the door. |
| 6. Measure and fulfill | Local PostHog/Meta previews and replay-safe COD examples | Verify consent/attribution through the normal storefront, Woo read-back and actual provider events. Confirm delivery once before Meta Purchase. Reconcile subsequent refunds and payouts. |
| 7. Operate and launch | Private owner workflows for research, approval and review; simulated homepage/ad recommendations | Automate exception alerts and real outcome reporting; provision durable hosting and backups; verify domain, each bridge, settlement and test destinations before launch approval. |

## Verification

Run the existing three GitHub workflows: Commerce checks, Offline catalog workflow, Storefront browser QA. Key targeted tests:

    node --test scripts/catalog/connected.test.mjs scripts/catalog/egypt-import-check.test.mjs scripts/journey/journey.test.mjs

Connected intake regression uses 51 fixture products across two API pages, repeated and changed captures, wrong currency, empty catalog, and partial failure. Browser QA checks a shopping tile is in the initial viewport in each of the five markets at 320, 390, 768 and 1440 px. Use the PR checks for results on the exact revision. Synthetic product activity stays out of business reporting. A passing test proves behavior against that fixture, not supplier coverage or commercial profitability.
