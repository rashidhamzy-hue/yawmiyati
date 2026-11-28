// Order-value offers (28 Nov 2026): quantity offers, our own bundles and a free-delivery threshold.
// The brain PROPOSES; the owner approves each one in /admin; the database re-checks every approved offer
// against Taager's current cost on every public read (migration 20261128120000_store_offers.sql).
// Hard rule for everything here: never a loss per delivered order, counting the FULL Taager cost of every
// piece, Saudi VAT, and the delivery fee whenever we are the ones paying it.
// Pure functions, integer minor units, no I/O. Shared by /admin (proposals) and tests.
import { SECTION_AFFINITY } from "./affinity.ts";
import { pricePoints, profitDelivered } from "./economics.ts";
import { minorToUsd, usdToMinor, type MarketFacts } from "./markets.ts";
import { themedBundles, type ThemedBundle } from "./bundles.ts";
import { quantityOffersDual, salePlan, setProfitDual, type TaagerSale } from "./taager-economics.ts";

export type OfferListing = {
  listing_id: string; slug: string; title: string; category: string | null;
  price_minor: number; cost_minor: number; floor_minor: number | null;
  rank: number; image?: string | null; is_bundle?: boolean;
  quantity_offers?: { quantity: number; price_minor: number }[];
  /** Taager's own quantity prices: total minimum price and total cost for N pieces (unproven for our orders until G1). */
  tiers?: { quantity: number; price_minor: number; cost_minor: number }[];
  /** Taager's cost when the product is another product in the same cart (second_placement), if it states one. */
  addon_cost_minor?: number | null;
  /** Taager's sale running now, if any. */
  sale?: TaagerSale | null;
  /** Where our price sits against other shops, from the brain's research (cheaper / matched / dearer / unknown). */
  positioning?: string | null;
  /** The brain priced this product with the delivery fee inside the price (the cost left room above the margin band). */
  priced_with_delivery?: boolean;
};
/** Both figures the owner sees: what an offer earns if Taager applies its quantity/add-on/sale price, and what it earns if not. */
export type TwoFigures = { profit_if_taager_minor: number; profit_if_taager_usd: number; profit_full_minor: number; profit_full_usd: number; basis: "full_cost" | "taager_price" };
export type QuantityProposal = TwoFigures & { kind: "quantity"; listing_id: string; title: string; quantity: number; price_minor: number; saving_minor: number; profit_minor: number; profit_usd: number; single_profit_minor: number };
export type SaleProposal = TwoFigures & { kind: "sale"; listing_id: string; title: string; price_minor: number; saving_minor: number; ends_at: string; reason: string };
export type SaleNote = { listing_id: string; title: string; reason: string; banked_profit_minor: number; banked_profit_usd: number; normal_profit_minor: number; normal_profit_usd: number };
export type BundleProposal = {
  kind: "bundle"; slug: string; title: string; items: { listing_id: string; title: string; quantity: number }[];
  price_minor: number; separate_minor: number; saving_minor: number;
  profit_minor: number; profit_usd: number;
  /** Profit if the supplier ships the pieces as two parcels and we pay the second delivery fee (unproven until G1). */
  profit_if_split_minor: number; profit_if_split_usd: number;
  theme?: string; tagline?: string;
} & Partial<TwoFigures>;
export type FreeDeliveryProposal = {
  kind: "free_delivery"; threshold_minor: number;
  /** A product counts toward the threshold only while its own margin is at least this (checked on every read). */
  min_margin_bps: number;
  eligible: number;
  /** Products left out because a basket made of them would lose money after we pay the delivery fee. */
  excluded: { listing_id: string; title: string; margin_bps: number }[];
  /** Lowest margin among the eligible products: the basket that earns least at the threshold. */
  worst_margin_bps: number; worst_title: string;
  worst_case_profit_minor: number; worst_case_profit_usd: number;
  typical_profit_minor: number; typical_profit_usd: number;
};
export type DeliveryIncludedProposal = { kind: "delivery_included"; listing_id: string; title: string; price_minor: number; profit_minor: number; profit_usd: number; profit_before_minor: number };
export type OfferProposals = {
  quantity: QuantityProposal[]; bundles: BundleProposal[]; free_delivery: FreeDeliveryProposal | null; free_delivery_reason: string | null;
  /** Time-limited offers tied to a Taager sale's real end date, and the sales where the brain keeps our price instead. */
  sales: SaleProposal[]; sale_notes: SaleNote[];
  /** Single products whose price can carry the delivery fee. */
  delivery_included: DeliveryIncludedProposal[];
  /** True when the owner switched on "Taager discounts proven" for this market: Taager's prices were used for safety. */
  taager_discounts_proven: boolean;
};

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

/**
 * Every "N for X" offer for a published listing with both profit figures; loss-makers are dropped.
 * Sources: the offers the brain attached at decision time, plus offers worked out now from Taager's quantity prices.
 * Not proven: an offer must earn at least one single sale at the FULL cost of every piece.
 */
export function quantityProposals(listings: OfferListing[], m: MarketFacts, proven = false): QuantityProposal[] {
  const out: QuantityProposal[] = [];
  for (const l of listings) {
    const single = profitDelivered(l.price_minor, l, m);
    const tiers = l.tiers ?? [];
    const fresh = l.tiers ? quantityOffersDual(l.price_minor, l, { tiers }, m, proven) : [];
    const byQty = new Map<number, number>();
    for (const q of l.quantity_offers ?? []) byQty.set(q.quantity, q.price_minor);
    for (const q of fresh) if (proven || !byQty.has(q.quantity)) byQty.set(q.quantity, q.price_minor);
    for (const [quantity, price] of [...byQty].sort((x, y) => x[0] - y[0])) {
      if (!Number.isInteger(quantity) || quantity < 2 || quantity > 5 || price >= quantity * l.price_minor) continue;
      const full = comboProfit([{ ...l, quantity }], price, m);
      const tier = tiers.find((t) => t.quantity === quantity && t.cost_minor < quantity * l.cost_minor);
      const taager = tier ? profitDelivered(price, { cost_minor: tier.cost_minor, floor_minor: tier.price_minor }, m) : full;
      const profit = proven && tier ? taager : full;
      if (profit <= 0 || profit < single) continue;
      out.push({ kind: "quantity", listing_id: l.listing_id, title: l.title, quantity, price_minor: price, saving_minor: quantity * l.price_minor - price,
        profit_minor: profit, profit_usd: usd(profit, m), single_profit_minor: single,
        profit_full_minor: full, profit_full_usd: usd(full, m), profit_if_taager_minor: taager, profit_if_taager_usd: usd(taager, m), basis: proven && tier ? "taager_price" : "full_cost" });
    }
  }
  return out;
}

/** Taager sales running now: a time-limited offer where passing the saving on makes sense, a note where we keep the price. */
export function saleProposals(listings: OfferListing[], m: MarketFacts, now: number, proven = false): { sales: SaleProposal[]; notes: SaleNote[] } {
  const sales: SaleProposal[] = [], notes: SaleNote[] = [];
  for (const l of listings) {
    const plan = salePlan({ price_minor: l.price_minor, inputs: l, sale: l.sale ?? null, positioning: l.positioning ?? undefined, m, now, proven });
    if (!plan) continue;
    if (plan.action === "time_limited_offer" && plan.offer) {
      const o = plan.offer;
      sales.push({ kind: "sale", listing_id: l.listing_id, title: l.title, price_minor: o.price_minor, saving_minor: o.saving_minor, ends_at: o.ends_at, reason: plan.reason,
        profit_full_minor: o.profit_full_minor, profit_full_usd: usd(o.profit_full_minor, m), profit_if_taager_minor: o.profit_if_taager_minor, profit_if_taager_usd: usd(o.profit_if_taager_minor, m), basis: o.basis });
    } else {
      notes.push({ listing_id: l.listing_id, title: l.title, reason: plan.reason, banked_profit_minor: plan.banked_profit_minor, banked_profit_usd: usd(plan.banked_profit_minor, m),
        normal_profit_minor: plan.normal_profit_minor, normal_profit_usd: usd(plan.normal_profit_minor, m) });
    }
  }
  return { sales, notes };
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
      const dual = setProfitDual(items.map((i) => ({ cost_minor: i.cost_minor, quantity: 1, addon_cost_minor: i.addon_cost_minor ?? null })), price, m);
      out.push({
        profit_full_minor: dual.profit_full_minor, profit_full_usd: usd(dual.profit_full_minor, m), profit_if_taager_minor: dual.profit_if_taager_minor, profit_if_taager_usd: usd(dual.profit_if_taager_minor, m), basis: "full_cost",
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
 * Free delivery above a basket of ELIGIBLE products. A product is eligible while its own margin is at least
 * `min_margin_bps`; the threshold is the smallest shopper-friendly basket where even a basket made only of the
 * thinnest eligible product still pays the delivery fee and keeps about US$1. Thin products are excluded and marked
 * instead of dragging the threshold out of reach. The brain picks the rule that leaves the fewest products out while
 * staying reachable (at most 3 typical products) and above a typical single purchase (so it lifts order value).
 */
export function freeDeliveryPlan(listings: OfferListing[], _bundles: unknown, m: MarketFacts, keepUsd = 1): { plan: FreeDeliveryProposal | null; reason: string | null } {
  if (listings.length < 5) return { plan: null, reason: "Fewer than 5 published products: not enough to size a threshold." };
  const rows = listings.map((l) => ({ l, margin: profitDelivered(l.price_minor, l, m) / l.price_minor })).sort((a, b) => a.margin - b.margin || a.l.rank - b.l.rank);
  const prices = listings.map((l) => l.price_minor).sort((a, b) => a - b);
  const medPrice = prices[Math.floor(prices.length / 2)];
  const keep = usdToMinor(keepUsd, m), fee = worstDeliveryFee(m);
  const unit = 10 ** m.minorDigits;
  const step = m.currency === "IQD" ? 5000 * unit : m.currency === "OMR" ? unit : 50 * unit;
  let thinnestTried = 0;
  // Leave out the thinnest 0%, 10% ... 40% of products, in that order of preference.
  for (const share of [0, 0.1, 0.2, 0.3, 0.4]) {
    const cut = Math.floor(rows.length * share);
    const eligible = rows.slice(cut).filter((r) => r.margin > 0);
    if (eligible.length < 3) break;
    const minBps = Math.floor(eligible[0].margin * 10000);
    if (minBps <= 0) continue;
    thinnestTried = thinnestTried || minBps;
    const threshold = Math.ceil(Math.max(((fee + keep) * 10000) / minBps, medPrice * 1.5) / step) * step;
    if (threshold > medPrice * 3) continue;
    const worstProfit = Math.floor((threshold * minBps) / 10000) - fee;
    if (worstProfit < keep) continue;
    const medMargin = eligible[Math.floor(eligible.length / 2)].margin;
    const typical = Math.floor(threshold * medMargin) - fee;
    const excluded = rows.filter((r) => Math.floor(r.margin * 10000) < minBps).map((r) => ({ listing_id: r.l.listing_id, title: r.l.title, margin_bps: Math.floor(r.margin * 10000) }));
    return { plan: { kind: "free_delivery", threshold_minor: threshold, min_margin_bps: minBps, eligible: rows.length - excluded.length, excluded,
      worst_margin_bps: minBps, worst_title: eligible[0].l.title, worst_case_profit_minor: worstProfit, worst_case_profit_usd: usd(worstProfit, m),
      typical_profit_minor: typical, typical_profit_usd: usd(typical, m) }, reason: null };
  }
  return { plan: null, reason: `Margins are too thin for a reachable threshold: even after leaving out the thinnest 40% of products, the basket needed is more than 3 typical products${thinnestTried ? ` (thinnest margin ${Math.round(thinnestTried / 100)}%)` : ""}. Leave free delivery off in this market for now.` };
}

/**
 * Single products whose price can carry the delivery fee: after paying it we still keep at least US$2 and at least
 * 35% of the product's profit. Best-ranked first, at most `limit`.
 */
export function deliveryIncludedProposals(listings: OfferListing[], m: MarketFacts, limit = 8): DeliveryIncludedProposal[] {
  const fee = worstDeliveryFee(m), keep = usdToMinor(2, m);
  const ok = listings.filter((l) => !l.is_bundle).sort((a, b) => a.rank - b.rank).map((l) => ({ l, before: profitDelivered(l.price_minor, l, m) }))
    .filter((x) => x.before - fee >= keep && x.before - fee >= x.before * 0.35);
  // Products the brain priced WITH the fee inside the price always get their offer; the rest fill up to the limit.
  const priced = ok.filter((x) => x.l.priced_with_delivery);
  const rest = ok.filter((x) => !x.l.priced_with_delivery).slice(0, Math.max(0, limit - priced.length));
  return [...priced, ...rest].sort((a, b) => a.l.rank - b.l.rank)
    .map((x) => ({ kind: "delivery_included" as const, listing_id: x.l.listing_id, title: x.l.title, price_minor: x.l.price_minor, profit_minor: x.before - fee, profit_usd: usd(x.before - fee, m), profit_before_minor: x.before }));
}

const withUsd = (b: ThemedBundle, m: MarketFacts): BundleProposal => ({ ...b, items: b.items.map((i) => ({ listing_id: i.listing_id, title: i.title, quantity: i.quantity })),
  profit_full_usd: usd(b.profit_full_minor, m), profit_if_taager_usd: usd(b.profit_if_taager_minor, m) });

export function proposeOffers(args: { market: MarketFacts; listings: OfferListing[]; proven?: boolean; now?: number }): OfferProposals {
  const { market: m, listings } = args;
  const proven = args.proven === true;
  const quantity = quantityProposals(listings, m, proven);
  const safe = listings.map((l) => ({ ...l, quantity_offers: quantity.filter((p) => p.listing_id === l.listing_id).map((p) => ({ quantity: p.quantity, price_minor: p.price_minor })) }));
  // Themed routines first (they read better than a plain pair), then pairs from what is left.
  const themed = themedBundles(safe, m, { proven, splitFeeMinor: worstDeliveryFee(m), limit: 6 });
  const taken = new Set(themed.flatMap((t) => t.items.map((i) => i.listing_id)));
  const pairs = bundleProposals(safe.filter((l) => !taken.has(l.listing_id)), m, Math.max(0, 8 - themed.length));
  const bundles = [...themed.map((t) => withUsd(t, m)), ...pairs];
  const { plan, reason } = freeDeliveryPlan(safe, bundles, m);
  const { sales, notes } = saleProposals(listings, m, args.now ?? Date.now(), proven);
  return { quantity, bundles, free_delivery: plan, free_delivery_reason: reason, sales, sale_notes: notes, delivery_included: deliveryIncludedProposals(safe, m), taager_discounts_proven: proven };
}
