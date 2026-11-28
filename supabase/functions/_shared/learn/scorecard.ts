// Daily scorecards: what each product and each traffic source did, and what the numbers mean.
// Pure maths on aggregated counts. No visitor, session or customer appears anywhere in this file.
import { minorToUsd, type MarketFacts } from "../brain/markets.ts";

export type ProductCounts = {
  list_impressions: number; list_clicks: number; views: number; scroll_75: number; add_to_cart: number; checkout_starts: number;
  orders: number; confirmed: number; shipped: number; delivered: number; refused: number; returned: number; unreachable: number; cancelled: number;
  profit_delivered_minor: number; refusal_reasons: Record<string, number>;
};
export const EMPTY_COUNTS: ProductCounts = { list_impressions: 0, list_clicks: 0, views: 0, scroll_75: 0, add_to_cart: 0, checkout_starts: 0, orders: 0, confirmed: 0, shipped: 0, delivered: 0,
  refused: 0, returned: 0, unreachable: 0, cancelled: 0, profit_delivered_minor: 0, refusal_reasons: {} };

const rate = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
export type ProductRates = {
  ctr_pct: number | null; add_to_cart_pct: number | null; order_pct: number | null; confirmation_pct: number | null; delivery_pct: number | null;
  /** Share of placed orders that ended delivered, counting only orders that have reached an end state. */
  closed_orders: number; profit_per_delivered_usd: number | null; top_refusal_reason: string | null;
};
export function productRates(c: ProductCounts, m: MarketFacts): ProductRates {
  const closed = c.delivered + c.refused + c.returned + c.unreachable + c.cancelled;
  const top = Object.entries(c.refusal_reasons).sort((a, b) => b[1] - a[1])[0];
  return {
    ctr_pct: rate(c.list_clicks, c.list_impressions), add_to_cart_pct: rate(c.add_to_cart, c.views), order_pct: rate(c.orders, c.views),
    // Confirmed = the call succeeded (it was confirmed, shipped or reached an end state after shipping).
    confirmation_pct: rate(c.confirmed + c.shipped + c.delivered + c.refused + c.returned, c.orders),
    delivery_pct: rate(c.delivered, closed), closed_orders: closed,
    profit_per_delivered_usd: c.delivered > 0 ? Math.round(minorToUsd(c.profit_delivered_minor / c.delivered, m) * 100) / 100 : null,
    top_refusal_reason: top ? top[0] : null,
  };
}

export type Verdict = "push_in_ads" | "price_blocks_sales" | "retire" | "pause_high_refusal" | "watch" | "not_enough_data";
export type ProductVerdict = { verdict: Verdict; why: string };
/** Views a product needs before its conversion is judged, and closed orders before its delivery rate is. */
export const MIN_VIEWS = 150, MIN_CLOSED = 8;

/**
 * What to do with one product, from 14 days of counts.
 * - high refusal: enough closed orders and a delivery rate well under the market's planning rate → pause.
 * - retire: enough views, almost nobody adds it to the cart, no orders.
 * - price blocks sales: she looks and adds to cart but does not order, and our door total is above the shops'.
 * - push in ads: good click-through and add-to-cart, a healthy margin, and no delivery problem.
 */
export function productVerdict(c: ProductCounts, m: MarketFacts, ctx: { planningDeliveryBps: number; marginPct: number | null; doorTotalMinor: number | null; cheapestMinor: number | null; medianMinor: number | null }): ProductVerdict {
  const r = productRates(c, m);
  if (r.closed_orders >= MIN_CLOSED && r.delivery_pct !== null && r.delivery_pct < (ctx.planningDeliveryBps / 100) * 0.6)
    return { verdict: "pause_high_refusal", why: `Only ${r.delivery_pct}% of ${r.closed_orders} finished orders were delivered (planning rate ${Math.round(ctx.planningDeliveryBps / 100)}%)${r.top_refusal_reason ? "; main reason: " + r.top_refusal_reason.replace(/_/g, " ") : ""}.` };
  if (c.views < MIN_VIEWS) return { verdict: "not_enough_data", why: `${c.views} views so far; judged after ${MIN_VIEWS}.` };
  const dearer = ctx.doorTotalMinor !== null && ctx.cheapestMinor !== null && ctx.doorTotalMinor > ctx.cheapestMinor;
  if ((r.add_to_cart_pct ?? 0) < 1.5 && c.orders === 0)
    return dearer ? { verdict: "price_blocks_sales", why: `${c.views} views, ${r.add_to_cart_pct ?? 0}% add to cart, no orders, and our door total is above the cheapest shop.` }
      : { verdict: "retire", why: `${c.views} views, ${r.add_to_cart_pct ?? 0}% add to cart and no orders: shoppers are not interested at any price we can offer.` };
  if ((r.add_to_cart_pct ?? 0) >= 4 && (r.order_pct ?? 0) < 0.5 && dearer)
    return { verdict: "price_blocks_sales", why: `${r.add_to_cart_pct}% add it to the cart but only ${r.order_pct ?? 0}% order; our door total is above the cheapest shop.` };
  const healthy = r.delivery_pct === null || r.closed_orders < MIN_CLOSED || r.delivery_pct >= (ctx.planningDeliveryBps / 100) * 0.9;
  if ((r.add_to_cart_pct ?? 0) >= 4 && (r.ctr_pct === null || r.ctr_pct >= 2) && (ctx.marginPct ?? 0) >= 20 && healthy)
    return { verdict: "push_in_ads", why: `${r.add_to_cart_pct}% add to cart${r.ctr_pct !== null ? `, ${r.ctr_pct}% click-through from listings` : ""}, ${ctx.marginPct}% margin${r.profit_per_delivered_usd !== null ? `, $${r.profit_per_delivered_usd} per delivered order` : ""}.` };
  return { verdict: "watch", why: `${c.views} views, ${r.add_to_cart_pct ?? 0}% add to cart, ${c.orders} orders.` };
}

export type SourceCounts = { visits: number; product_views: number; add_to_cart: number; checkout_starts: number; orders: number; delivered: number; profit_delivered_minor: number };
/** A source is judged by delivered profit, not by orders: COD orders that are refused earn nothing. */
export function sourceRates(c: SourceCounts, m: MarketFacts) {
  return { order_pct: rate(c.orders, c.visits), delivered_pct: rate(c.delivered, c.orders), delivered_profit_usd: Math.round(minorToUsd(c.profit_delivered_minor, m) * 100) / 100,
    profit_per_visit_usd: c.visits > 0 ? Math.round(minorToUsd(c.profit_delivered_minor / c.visits, m) * 1000) / 1000 : null };
}
