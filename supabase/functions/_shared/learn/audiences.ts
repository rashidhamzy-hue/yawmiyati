// Retargeting audience definitions, ready to create in Meta Ads Manager (Audiences → Custom audience → Website).
// They are DEFINITIONS built on the Pixel's standard events; nobody's data is stored or uploaded by the store.
// Content ids are the product slugs, the same ids the catalogue feed uses.
import type { Market } from "../brain/markets.ts";

export type Audience = { key: string; name: string; event: string; url_contains: string; retention_days: number; exclude: string[]; use_for: string };
export function audienceDefinitions(market: Market): Audience[] {
  const M = market.toUpperCase(), path = `/${market}/`;
  return [
    { key: "viewed_product", name: `YM ${M} · viewed a product · 14d`, event: "ViewContent", url_contains: path, retention_days: 14, exclude: ["purchased_30d", "started_order_14d"], use_for: "Dynamic product ad: the product she looked at (catalogue sales campaign, retargeting)." },
    { key: "added_to_cart", name: `YM ${M} · added to cart · 14d`, event: "AddToCart", url_contains: path, retention_days: 14, exclude: ["purchased_30d"], use_for: "Dynamic product ad with the delivery and cash-on-delivery reassurance; strongest retargeting group." },
    { key: "started_order_14d", name: `YM ${M} · started the order form · 7d`, event: "InitiateCheckout", url_contains: path, retention_days: 7, exclude: ["purchased_30d"], use_for: "Reminder ad with the same product; keep the budget small, the group is small." },
    { key: "purchased_30d", name: `YM ${M} · ordered · 30d`, event: "Purchase", url_contains: path, retention_days: 30, exclude: [], use_for: "Exclusion from every retargeting ad set; later, a seed for a lookalike once there are 100+ delivered orders." },
    { key: "visited_30d", name: `YM ${M} · any visit · 30d`, event: "PageView", url_contains: path, retention_days: 30, exclude: ["purchased_30d"], use_for: "Broad warm audience for new arrivals and seasonal shelves." },
  ];
}
