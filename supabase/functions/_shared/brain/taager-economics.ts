// What Taager's own data says about quantity prices, add-on prices and sales (verified on the 27 Nov 2026 Saudi sync):
//   tieredPricing[{quantity, price, profit}]  TOTAL minimum price for N pieces; Taager's cost for N = price - profit.
//                                             2,700 of 2,722 tiered Saudi products cost less per piece from 2 pieces up.
//   discounts[type=second_placement]          minimum price and profit when the product is ANOTHER product in the same cart.
//   discounts[type=sale]                      temporary lower price and cost, usually with startsAt / expiresAt.
//   discounts[type=second_confirmation]       the price Taager's call centre offers during the confirmation call. Researched,
//                                             NOT used for anything (docs/handoff/TAAGER-DISCOUNTS.md).
// Whether Taager applies tier and add-on prices to orders that arrive through WooCommerce is UNPROVEN until G1.
// So every offer carries two figures: what it earns if Taager applies its price, and what it earns at the full unit
// cost. Until the owner switches on "Taager discounts proven" for a market, an offer must be profitable at FULL cost.
// Pure functions, integer minor units, no I/O.
import { pricePoints, profitDelivered, type ProfitInputs } from "./economics.ts";
import type { MarketFacts } from "./markets.ts";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const int = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) ? v : null);

export type TaagerTier = { quantity: number; price_minor: number; cost_minor: number };
export type TaagerAddOn = { price_minor: number; cost_minor: number };
export type TaagerSale = { price_minor: number; cost_minor: number; starts_at: string | null; expires_at: string | null };
export type TaagerFacts = { tiers: TaagerTier[]; addon: TaagerAddOn | null; sale: TaagerSale | null };

/** Reads the facts normalizeTaager stored in an offer's meta (all already in minor units). Unusable rows are dropped. */
export function taagerFacts(meta: Rec | null | undefined): TaagerFacts {
  const m = meta ?? {};
  const tiers: TaagerTier[] = [];
  for (const t of Array.isArray(m.taager_tiers) ? m.taager_tiers : []) {
    if (!isRec(t)) continue;
    const q = int(t.quantity), price = int(t.price_minor), profit = int(t.profit_minor);
    if (!q || q < 2 || q > 10 || price === null || profit === null || profit < 0 || price - profit <= 0) continue;
    tiers.push({ quantity: q, price_minor: price, cost_minor: price - profit });
  }
  let addon: TaagerAddOn | null = null;
  for (const u of Array.isArray(m.taager_upsell_discounts) ? m.taager_upsell_discounts : []) {
    if (!isRec(u) || u.type !== "second_placement") continue;
    const price = int(u.price_minor), profit = int(u.profit_minor);
    if (price !== null && profit !== null && profit >= 0 && price - profit > 0) addon = { price_minor: price, cost_minor: price - profit };
  }
  let sale: TaagerSale | null = null;
  if (isRec(m.taager_sale)) {
    const price = int(m.taager_sale.price_minor), profit = int(m.taager_sale.profit_minor);
    if (price !== null && profit !== null && profit >= 0 && price - profit > 0) {
      sale = { price_minor: price, cost_minor: price - profit, starts_at: typeof m.taager_sale.starts_at === "string" ? m.taager_sale.starts_at : null,
        expires_at: typeof m.taager_sale.expires_at === "string" ? m.taager_sale.expires_at : null };
    }
  }
  return { tiers: tiers.sort((a, b) => a.quantity - b.quantity), addon, sale };
}

/** Taager's total cost for `q` pieces of one product when it applies its quantity price; null when it states none for q. */
export function tierCost(f: Pick<TaagerFacts, "tiers">, q: number, unitCost: number): number | null {
  const t = f.tiers.find((x) => x.quantity === q);
  // A tier that costs more than buying singly is supplier noise (22 Saudi products): ignore it.
  return t && t.cost_minor < q * unitCost ? t.cost_minor : null;
}

/** Taager timestamps come without a zone and are UTC. */
export const taagerTime = (s: string | null | undefined): number => (s ? Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z") : NaN);

export type DualProfit = {
  /** Earned per delivered order if Taager applies its quantity / add-on / sale price (unproven until G1). */
  profit_if_taager_minor: number;
  /** Earned at the full unit cost of every piece: the figure that must be positive until the market is proven. */
  profit_full_minor: number;
  /** Which of the two the never-a-loss rule used. */
  basis: "full_cost" | "taager_price";
};
export type QuantityOfferDual = DualProfit & { quantity: number; price_minor: number; saving_minor: number; profit_delivered_minor: number };

/** Lowest-case multi-piece profit: VAT is taken on everything above `floor` (null: on all of the profit). */
const combo = (price: number, cost: number, floor: number | null, m: MarketFacts) => profitDelivered(price, { cost_minor: cost, floor_minor: floor }, m);

/**
 * "2 for X" ... "4 for X" from our single price and Taager's quantity costs.
 * Not proven: about 10/15/18% off, and the offer must earn at least one single sale's profit at FULL cost.
 * Proven: the offer may also give the shopper half of what Taager's quantity price saves us, and is checked
 * against Taager's quantity cost. Both figures are always returned.
 */
export function quantityOffersDual(price: number, inp: ProfitInputs, facts: Pick<TaagerFacts, "tiers">, m: MarketFacts, proven = false): QuantityOfferDual[] {
  const single = profitDelivered(price, inp, m);
  if (single <= 0) return [];
  const out: QuantityOfferDual[] = [];
  for (const [q, off] of [[2, 0.10], [3, 0.15], [4, 0.18]] as const) {
    const full = q * inp.cost_minor;
    const tier = facts.tiers.find((t) => t.quantity === q);
    const taager = tierCost(facts, q, inp.cost_minor);
    if (q === 4 && taager === null) continue; // four pieces only where Taager itself prices four
    const basisCost = proven && taager !== null ? taager : full;
    const share = proven && taager !== null ? Math.round((full - taager) / 2) : 0;
    const target = Math.floor(q * price * (1 - off)) - share;
    const points = pricePoints(basisCost + 1, target, m).filter((p) => p < q * price);
    if (!points.length) continue;
    const x = Math.max(...points);
    const profitFull = combo(x, full, null, m);
    const profitTaager = taager === null ? profitFull : combo(x, taager, tier ? tier.price_minor : null, m);
    const used = proven && taager !== null ? profitTaager : profitFull;
    if (used < single) continue;
    out.push({ quantity: q, price_minor: x, saving_minor: q * price - x, profit_delivered_minor: used,
      profit_if_taager_minor: profitTaager, profit_full_minor: profitFull, basis: proven && taager !== null ? "taager_price" : "full_cost" });
  }
  return out;
}

export type SetPiece = { cost_minor: number; quantity: number; addon_cost_minor?: number | null };
/**
 * Cost of a mixed set if Taager applies its add-on price: the piece whose add-on price saves least stays at full cost
 * (it is the "first" product), every other piece that has an add-on price counts at that price.
 */
export function setCostIfTaager(pieces: SetPiece[]): number {
  const full = pieces.reduce((s, p) => s + p.cost_minor * p.quantity, 0);
  const savings = pieces.map((p) => (p.addon_cost_minor && p.addon_cost_minor < p.cost_minor ? (p.cost_minor - p.addon_cost_minor) * p.quantity : 0)).sort((a, b) => b - a);
  // One piece must be the first product: drop the smallest saving when every piece has one.
  const usable = savings.every((s) => s > 0) ? savings.slice(0, -1) : savings;
  return full - usable.reduce((s, v) => s + v, 0);
}
export function setProfitDual(pieces: SetPiece[], price: number, m: MarketFacts, proven = false): DualProfit {
  const full = pieces.reduce((s, p) => s + p.cost_minor * p.quantity, 0);
  return { profit_full_minor: combo(price, full, null, m), profit_if_taager_minor: combo(price, setCostIfTaager(pieces), null, m), basis: proven ? "taager_price" : "full_cost" };
}

export type SalePlan = {
  action: "keep_price" | "time_limited_offer";
  reason: string;
  /** What one delivered order earns at our normal price while Taager's sale lasts, if Taager applies it. */
  banked_profit_minor: number;
  normal_profit_minor: number;
  offer?: DualProfit & { price_minor: number; saving_minor: number; ends_at: string };
};
const DAY = 86_400_000;
/** Days kept between the end of our offer and the end of Taager's sale: the confirmation call can take up to 3 days. */
export const SALE_SAFETY_DAYS = 3;

/**
 * Taager lowered its cost for a while. Either keep our price and bank the extra margin, or pass part of the saving on
 * as a genuine offer that ends 3 days before Taager's sale ends.
 * - No end date, or under 2 days of offer left: keep the price (an offer needs a real end date).
 * - Already cheaper than other shops: keep the price (a lower price buys little extra demand).
 * - Matched: pass on a third. Dearer or no market evidence: pass on half.
 * The offer must be at least 5% under our price and, until the market is proven, profitable at the REGULAR cost.
 */
export function salePlan(args: { price_minor: number; inputs: ProfitInputs; sale: TaagerSale | null; positioning?: string; m: MarketFacts; now: number; proven?: boolean }): SalePlan | null {
  const { price_minor: price, inputs, sale, m, now } = args;
  if (!sale || sale.cost_minor >= inputs.cost_minor) return null;
  const starts = taagerTime(sale.starts_at), expires = taagerTime(sale.expires_at);
  if (!Number.isNaN(starts) && starts > now) return null;
  if (!Number.isNaN(expires) && expires <= now) return null;
  const normal = profitDelivered(price, inputs, m);
  const banked = profitDelivered(price, { cost_minor: sale.cost_minor, floor_minor: sale.price_minor }, m);
  const keep = (reason: string): SalePlan => ({ action: "keep_price", reason, banked_profit_minor: banked, normal_profit_minor: normal });
  if (Number.isNaN(expires)) return keep("Taager gives no end date for this sale: no honest end date for an offer, so the price stays and the extra margin is banked.");
  const endsAt = expires - SALE_SAFETY_DAYS * DAY;
  if (endsAt - now < 2 * DAY) return keep("Taager's sale ends too soon to run an offer that closes 3 days before it.");
  if (args.positioning === "cheaper") return keep("Already cheaper than other shops: the extra margin is banked.");
  const share = args.positioning === "matched" ? 1 / 3 : 1 / 2;
  const target = price - Math.round((inputs.cost_minor - sale.cost_minor) * share);
  const basisCost = args.proven ? sale.cost_minor : inputs.cost_minor;
  const points = pricePoints(basisCost + 1, target, m).filter((p) => p <= Math.floor(price * 0.95));
  if (!points.length) return keep("No price at least 5% lower stays profitable at the regular cost.");
  const x = Math.max(...points);
  const profitFull = profitDelivered(x, inputs, m);
  const profitTaager = profitDelivered(x, { cost_minor: sale.cost_minor, floor_minor: sale.price_minor }, m);
  if ((args.proven ? profitTaager : profitFull) <= 0) return keep("The lower price would not earn at the regular cost.");
  return { action: "time_limited_offer", reason: `Taager's sale saves ${inputs.cost_minor - sale.cost_minor} minor units per piece; ${share === 0.5 ? "half" : "a third"} is passed on until 3 days before it ends.`,
    banked_profit_minor: banked, normal_profit_minor: normal,
    offer: { price_minor: x, saving_minor: price - x, ends_at: new Date(endsAt).toISOString(), profit_if_taager_minor: profitTaager, profit_full_minor: profitFull, basis: args.proven ? "taager_price" : "full_cost" } };
}

// ---- Demand signals -----------------------------------------------------------------------------------------------

/** Lower bound of Taager's stock bucket ("from_200_to_210" -> 200, "less_than_10" -> 0, "more_than_1000" -> 1000). */
export function stockLow(bucket: unknown): number | null {
  if (typeof bucket !== "string") return null;
  const from = /^from_(\d+)_to_\d+$/.exec(bucket);
  if (from) return Number(from[1]);
  if (/^less_than_\d+$/.test(bucket)) return 0;
  const more = /^(?:more_than|above)_(\d+)$/.exec(bucket);
  if (more) return Number(more[1]);
  return bucket === "not_available" ? 0 : null;
}

export type StockPoint = { at: string; low: number };
/**
 * Pieces per day leaving Taager's stock over the window, from bucket lower bounds across syncs. Rises (restocks) are
 * ignored, and at least two readings a day apart are needed. This is supplier-wide movement (all merchants), a demand
 * signal, not our own sales.
 */
export function stockVelocity(points: StockPoint[], now: number, windowDays = 14): number | null {
  const pts = points.map((p) => ({ t: Date.parse(p.at), low: p.low })).filter((p) => !Number.isNaN(p.t) && p.t >= now - windowDays * DAY && p.t <= now).sort((a, b) => a.t - b.t);
  if (pts.length < 2) return null;
  const span = pts[pts.length - 1].t - pts[0].t;
  if (span < DAY) return null;
  let sold = 0;
  for (let i = 1; i < pts.length; i++) sold += Math.max(0, pts[i - 1].low - pts[i].low);
  return Math.round((sold / (span / DAY)) * 100) / 100;
}

export type DemandSignals = { velocity_per_day: number | null; confirmation_rate_bps: number | null; is_new: boolean; created_at: string | null };
export function demandSignals(args: { history?: StockPoint[]; confirmationRate?: unknown; createdAt?: unknown; now: number }): DemandSignals {
  const c = typeof args.confirmationRate === "number" && args.confirmationRate > 0 && args.confirmationRate <= 1 ? Math.round(args.confirmationRate * 10000) : null;
  const created = typeof args.createdAt === "string" ? taagerTime(args.createdAt) : NaN;
  return { velocity_per_day: args.history ? stockVelocity(args.history, args.now) : null, confirmation_rate_bps: c,
    is_new: !Number.isNaN(created) && args.now - created <= 30 * DAY, created_at: Number.isNaN(created) ? null : new Date(created).toISOString() };
}
/**
 * Multiplier on a product's ranking score, between 0.85 and 1.45:
 * stock leaving fast (+ up to 30%), a confirmation rate above / below 60% (+-10%), a new arrival (+5%).
 * Products without data stay at 1: missing data never pushes a product down.
 */
export function demandFactor(s: DemandSignals): number {
  let f = 1;
  if (s.velocity_per_day !== null) f += Math.min(0.3, (s.velocity_per_day / 20) * 0.3);
  if (s.confirmation_rate_bps !== null) f += Math.max(-0.15, Math.min(0.1, ((s.confirmation_rate_bps - 6000) / 4000) * 0.1 * 2.5));
  if (s.is_new) f += 0.05;
  return Math.round(Math.max(0.85, Math.min(1.45, f)) * 100) / 100;
}

// ---- Near-identical products under different Taager ids (saves research spend) ---------------------------------------

const tokens = (t: string) => new Set(t.normalize("NFKC").replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 || /^\p{N}$/u.test(w)));
export function titleOverlap(a: string, b: string): number {
  const x = tokens(a), y = tokens(b), min = Math.min(x.size, y.size);
  if (min < 2) return 0;
  let n = 0; for (const w of x) if (y.has(w)) n++;
  return n / min;
}
export type DedupItem = { key: string; sku: string | null; title: string; cost_minor: number | null; score: number; alternatives?: unknown; first_image?: string | null };
/**
 * Groups offers that are the same thing under different Taager ids and returns, for every member that is NOT the best
 * of its group, the key of the one kept. Same thing means one of:
 *   - Taager itself lists one as an EXACT alternative of the other;
 *   - the same first picture;
 *   - titles sharing at least 80% of their words with costs within 20% (several ride-on cars, same blender twice).
 */
export function nearDuplicates(items: DedupItem[]): Map<string, string> {
  const sorted = [...items].sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const altSkus = (i: DedupItem) => new Set((Array.isArray(i.alternatives) ? i.alternatives : []).flatMap((g) => (isRec(g) && Array.isArray(g.alternatives) ? g.alternatives : [g]))
    .map((a) => (isRec(a) && typeof a.sku === "string" ? a.sku : null)).filter((s): s is string => !!s));
  const kept: (DedupItem & { alts: Set<string> })[] = [];
  const dropped = new Map<string, string>();
  for (const it of sorted) {
    const alts = altSkus(it);
    const twin = kept.find((k) => (it.sku && k.alts.has(it.sku)) || (k.sku && alts.has(k.sku))
      || (!!it.first_image && it.first_image === k.first_image)
      || (titleOverlap(it.title, k.title) >= 0.8 && it.cost_minor !== null && k.cost_minor !== null && Math.abs(it.cost_minor - k.cost_minor) <= 0.2 * Math.max(it.cost_minor, k.cost_minor)));
    if (twin) dropped.set(it.key, twin.key); else kept.push({ ...it, alts });
  }
  return dropped;
}
