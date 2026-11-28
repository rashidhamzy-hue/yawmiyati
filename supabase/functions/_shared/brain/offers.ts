// Order-value offers (28 Nov 2026): quantity offers, our own bundles and a free-delivery threshold.
// The brain PROPOSES; the owner approves each one in /admin; the database re-checks every approved offer
// against Taager's current cost on every public read (migration 20261128120000_store_offers.sql).
// Hard rule for everything here: never a loss per delivered order, counting the FULL Taager cost of every
// piece, Saudi VAT, and the delivery fee whenever we are the ones paying it.
// Pure functions, integer minor units, no I/O. Shared by /admin (proposals) and tests.
import { SECTION_AFFINITY } from "./affinity.ts";
import { pricePoints, profitDelivered } from "./economics.ts";
import { minorToUsd, usdToMinor, type MarketFacts } from "./markets.ts";

export type OfferListing = {
  listing_id: string; slug: string; title: string; category: string | null;
  price_minor: number; cost_minor: number; floor_minor: number | null;
  rank: number; image?: string | null; is_bundle?: boolean;
  quantity_offers?: { quantity: number; price_minor: number }[];
};
export type QuantityProposal = { kind: "quantity"; listing_id: string; title: string; quantity: number; price_minor: number; saving_minor: number; profit_minor: number; profit_usd: number; single_profit_minor: number };
export type BundleProposal = {
  kind: "bundle"; slug: string; title: string; items: { listing_id: string; title: string; quantity: number }[];
  price_minor: number; separate_minor: number; saving_minor: number;
  profit_minor: number; profit_usd: number;
  /** Profit if the supplier ships the pieces as two parcels and we pay the second delivery fee (unproven until G1). */
  profit_if_split_minor: number; profit_if_split_usd: number;
};
export type FreeDeliveryProposal = {
  kind: "free_delivery"; threshold_minor: number;
  /** Lowest margin among everything a shopper can buy: the basket that earns least at the threshold. */
  worst_margin_bps: number; worst_title: string;
  worst_case_profit_minor: number; worst_case_profit_usd: number;
  typical_profit_minor: number; typical_profit_usd: number;
};
export type OfferProposals = { quantity: QuantityProposal[]; bundles: BundleProposal[]; free_delivery: FreeDeliveryProposal | null; free_delivery_reason: string | null };

/** The highest delivery fee we could have to pay in this market (Egypt's dearest band is 105 EGP). */
export const worstDeliveryFee = (m: MarketFacts) => (m.currency === "EGP" ? Math.max(m.shippingMinor, 10500) : m.shippingMinor);
const usd = (minor: number, m: MarketFacts) => Math.round(minorToUsd(minor, m) * 100) / 100;
const words = (t: string) => new Set(t.normalize("NFKC").replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3));
function sameness(a: string, b: string): number {
  const x = words(a), y = words(b); const min = Math.min(x.size, y.size);
  if (!min) return 0; let n = 0; for (const w of x) if (y.has(w)) n++; return n / min;
}

/**
 * Delivered profit of several pieces sold together for one price, lowest case: full cost of every piece and
 * VAT on ALL of the profit (how the supplier computes VAT for several pieces in one order is unproven until G1).
 * The database uses the same rule (store_offer_state).
 */
export function comboProfit(items: { cost_minor: number; quantity: number }[], price: number, m: MarketFacts, weAbsorbDelivery = false): number {
  const cost = items.reduce((s, i) => s + i.cost_minor * i.quantity, 0);
  return profitDelivered(price, { cost_minor: cost, floor_minor: null }, m, weAbsorbDelivery);
}

/** Every "N for X" offer the brain attached to a published listing, with its profit; loss-makers are dropped. */
export function quantityProposals(listings: OfferListing[], m: MarketFacts): QuantityProposal[] {
  const out: QuantityProposal[] = [];
  for (const l of listings) {
    const single = profitDelivered(l.price_minor, l, m);
    for (const q of l.quantity_offers ?? []) {
      if (!Number.isInteger(q.quantity) || q.quantity < 2 || q.quantity > 5 || q.price_minor >= q.quantity * l.price_minor) continue;
      const profit = comboProfit([{ ...l, quantity: q.quantity }], q.price_minor, m);
      if (profit <= 0 || profit < single) continue;
      out.push({ kind: "quantity", listing_id: l.listing_id, title: l.title, quantity: q.quantity, price_minor: q.price_minor, saving_minor: q.quantity * l.price_minor - q.price_minor, profit_minor: profit, profit_usd: usd(profit, m), single_profit_minor: single });
    }
  }
  return out;
}

/**
 * Our own two-piece sets. Pieces are published single products from sections the brain pairs together;
 * supplier bundles are never used as pieces and nothing is inferred about what a product contains.
 * A set must earn at least as much as the better of its two single sales, and must still earn money if the
 * supplier ships it as two parcels and we pay the second delivery fee.
 */
export function bundleProposals(listings: OfferListing[], m: MarketFacts, limit = 8): BundleProposal[] {
  const singles = listings.filter((l) => !l.is_bundle && l.category).sort((a, b) => a.rank - b.rank);
  const used = new Set<string>(), out: BundleProposal[] = [];
  for (const a of singles) {
    if (out.length >= limit) break;
    if (used.has(a.listing_id)) continue;
    const partners = (SECTION_AFFINITY as Record<string, readonly string[]>)[a.category as string] ?? [];
    const candidates = singles.filter((b) => b.listing_id !== a.listing_id && !used.has(b.listing_id) && b.price_minor <= a.price_minor && sameness(a.title, b.title) < 0.5 && (partners.includes(b.category as string) || b.category === a.category))
      .sort((x, y) => Number(partners.includes(y.category as string)) - Number(partners.includes(x.category as string)) || x.rank - y.rank);
    for (const b of candidates) {
      const separate = a.price_minor + b.price_minor;
      const items = [{ ...a, quantity: 1 }, { ...b, quantity: 1 }];
      const profitA = profitDelivered(a.price_minor, a, m), profitB = profitDelivered(b.price_minor, b, m);
      // About 8% under buying the two singly, on a shopper-friendly price point.
      const points = pricePoints(a.cost_minor + b.cost_minor + 1, Math.floor(separate * 0.92), m).filter((p) => p < separate);
      const price = points.length ? Math.max(...points) : null;
      if (price === null) continue;
      const profit = comboProfit(items, price, m), split = profit - worstDeliveryFee(m);
      if (profit < Math.max(profitA, profitB) || split <= 0) continue;
      out.push({
        kind: "bundle", slug: `set-${a.slug}-${b.slug}`.slice(0, 120), title: `${shortTitle(a.title)} + ${shortTitle(b.title)}`,
        items: [{ listing_id: a.listing_id, title: a.title, quantity: 1 }, { listing_id: b.listing_id, title: b.title, quantity: 1 }],
        price_minor: price, separate_minor: separate, saving_minor: separate - price,
        profit_minor: profit, profit_usd: usd(profit, m), profit_if_split_minor: split, profit_if_split_usd: usd(split, m),
      });
      used.add(a.listing_id); used.add(b.listing_id);
      break;
    }
  }
  return out;
}
const shortTitle = (t: string) => { const w = t.split(/\s+/).slice(0, 5).join(" "); return w.length > 46 ? w.slice(0, 44).trim() + "…" : w; };

/**
 * Free delivery above a basket value, sized so that even the least profitable basket still earns money after
 * we pay the delivery fee (not the median basket: the worst one). Returns null with a reason when the numbers
 * do not allow an offer a shopper could realistically reach.
 */
export function freeDeliveryPlan(listings: OfferListing[], bundles: Pick<BundleProposal, "price_minor" | "profit_minor" | "title">[], m: MarketFacts, keepUsd = 1): { plan: FreeDeliveryProposal | null; reason: string | null } {
  if (listings.length < 5) return { plan: null, reason: "Fewer than 5 published products: not enough to size a threshold." };
  const points: { title: string; price: number; profit: number }[] = [];
  for (const l of listings) {
    points.push({ title: l.title, price: l.price_minor, profit: profitDelivered(l.price_minor, l, m) });
    for (const q of l.quantity_offers ?? []) points.push({ title: `${q.quantity} × ${l.title}`, price: q.price_minor, profit: comboProfit([{ ...l, quantity: q.quantity }], q.price_minor, m) });
  }
  for (const b of bundles) points.push({ title: b.title, price: b.price_minor, profit: b.profit_minor });
  const worst = points.reduce((w, p) => (p.profit / p.price < w.profit / w.price ? p : w));
  const worstMargin = worst.profit / worst.price;
  if (worstMargin <= 0) return { plan: null, reason: `"${worst.title}" earns nothing at its price, so no basket is safe.` };
  const prices = listings.map((l) => l.price_minor).sort((a, b) => a - b);
  const medPrice = prices[Math.floor(prices.length / 2)];
  const margins = listings.map((l) => profitDelivered(l.price_minor, l, m) / l.price_minor).sort((a, b) => a - b);
  const medMargin = margins[Math.floor(margins.length / 2)];
  const keep = usdToMinor(keepUsd, m);
  const fee = worstDeliveryFee(m);
  const raw = Math.max((fee + keep) / worstMargin, medPrice * 1.5);
  const unit = 10 ** m.minorDigits;
  const step = m.currency === "IQD" ? 5000 * unit : m.currency === "OMR" ? unit : 50 * unit;
  const threshold = Math.ceil(raw / step) * step;
  if (threshold > medPrice * 4) return { plan: null, reason: `The thinnest margin (${Math.round(worstMargin * 100)}% on "${worst.title}") would need a basket of ${threshold / unit} ${m.currency}, more than 4 typical products. Raise that price or leave free delivery off.` };
  const worstProfit = Math.floor(threshold * worstMargin) - fee;
  const typical = Math.floor(threshold * medMargin) - fee;
  return { plan: { kind: "free_delivery", threshold_minor: threshold, worst_margin_bps: Math.floor(worstMargin * 10000), worst_title: worst.title,
    worst_case_profit_minor: worstProfit, worst_case_profit_usd: usd(worstProfit, m), typical_profit_minor: typical, typical_profit_usd: usd(typical, m) }, reason: null };
}

export function proposeOffers(args: { market: MarketFacts; listings: OfferListing[] }): OfferProposals {
  const { market: m, listings } = args;
  const quantity = quantityProposals(listings, m);
  const safe = listings.map((l) => ({ ...l, quantity_offers: (l.quantity_offers ?? []).filter((q) => quantity.some((p) => p.listing_id === l.listing_id && p.quantity === q.quantity)) }));
  const bundles = bundleProposals(safe, m);
  const { plan, reason } = freeDeliveryPlan(safe, bundles, m);
  return { quantity, bundles, free_delivery: plan, free_delivery_reason: reason };
}
