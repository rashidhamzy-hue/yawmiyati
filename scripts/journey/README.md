# Test an offer through delivery

Use Node 24 from the repository root. Choose an empty directory for the demo workspace.

```sh
node scripts/catalog/run.mjs demo /tmp/yawmiyati-demo
node scripts/catalog/run.mjs board /tmp/yawmiyati-demo
node scripts/journey/server.mjs /tmp/yawmiyati-demo
```

Open http://127.0.0.1:4175. The local development owner dashboard also links here from the product selection demo. The generated catalog-review.html links to a self-contained browser edition. The server edition persists orders, status and destination previews transactionally in a dedicated SQLite database. The standalone edition uses browser storage for a single-user walkthrough. Both stay outside public catalogs, customer dispatch, paid audiences and owner business totals.

Choose a market and zone, then a placement and campaign. Enable either test destination to inspect its payloads. Search or select a pack, add it, review the cash due and submit. Select the single rack to try an optional matching hook. In Owner results confirm an order before delivering or refusing it. Deliver it first to test a later return or payout credit. Run the three examples twice or reload to check replay behavior.

Expected contribution is per submitted order. The synthetic probability split is 80% retained, 15% refused and 5% delivered then returned. The demo assumes full customer refunds and recoverable returned inventory. Freight is paid once per shipment, and collected customer freight counts only on retained sales. Max acquisition cost is expected contribution before ads minus target contribution. A negative ceiling means the target fails even with free acquisition. Observed paid-media performance and actual settlement are unavailable. Ranking uses contribution per submission, with no measured pack-level conversion uplift. A larger pack may lose on contribution per visitor once conversion is measured.

A supplier pack is a separately stocked SKU. A quantity discount consumes units of the single SKU. The merchant kit needs both parts. Exact tier prices and inventory in this demo are synthetic. The Egyptian clip's standalone cost/floor are EGP 200/220 and its extra-item terms are EGP 131/136 in the supplied screenshot. The latter apply only to the clip portion of the brush kit. Taager Performance Insights shows confirmation and delivery/refund distinctions, but its product analytics denominators, Woo visibility, export columns and payout reconciliation need verification. The previous read-only TasteWP findings are preserved in the integration handoff.

Purchase is server-side on first delivery. Returns reverse retained revenue and contribution on the owner ledger. Payout credit records a distinct event without adding another sale. Pixel and CAPI previews use matching event names and IDs for eligible browser actions. No customer fields, search strings or replay recordings enter analytics. No PostHog or Meta project is contacted. Real Woo read-back, production consent persistence, provider event acceptance, paid audience exclusions and settlement statement reconciliation require separate verification.

Run the regression with `node --test scripts/journey/journey.test.mjs`. The offline catalog CI workflow also exercises the five-country shopper flow in mobile Chrome.
