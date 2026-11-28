// The morning brief: one page in /admin, in English with US dollars, built from counts the loop already has.
// Pure function: no I/O. Every number in the brief comes from the inputs; nothing is estimated here.
import { minorToUsd, type Market, type MarketFacts } from "../brain/markets.ts";
import { marginBps, netPerDelivered } from "../brain/economics.ts";
import { productRates, productVerdict, sourceRates, type ProductCounts, type SourceCounts, type Verdict } from "./scorecard.ts";
import { audienceDefinitions, type Audience } from "./audiences.ts";
import type { SeasonPlan } from "./seasonal.ts";
import type { RulesBrief } from "../brain/taager-facts.ts";

export type BriefProduct = { listing_id: string; slug: string; title: string; visible: boolean; hidden_reason: string | null; price_minor: number; cost_minor: number | null; floor_minor: number | null;
  cheapest_minor: number | null; median_minor: number | null; counts: ProductCounts; delivery_included?: boolean; has_video?: boolean; image?: string | null };
export type BriefInput = {
  market: Market; m: MarketFacts; day: string; window_days: number; planningDeliveryBps: number;
  products: BriefProduct[]; yesterday: BriefProduct[];
  sources: (SourceCounts & { source: string; medium: string; campaign: string })[];
  orders: { placed: number; delivered: number; refused: number; returned: number; unreachable: number; cancelled: number; open: number; unknown_status: number; profit_delivered_minor: number };
  sync: { last_sync_at: string | null; max_age_hours: number; orders_connected: boolean; analytics_connected: boolean; order_sync_error?: string | null };
  reprice: { changes: number; pauses: number; examples: { title: string; reason: string }[] };
  paused_today: { title: string; reason: string }[];
  add: { sku: string; product_id: number; title: string; why: string; margin_pct: number | null; profit_usd: number | null }[];
  search_gaps: { query: string; searches: number }[];
  offers_waiting: number; seasonal: SeasonPlan[]; spend_today_usd: number; daily_cap_usd: number; notes: string[];
  /** What Taager's information pages changed since the last sync and where they contradict our figures. */
  taager_rules?: RulesBrief | null;
};
export type AdBrief = { listing_id: string; slug: string; title: string; angle: string; creative: string; show_price_usd: number; show_offer: string; target_country: string; why: string };
export type Brief = {
  day: string; market: Market; currency_note: string; headline: string;
  sold: { orders_placed: number; delivered: number; open: number; delivered_profit_usd: number; top: { title: string; orders: number; delivered: number; profit_usd: number }[] };
  refusals: { refused: number; returned: number; unreachable: number; cancelled: number; reasons: { reason: string; orders: number }[]; worst: { title: string; delivery_pct: number | null; why: string }[] };
  push_in_ads: AdBrief[]; price_blocks_sales: { title: string; why: string }[]; retire: { listing_id: string; title: string; why: string }[];
  add: BriefInput["add"]; price_changes: BriefInput["reprice"]; paused: BriefInput["paused_today"]; hidden_now: { reason: string; products: number }[];
  sources: { source: string; visits: number; orders: number; delivered: number; delivered_profit_usd: number; verdict: string }[];
  search_gaps: BriefInput["search_gaps"]; offers_waiting: number; audiences: Audience[]; seasonal: SeasonPlan[];
  health: { sync_age_hours: number | null; sync_ok: boolean; orders_connected: boolean; analytics_connected: boolean; unknown_order_statuses: number; spend_today_usd: number; daily_cap_usd: number; notes: string[] };
  to_approve: { products_to_add: number; products_to_retire: number; price_changes: number; offers: number };
  taager_rules: RulesBrief | null;
  /** What autopilot approved by itself today (only when the owner switched it on). */
  autopilot?: { price_changes: number; retired: number; offers: number; left_for_owner: number; new_products_waiting: number };
};
const usd = (minor: number, m: MarketFacts) => Math.round(minorToUsd(minor, m) * 100) / 100;
const HIDDEN: Record<string, string> = { out_of_stock: "out of stock at Taager", margin_below_floor: "earns under the $2 floor", stale_sync: "Taager sync older than the limit", paused: "paused",
  missing_from_catalogue: "no longer in Taager's catalogue", below_supplier_cost: "price at or under Taager's cost", unpublished: "taken off the store", price_mismatch: "price mismatch", no_supplier_cost: "no Taager cost" };

/** The angle an ad should take for a product, from what shoppers did with it. */
function angle(p: BriefProduct, m: MarketFacts): string {
  const r = productRates(p.counts, m);
  if (p.delivery_included) return "Delivery included: the price she sees is what she pays at the door.";
  if (p.cheapest_minor !== null && p.price_minor + m.shippingMinor < p.cheapest_minor) return "Value: cheaper at the door than other shops, cash on delivery.";
  if ((r.add_to_cart_pct ?? 0) >= 8) return "Desire: shoppers who see it want it; show it in use, one clear benefit.";
  return "Problem and solution: show the everyday problem it solves in the first second.";
}

export function buildBrief(i: BriefInput): Brief {
  const { m } = i;
  const judged = i.products.filter((p) => p.visible).map((p) => {
    // The owner's margin figure: per delivered order after cost, Saudi VAT, undelivered orders (and the fee when delivery is included).
    const net = p.cost_minor === null ? null : netPerDelivered(p.price_minor, { cost_minor: p.cost_minor, floor_minor: p.floor_minor }, m, i.planningDeliveryBps, !!p.delivery_included);
    const marginPct = net === null ? null : Math.round(marginBps(net, p.price_minor) / 10) / 10;
    const v = productVerdict(p.counts, m, { planningDeliveryBps: i.planningDeliveryBps, marginPct, doorTotalMinor: p.price_minor + (p.delivery_included ? 0 : m.shippingMinor), cheapestMinor: p.cheapest_minor, medianMinor: p.median_minor });
    return { p, v, marginPct, rates: productRates(p.counts, m) };
  });
  const by = (verdict: Verdict) => judged.filter((x) => x.v.verdict === verdict);
  const push: AdBrief[] = by("push_in_ads").sort((a, b) => (b.rates.add_to_cart_pct ?? 0) * (b.marginPct ?? 0) - (a.rates.add_to_cart_pct ?? 0) * (a.marginPct ?? 0)).slice(0, 5).map(({ p, v }) => ({
    listing_id: p.listing_id, slug: p.slug, title: p.title, angle: angle(p, m), creative: p.has_video ? "Use the product video (first 3 seconds must show the product in use)." : "Use the first clean product picture; a short video would do better if you can film one.",
    show_price_usd: usd(p.price_minor, m), show_offer: p.delivery_included ? "Delivery included" : "Price + cash on delivery", target_country: m.countryName, why: v.why }));
  const top = [...i.yesterday].filter((p) => p.counts.orders > 0).sort((a, b) => b.counts.orders - a.counts.orders).slice(0, 5)
    .map((p) => ({ title: p.title, orders: p.counts.orders, delivered: p.counts.delivered, profit_usd: usd(p.counts.profit_delivered_minor, m) }));
  const reasons: Record<string, number> = {};
  for (const p of i.products) for (const [k, n] of Object.entries(p.counts.refusal_reasons)) reasons[k] = (reasons[k] ?? 0) + n;
  const hidden: Record<string, number> = {};
  for (const p of i.products) if (!p.visible && p.hidden_reason) hidden[p.hidden_reason] = (hidden[p.hidden_reason] ?? 0) + 1;
  const syncAge = i.sync.last_sync_at ? Math.round((Date.parse(i.day + "T23:59:59Z") - Date.parse(i.sync.last_sync_at)) / 3_600_000) : null;
  const retire = [...by("retire").map(({ p, v }) => ({ listing_id: p.listing_id, title: p.title, why: v.why })),
    ...i.products.filter((p) => p.hidden_reason === "missing_from_catalogue").map((p) => ({ listing_id: p.listing_id, title: p.title, why: "Taager no longer lists this product." }))];
  const delivered = usd(i.orders.profit_delivered_minor, m);
  const sources = i.sources.map((s) => { const r = sourceRates(s, m);
    return { source: [s.source, s.medium, s.campaign].filter(Boolean).join(" / "), visits: s.visits, orders: s.orders, delivered: s.delivered, delivered_profit_usd: r.delivered_profit_usd,
      verdict: s.orders >= 5 && s.delivered === 0 ? "Orders but nothing delivered yet: watch before spending more." : r.delivered_profit_usd > 0 ? `Earned $${r.delivered_profit_usd} delivered${r.profit_per_visit_usd !== null ? ` ($${r.profit_per_visit_usd} per visit)` : ""}.` : s.visits >= 200 && s.orders === 0 ? "Visits without orders." : "Too early to judge." }; })
    .sort((a, b) => b.delivered_profit_usd - a.delivered_profit_usd || b.visits - a.visits).slice(0, 12);
  return {
    day: i.day, market: i.market, currency_note: `US dollars at about ${m.perUsd} ${m.currency} per dollar.`,
    headline: i.orders.placed === 0 && !i.sync.orders_connected ? "No order data yet: the WooCommerce connection for this market is not set up." :
      `Last ${i.window_days} days: ${i.orders.placed} orders, ${i.orders.delivered} delivered, $${delivered} profit from delivered orders.`,
    sold: { orders_placed: i.orders.placed, delivered: i.orders.delivered, open: i.orders.open, delivered_profit_usd: delivered, top },
    refusals: { refused: i.orders.refused, returned: i.orders.returned, unreachable: i.orders.unreachable, cancelled: i.orders.cancelled,
      reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([reason, orders]) => ({ reason: reason.replace(/_/g, " "), orders })),
      worst: by("pause_high_refusal").map(({ p, v, rates }) => ({ title: p.title, delivery_pct: rates.delivery_pct, why: v.why })) },
    push_in_ads: push, price_blocks_sales: by("price_blocks_sales").map(({ p, v }) => ({ title: p.title, why: v.why })), retire,
    add: i.add, price_changes: i.reprice, paused: i.paused_today, hidden_now: Object.entries(hidden).map(([k, n]) => ({ reason: HIDDEN[k] ?? k.replace(/_/g, " "), products: n })),
    sources, search_gaps: i.search_gaps.slice(0, 15), offers_waiting: i.offers_waiting, audiences: audienceDefinitions(i.market), seasonal: i.seasonal,
    health: { sync_age_hours: syncAge, sync_ok: syncAge !== null && syncAge <= i.sync.max_age_hours, orders_connected: i.sync.orders_connected, analytics_connected: i.sync.analytics_connected,
      unknown_order_statuses: i.orders.unknown_status, spend_today_usd: i.spend_today_usd, daily_cap_usd: i.daily_cap_usd, notes: i.notes },
    taager_rules: i.taager_rules ?? null,
    to_approve: { products_to_add: i.add.length, products_to_retire: retire.length, price_changes: i.reprice.changes + i.reprice.pauses, offers: i.offers_waiting },
  };
}
