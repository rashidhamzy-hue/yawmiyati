# Session 3 handoff — 28 Nov 2026 ("perfect the whole system as if live")

PRs #199–#211, all merged to `main` on green CI. All session-3 migrations are applied to staging `skhtunkknshvolturqlm` and each one's rollback-only test passed there. Every release flag, checkout flag, assistant switch and autopilot is **off**. Money spent: **$0** (no Anthropic key or owner session was available to the build machine, so no paid call was made).

Status words: VERIFIED LIVE (seen working on deployed staging), DATABASE-TESTED (rollback-only test passed on staging), CI-PASSED (unit tests and build), FIXTURE-ONLY (runs only on made-up data), SOURCE-ONLY (written, never run), NOT BUILT.

| Step | PR | What | Status |
|---|---|---|---|
| 1 Pricing | #199 | Margin band 15–50%, $2 floor per delivered order, just under the cheapest credible competitor, headroom kept for offers, re-price proposals on sync, auto-pause below floor | DATABASE-TESTED |
| 2 Research | #200 | Credible-retailer prices with source and date, median and cheapest, facts only, 14-day cache | DATABASE-TESTED; prompt never run against the paid API |
| 3 Content | #201 | Dialect title, fixed layout, language rules, one rewrite, needs-fix pages not published, FAQ/video structured data, video copies in R2 | DATABASE-TESTED; prompt never run against the paid API |
| 4 Build store | #202 | `/admin` → Build store → N products, resumable, idempotent, capped, live cost in dollars; offers proposed after publish | CI-PASSED; dry run on the real 27 Nov files (SA 100 picked, median margin 23.1%; IQ 100 picked, 15.4%); never run with paid AI |
| 5 Tracking | #203 | Storefront events, WooCommerce order reader, PostHog aggregates, product and source scorecards | DATABASE-TESTED; order reader FIXTURE-ONLY until G1; PostHog queries validated on the live project |
| 6 Daily loop | #204 | Daily function, morning brief in English/USD with Approve all, seasonal calendar, retargeting audiences | DATABASE-TESTED; cron registered but idle until its two Vault secrets exist; autopilot auto-approval NOT BUILT (switch exists, off) |
| 7 Blacklist | #205 | Keyed one-way phone hash + counts, 1 → WhatsApp confirm, 2 → refuse, owner unblock, order-quality queue, privacy text | DATABASE-TESTED; not called by checkout until G3 |
| 8 Ads | #206 | Meta catalogue feed, Google Merchant feed, Pixel + Conversions API with shared event id | CI-PASSED; nothing sent to Meta or Google (no ids) |
| 10 WhatsApp | #207 | Assistant adapter and webhook behind a flag; order status and confirmation by WhatsApp | DATABASE-TESTED; never connected to Meta (no number) |
| 11 SEO | #208 | Sets, offers and the store chooser in sitemaps; canonicals; connector-site runbook and check script | CI-PASSED; indexing off |
| 12 Gaps | #209 | Mother & kids section opened; `/admin` shopper-assistant panel; section names from the market dictionary | DATABASE-TESTED (kids); CI-PASSED |
| 12 Performance | #210 | Layout shift removed, lighter tiles, responsive cart picture | VERIFIED LIVE: layout shift 0.11 → 0.00–0.01; scores 79–86, **target 90 not reached** |
| 13 Tooling | #211 | `Staging SQL` workflow: one reviewed migration or rollback-only test on staging, by hand | VERIFIED LIVE (used for four migrations and five tests) |

## Not finished
- **Performance ≥ 90**: mobile scores on staging after #210 are home 73–86, section 79–84, cart 85. What is left is the 20 KB stylesheet that blocks rendering (0.5–0.8 s) and the hero picture starting about 1.5 s late. Next step: inline the stylesheet in the server HTML and check hydration in a real browser; splitting owner styles out was measured and saves only 6%.
- **Language migration**: 407 of 437 hard-coded strings remain in 15 components (ceilings in `scripts/market-dictionary-ceiling.json`). Story and policy pages not proofread line by line.
- **Paid test** ($3 budget) and "Build store with 10 real Saudi products": not run. It needs the owner's `/admin` session.
- Product page not in the Lighthouse run (no released product on staging).
- Stale-research refresh inside the daily loop; autopilot auto-approval; reading the Taager plugin's own status names (unknown until G1).

## Secrets the owner adds (none are in the repo)
Supabase function secrets: `CRON_SECRET`, `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, `BLACKLIST_HASH_KEY`, later `WOO_<MKT>_URL/KEY/SECRET`, and for WhatsApp the four in `WHATSAPP-CONNECT.md`. Supabase Vault: `yawmiyati_daily_url`, `yawmiyati_cron_secret`. Cloudflare Worker: `META_PIXEL_ID`, `META_CAPI_TOKEN`, build variable `VITE_META_PIXEL_ID`.

## Read next
`CONNECTOR-SITES.md`, `WHATSAPP-CONNECT.md`, `YAWMIYATI-BRAIN.md`, and the tracker (project doc `claude/handover-and-build-plan-2026-11-26.md`).
