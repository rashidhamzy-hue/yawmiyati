# Yawmiyati Merchandising Intelligence

Status: database foundation applied to Supabase staging on 26 Nov 2026. Storefront instrumentation and live storefront integration are NOT complete. Owner dashboard is intentionally deferred to Claude.

## Architecture
- Supabase project: skhtunkknshvolturqlm (yawmiyati-staging, Frankfurt); Lovable managed database remains disabled.
- One independent score and decision per market/listing (sa, ae, om, eg, iq).
- PostHog is the behavioural analytics layer; Supabase order records are the source of truth for submitted, delivered, cancelled and returned orders.
- The server-side merchandising scorer writes private snapshots to public.product_merchandising_scores. No anon/authenticated policies or direct public access are granted.
- Storefront must consume only a server-approved promoted collection, never calculate its own ranking or query private score/cost tables.

## Database changes applied
- commerce_analytics_events now supports product_impression, product_click, product_view, add_to_cart, remove_from_cart, checkout_start, order_submitted, order_delivered, order_cancelled and order_returned, plus session, placement, value, currency, source, test marker and properties.
- listing_variants now stores supplier_cost_minor, delivery_cost_minor and other_cost_minor. All values are nullable until verified; never infer unknown costs.
- product_merchandising_scores stores per-market performance metrics, score, confidence, decision state and reasons.
- refresh_product_merchandising_scores(30) calculates a rolling 30-day score using behaviour and authoritative delivered-order data. It excludes is_test=true events.
- Automatic promotion requires published status, positive price, fresh verified stock (within 72 hours), complete cost inputs, positive contribution, at least 100 impressions, at least 3 delivered orders and score >= 60. Otherwise the product remains testing or is suppressed with explicit reasons.
- Score weights: conversion 25%, delivered sales velocity 20%, contribution per impression 20%, add-to-cart rate 15%, CTR 10%, cancellation/return quality 10%.
- Scoring function is restricted to service_role. Score table has RLS enabled and no client policies.

## Important limitations
- Current catalog/listing/order tables are empty. There is no genuine performance signal yet.
- PostHog SDK and storefront event instrumentation have not been verified in the current frontend. Do not claim it is active.
- pg_cron is available but not installed/enabled in this database; hourly scheduling is not active. Do not enable extensions or add scheduled jobs without release review.
- Existing store catalog publication, checkout and fulfillment gates remain OFF. Do not activate them.
- Temporary demo/fixture products and all preview/QA traffic must set is_test=true and must never influence ranking.

## Remaining implementation sequence
1. Verify/implement the Supabase browser/server client using VITE_YAWMIYATI_SUPABASE_URL and VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY only. Never expose service_role or supplier secrets.
2. Add PostHog with market, session, listing, placement, campaign and currency context. Capture impressions only when a product card is actually visible; deduplicate repeated viewport events. Track clicks, views, cart, checkout and order lifecycle.
3. Send commerce events through a JWT-protected Edge Function with strict payload validation, rate limits, idempotency and test/preview environment tagging. Never accept order revenue or delivered status from the browser as authoritative.
4. Record delivered/returned/cancelled outcomes from trusted order-state transitions and reconcile COD delivery before treating a submitted order as a sale.
5. Build a public-safe server RPC for storefront collections that returns only published, fresh-stock, positive-margin promoted listings. Keep score details, cost data and reasons private.
6. Add deterministic fallback rules for cold start: curated/approved launch set with controlled test exposure, not fake popularity. Allocate a small exploration share to new products and reserve the majority for proven winners.
7. Recompute scores on a schedule only after pg_cron is explicitly enabled and reviewed; also refresh after material order/stock changes where safe.
8. Add Claude owner dashboard later: five-market selector, score explanations, winners/losers, funnel diagnostics, cost completeness, manual overrides with audit trail, and test-vs-real data separation.
9. Add tests for cross-market isolation, test-event exclusion, stale stock, missing costs, non-positive contribution, small samples, order deduplication, COD delivered-only sales, and score determinism.

## Product principles
- No product is promoted on clicks alone.
- No new product is punished before it has a fair exploration sample.
- Do not call a product a bestseller without verified sales.
- A submitted COD order is not revenue; delivered and paid/reconciled orders are the commercial truth.
- Do not mix country performance or currencies.
- Manual overrides are time-bounded, market-specific and auditable.
