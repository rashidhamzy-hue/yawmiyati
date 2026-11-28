import { markets, type MarketCode } from "./markets";
import { MARKETS } from "../../../supabase/functions/_shared/brain/markets";
import { proposeOffers, type OfferListing, type OfferProposals } from "../../../supabase/functions/_shared/brain/offers";

/** Owner-only calls for bundles, discounts and offers. Every function checks store membership in the database. */
export type OwnerOffer = {
  id: string; kind: "quantity" | "bundle" | "free_delivery" | "sale" | "delivery_included"; status: "proposed" | "approved" | "rejected";
  listing_id: string | null; quantity: number | null; price_minor: number; price_usd: number | null; slug: string | null; title: string | null;
  items: { listing_id: string; quantity: number }[]; separate_minor: number | null;
  profit_minor: number | null; profit_usd: number | null; profit_if_split_minor: number | null; profit_if_split_usd: number | null;
  problem: string | null; detail: string | null; shown: boolean;
  /** What the offer earns at the full cost of every piece, and what it earns if Taager applies its own price (unproven until G1). */
  profit_full_minor?: number | null; profit_full_usd?: number | null; profit_taager_minor?: number | null; profit_taager_usd?: number | null;
  starts_at?: string | null; ends_at?: string | null; meta?: { min_margin_bps?: number; theme?: string; tagline?: string } | null; was_price_minor?: number | null;
  taager_discounts_proven?: boolean;
};
export type FreeDeliveryReport = { threshold_minor: number; min_margin_bps: number; eligible: number; excluded: { listing_id: string; title: string; margin_bps: number }[] };
export const OFFER_PROBLEMS: Record<string, string> = {
  product_not_shown: "The product is not on the store right now (hidden, out of stock or stale sync).",
  piece_not_shown: "One of the pieces is not on the store right now.",
  piece_is_supplier_bundle: "A piece is itself a Taager bundle; our sets use single products only.",
  repeated_piece: "The same product appears twice.",
  no_supplier_cost: "Taager's cost is missing.",
  not_cheaper_than_singles: "Not cheaper than buying the pieces one by one.",
  loss: "Would lose money at Taager's current cost.",
  loss_if_two_parcels: "Would lose money if Taager ships it as two parcels.",
  earns_less_than_one_single: "Earns less than selling one piece at full price.",
  no_products_shown: "No products are on the store.",
  loss_on_thinnest_basket: "The least profitable eligible basket would not pay for delivery.",
  no_eligible_products: "No product on the store has enough margin for this rule.",
  too_many_pieces: "A set holds at most four products.",
  not_started: "Starts later.",
  ended: "Its end date has passed.",
  supplier_sale_over: "Taager's sale is over.",
  supplier_sale_ends_sooner: "Taager's sale now ends less than 3 days after this offer.",
  price_changed: "The product's price changed since you approved this.",
  loss_after_delivery: "After paying delivery this product would not earn enough.",
};
export function offersClient(origin: string, publicKey: string, token: string, request: typeof fetch = fetch) {
  const base = new URL(origin);
  if (base.protocol !== "https:" || base.pathname !== "/" || !publicKey || !token) throw Error("Offers configuration unavailable");
  const headers = { apikey: publicKey, authorization: "Bearer " + token, "content-type": "application/json" };
  async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
    const res = await request(new URL("/rest/v1/rpc/" + fn, base), { method: "POST", headers, body: JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw Error(res.status === 401 || res.status === 403 ? "Access denied" : /offer_not_safe/.test(text) ? "This offer is not safe to show right now." : "Offers request failed");
    }
    return res.json() as Promise<T>;
  }
  const check = (m: MarketCode) => { if (!Object.hasOwn(markets, m)) throw Error("Invalid market"); };
  return {
    async list(market: MarketCode): Promise<OwnerOffer[]> { check(market); const rows = await rpc<unknown>("brain_offers_list", { p_store: market }); return Array.isArray(rows) ? rows as OwnerOffer[] : []; },
    /** The owner's switch: on only after G1 proved Taager applies its quantity and add-on prices to our orders. */
    setDiscountsProven(market: MarketCode, proven: boolean) { check(market); return rpc<boolean>("brain_set_discounts_proven", { p_store: market, p_proven: proven }); },
    async freeDeliveryReport(market: MarketCode): Promise<FreeDeliveryReport | null> { check(market); const r = await rpc<unknown>("brain_free_delivery_report", { p_store: market }); return r && typeof r === "object" && Array.isArray((r as FreeDeliveryReport).excluded) ? r as FreeDeliveryReport : null; },
    decide(market: MarketCode, id: string, decision: "approved" | "rejected" | "proposed") { check(market); return rpc<unknown>("brain_offer_decide", { p_store: market, p_offer: id, p_decision: decision }); },
    /** Reads the published products with their costs, works out the offers in the browser, stores them as proposals. */
    async propose(market: MarketCode): Promise<OfferProposals> {
      check(market);
      const inputs = await rpc<{ listings?: unknown; facts?: { taager_discounts_proven?: unknown } }>("brain_offer_inputs", { p_store: market });
      const listings = (Array.isArray(inputs?.listings) ? inputs.listings : []).filter((l): l is OfferListing => !!l && typeof l === "object" && typeof (l as OfferListing).listing_id === "string" && Number.isSafeInteger((l as OfferListing).price_minor) && Number.isSafeInteger((l as OfferListing).cost_minor));
      const proposals = proposeOffers({ market: MARKETS[market], listings, proven: inputs?.facts?.taager_discounts_proven === true });
      const rows = [
        ...proposals.quantity.map((q) => ({ kind: "quantity", listing_id: q.listing_id, quantity: q.quantity, price_minor: q.price_minor })),
        ...proposals.bundles.map((b) => ({ kind: "bundle", slug: b.slug, title: b.title, price_minor: b.price_minor, meta: { theme: b.theme, tagline: b.tagline }, items: b.items.map((i) => ({ listing_id: i.listing_id, quantity: i.quantity })) })),
        ...proposals.sales.map((s) => ({ kind: "sale", listing_id: s.listing_id, price_minor: s.price_minor, ends_at: s.ends_at })),
        ...proposals.delivery_included.map((d) => ({ kind: "delivery_included", listing_id: d.listing_id, price_minor: d.price_minor })),
        ...(proposals.free_delivery ? [{ kind: "free_delivery", price_minor: proposals.free_delivery.threshold_minor, meta: { min_margin_bps: proposals.free_delivery.min_margin_bps } }] : []),
      ];
      if (rows.length) await rpc<unknown>("brain_offers_save", { p_store: market, p_proposals: rows });
      return proposals;
    },
  };
}
