// Taager economics (published policy, 26 Nov 2026):
// - Customer pays our product price + Taager's delivery fee (SA 28 SAR, AE 19 AED, OM 3 OMR, EG 95-105 EGP, IQ 7,000 IQD).
// - Delivered order: we earn price - Taager cost. Taager's "minimum selling price" is the floor.
//   Saudi: 15% of profit ADDED above the minimum is deducted as VAT.
// - Refused order: no profit; Egypt charges the merchant 5 EGP, others nothing published.
// - Free delivery (our choice) means we absorb the delivery fee from profit.
// All money is integer minor units. Unknown inputs stay unknown: no price is proposed without cost AND floor.
import { minorToUsd, usdToMinor, type MarketFacts } from "./markets.ts";

export type ProfitInputs = { cost_minor: number; floor_minor: number };

export function profitDelivered(price: number, inp: ProfitInputs, m: MarketFacts, freeDelivery = false): number {
  if (price < inp.floor_minor) throw Error("below_taager_floor");
  const base = inp.floor_minor - inp.cost_minor;
  const added = price - inp.floor_minor;
  const vat = Math.ceil((added * m.vatOnAddedProfitBps) / 10000);
  return base + added - vat - (freeDelivery ? m.shippingMinor : 0);
}

export function expectedPerOrder(profit: number, deliveryRateBps: number, m: MarketFacts): number {
  return Math.floor((profit * deliveryRateBps - m.refusalChargeMinor * (10000 - deliveryRateBps)) / 10000);
}

/** Shopper-friendly price points at or above `from`, up to `to` (minor units). */
export function pricePoints(from: number, to: number, m: MarketFacts): number[] {
  const unit = 10 ** m.minorDigits;
  const out = new Set<number>();
  const ceilTo = (v: number, step: number) => Math.ceil(v / step) * step;
  if (m.currency === "IQD") {
    const step = 500 * unit;
    for (let v = ceilTo(from, step); v <= to; v += step) out.add(v);
  } else if (m.currency === "OMR") {
    const step = unit / 10; // 100 baisa; keep .500 and .900 endings (4.500, 4.900)
    for (let v = ceilTo(from, step); v <= to; v += step) if (v % unit === unit / 2 || v % unit === (unit * 9) / 10) out.add(v);
  } else {
    // ...9 endings: 49, 59, ... 99, 109 ... ; above 300 step 50 (349, 399)
    for (let whole = Math.ceil(from / unit); whole * unit <= to; whole++) {
      const ok = whole < 300 ? whole % 10 === 9 : whole % 50 === 49;
      if (ok) out.add(whole * unit);
    }
  }
  if (!out.size || Math.min(...out) > from) out.add(from); // the floor itself is always a candidate
  return [...out].filter((v) => v >= from && v <= Math.max(to, from)).sort((a, b) => a - b);
}

export type CompetitorEvidence = { retailer: string; url: string; price_minor: number; match: "exact" | "similar"; confidence: number };

/** Relative demand at our delivered total vs the market's delivered reference (no data -> 1). */
export function conversionFactor(ourTotal: number, compTotal: number | null): number {
  if (!compTotal) return 1;
  const r = ourTotal / compTotal;
  if (r <= 0.85) return 1.15;
  if (r <= 1) return 1 + (1 - r);           // up to +15% when cheaper
  return Math.exp(-3 * (r - 1));             // falls quickly when we are dearer
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
}

export type PriceDecision = {
  state: "priced" | "blocked";
  blocked_reason?: string;
  price_minor?: number;
  customer_total_minor?: number;
  profit_delivered_minor?: number;
  expected_profit_per_order_minor?: number;
  expected_profit_usd?: number;
  margin_on_price_pct?: number;
  competitor_reference_minor?: number | null;
  competitor_basis?: "exact" | "similar" | "none";
  competitor_count?: number;
  positioning?: "cheaper" | "matched" | "dearer" | "unknown";
  conversion_factor?: number;
  delivery_rate_bps?: number;
  needs_owner_review?: boolean;
  notes: string[];
};

export function decidePrice(args: {
  inputs: { cost_minor: number | null; floor_minor: number | null; suggested_minor: number | null; max_minor?: number | null };
  competitors: CompetitorEvidence[];
  m: MarketFacts;
  deliveryRateBps?: number | null;
}): PriceDecision {
  const { m } = args;
  const notes: string[] = [];
  const { cost_minor, floor_minor, suggested_minor } = args.inputs;
  if (cost_minor === null || floor_minor === null) return { state: "blocked", blocked_reason: "missing_taager_cost_or_minimum_price", notes };
  if (floor_minor < cost_minor) return { state: "blocked", blocked_reason: "minimum_price_below_cost", notes };
  const rate = args.deliveryRateBps ?? m.defaultDeliveryRateBps;
  const strong = args.competitors.filter((c) => c.match === "exact" && c.confidence >= 0.6);
  const weak = args.competitors.filter((c) => c.match === "similar" && c.confidence >= 0.5);
  const basis = strong.length ? "exact" : weak.length ? "similar" : "none";
  const ref = basis === "exact" ? median(strong.map((c) => c.price_minor)) : basis === "similar" ? median(weak.map((c) => c.price_minor)) : null;
  // Similar items are a weaker anchor: allow a 10% premium for the exact item being sold.
  const compTotal = ref === null ? null : basis === "similar" ? Math.round(ref * 1.1) : ref;
  // Without market evidence never explore upward: use Taager's suggested price if it is above the floor, else the floor.
  const uncapped = compTotal === null ? Math.max(floor_minor, suggested_minor ?? floor_minor) : Math.max(floor_minor * 2, suggested_minor ?? 0, compTotal * 1.2);
  // Never propose more than the supplier accepts (Taager pricingRange.max).
  const ceiling = args.inputs.max_minor && args.inputs.max_minor >= floor_minor ? args.inputs.max_minor : null;
  const top = ceiling === null ? uncapped : Math.min(uncapped, ceiling);
  let best: { price: number; score: number; profit: number; exp: number; f: number } | null = null;
  for (const price of pricePoints(floor_minor, top, m).filter((p) => ceiling === null || p <= ceiling)) {
    const profit = profitDelivered(price, { cost_minor, floor_minor }, m);
    if (profit <= 0) continue;
    const exp = expectedPerOrder(profit, rate, m);
    const f = compTotal === null ? 1 : conversionFactor(price + m.shippingMinor, compTotal);
    const score = exp * f;
    if (!best || score > best.score || (score === best.score && price < best.price)) best = { price, score, profit, exp, f };
  }
  if (!best) return { state: "blocked", blocked_reason: "no_profitable_price", notes };
  const positioning = compTotal === null ? "unknown" : best.price + m.shippingMinor < compTotal * 0.97 ? "cheaper" : best.price + m.shippingMinor <= compTotal * 1.03 ? "matched" : "dearer";
  if (basis === "none") notes.push("No competing retailer found: priced at Taager's minimum/suggested level.");
  if (positioning === "dearer") notes.push("Delivered total is above other retailers even at the best price; demand will be weaker.");
  const thin = best.profit < usdToMinor(2, m);
  if (thin) notes.push("Thin margin (under ~$2 per delivered order): owner review.");
  return {
    state: "priced", price_minor: best.price, customer_total_minor: best.price + m.shippingMinor,
    profit_delivered_minor: best.profit, expected_profit_per_order_minor: best.exp,
    expected_profit_usd: Math.round(minorToUsd(best.exp, m) * 100) / 100,
    margin_on_price_pct: Math.round((best.profit / best.price) * 1000) / 10,
    competitor_reference_minor: compTotal, competitor_basis: basis, competitor_count: basis === "exact" ? strong.length : weak.length,
    positioning, conversion_factor: Math.round(best.f * 100) / 100, delivery_rate_bps: rate,
    needs_owner_review: thin || basis === "none", notes,
  };
}

/**
 * Free-delivery threshold proposal: the smallest shopper-friendly basket value where
 * absorbing the delivery fee still leaves at least the median single-item profit.
 */
export function freeDeliveryThreshold(selected: { price_minor: number; profit_delivered_minor: number }[], m: MarketFacts) {
  if (selected.length < 5) return null;
  const margins = selected.map((s) => s.profit_delivered_minor / s.price_minor).sort((a, b) => a - b);
  const prices = selected.map((s) => s.price_minor).sort((a, b) => a - b);
  const medMargin = margins[Math.floor(margins.length / 2)];
  const medPrice = prices[Math.floor(prices.length / 2)];
  const medProfit = medPrice * medMargin;
  if (medMargin <= 0) return null;
  // basket * margin - shipping >= medProfit  =>  basket >= (medProfit + shipping) / margin
  const raw = Math.max((medProfit + m.shippingMinor) / medMargin, medPrice * 1.5);
  const unit = 10 ** m.minorDigits;
  const step = m.currency === "IQD" ? 5000 * unit : m.currency === "OMR" ? unit : m.currency === "EGP" ? 50 * unit : 50 * unit;
  const threshold = Math.ceil(raw / step) * step;
  return {
    threshold_minor: threshold,
    median_margin_pct: Math.round(medMargin * 1000) / 10,
    median_price_minor: medPrice,
    reasoning: `A basket of ${threshold / unit} ${m.currency} at the median margin (${Math.round(medMargin * 100)}%) still earns about one typical item's profit after we pay the ${m.shippingMinor / unit} ${m.currency} delivery fee.`,
  };
}
