// Taager economics (published policy, 26 Nov 2026; owner pricing decision 27 Nov 2026):
// - Customer pays our product price + Taager's delivery fee (SA 28 SAR, AE 19 AED, OM 3 OMR, EG 95-105 EGP, IQ 7,000 IQD).
// - Delivered order: we earn price - Taager cost. Saudi: 15% of profit ADDED above Taager's minimum price is deducted as VAT.
// - Taager's minimum and maximum selling prices are reference points, NOT limits (owner, 27 Nov 2026):
//   the brain prices from our cost, the margin and what other shops charge. The only hard rule is never a loss.
//   Whether Taager accepts an order below its minimum or above its maximum is unproven until the first test order (G1),
//   so such prices are marked on the decision.
// - Refused order: no profit; Egypt charges the merchant 5 EGP, others nothing published.
// - Free delivery (our choice) means we absorb the delivery fee from profit.
// All money is integer minor units. No price is proposed without Taager's cost.
import { minorToUsd, usdToMinor, type MarketFacts } from "./markets.ts";

export type ProfitInputs = { cost_minor: number; floor_minor: number | null };

export function profitDelivered(price: number, inp: ProfitInputs, m: MarketFacts, freeDelivery = false): number {
  // VAT applies to profit added above Taager's minimum (no minimum known: treat all profit as added, the cautious case).
  const added = Math.max(0, price - (inp.floor_minor ?? inp.cost_minor));
  const vat = Math.ceil((added * m.vatOnAddedProfitBps) / 10000);
  return price - inp.cost_minor - vat - (freeDelivery ? m.shippingMinor : 0);
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
  if (!out.size || Math.min(...out) > from) out.add(from); // the lower bound itself is always a candidate
  return [...out].filter((v) => v >= from && v <= Math.max(to, from)).sort((a, b) => a - b);
}

export type CompetitorEvidence = {
  retailer: string; url: string; price_minor: number; match: "exact" | "similar"; confidence: number;
  /** The retailer's own delivery charge for this item when the page stated it (null/absent: unknown, counted as 0). */
  delivery_minor?: number | null;
  /** false when the seller looked unreliable during research (no address or policy pages, marketplace reseller with no ratings, price far off the rest). */
  credible?: boolean;
};

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

// ---- Margin band (owner decision, 28 Nov 2026) --------------------------------------------------------------------
// Margin = profit per DELIVERED order after Taager's cost, Saudi VAT and the expected cost of undelivered orders,
// as a share of the selling price. Normal band 15-50%. Hard floor: US$2 per delivered order on every listing.
// Outside the band only with a written reason the owner sees in /admin.
export const MARGIN_BAND = { minBps: 1500, maxBps: 5000, floorUsd: 2 } as const;
/** How far under the cheapest credible shop's door total ours should land ("just under"). */
const UNDERCUT = 0.98;

/** What undelivered orders cost, carried by each delivered one (Egypt's refusal charge; no other market publishes one). */
export function undeliveredCostPerDelivered(deliveryRateBps: number, m: MarketFacts): number {
  if (!m.refusalChargeMinor) return 0;
  const r = Math.min(10000, Math.max(deliveryRateBps, 500));
  return Math.ceil((m.refusalChargeMinor * (10000 - r)) / r);
}
/** The owner's margin figure in minor units: profit per delivered order after cost, VAT and undelivered orders. */
export function netPerDelivered(price: number, inp: ProfitInputs, m: MarketFacts, deliveryRateBps: number, freeDelivery = false): number {
  return profitDelivered(price, inp, m, freeDelivery) - undeliveredCostPerDelivered(deliveryRateBps, m);
}
export const marginBps = (net: number, price: number): number => (price > 0 ? Math.floor((net * 10000) / price) : 0);
export const floorMinor = (m: MarketFacts): number => usdToMinor(MARGIN_BAND.floorUsd, m);

export type MarketReference = { basis: "exact" | "similar" | "none"; count: number; ignored: number; median_minor: number | null; cheapest_minor: number | null; cheapest_retailer: string | null };
/**
 * Door totals of the shops worth comparing with. Exact matches (confidence >= 0.6) win over similar items (>= 0.5,
 * which get a 10% allowance). Sellers marked unreliable are ignored, and so is a price under 40% or over 3x the
 * median of three or more shops (a wrong item, a part, or a seller that will not deliver).
 */
export function marketReference(competitors: CompetitorEvidence[]): MarketReference {
  const usable = competitors.filter((c) => c.credible !== false && c.price_minor > 0);
  const strong = usable.filter((c) => c.match === "exact" && c.confidence >= 0.6);
  const weak = usable.filter((c) => c.match === "similar" && c.confidence >= 0.5);
  const basis = strong.length ? "exact" : weak.length ? "similar" : "none";
  const pool = basis === "exact" ? strong : basis === "similar" ? weak : [];
  const k = basis === "similar" ? 1.1 : 1;
  let rows = pool.map((c) => ({ retailer: c.retailer, total: Math.round((c.price_minor + Math.max(0, c.delivery_minor ?? 0)) * k) }));
  if (rows.length >= 3) {
    const mid = median(rows.map((r) => r.total))!;
    rows = rows.filter((r) => r.total >= mid * 0.4 && r.total <= mid * 3);
  }
  const ignored = competitors.length - rows.length;
  if (!rows.length) return { basis: "none", count: 0, ignored, median_minor: null, cheapest_minor: null, cheapest_retailer: null };
  const cheapest = rows.reduce((a, b) => (b.total < a.total ? b : a));
  return { basis, count: rows.length, ignored, median_minor: median(rows.map((r) => r.total)), cheapest_minor: cheapest.total, cheapest_retailer: cheapest.retailer };
}

export type BandException = { kind: "above_band" | "below_band"; reason: string };
export type PriceOption = { price_minor: number; profit_delivered_minor: number; margin_on_price_pct: number; reason: string };
export type PriceDecision = {
  state: "priced" | "blocked";
  blocked_reason?: string;
  price_minor?: number;
  customer_total_minor?: number;
  /** Profit per delivered order after cost, VAT and the expected cost of undelivered orders (and the fee when delivery is included). */
  profit_delivered_minor?: number;
  expected_profit_per_order_minor?: number;
  expected_profit_usd?: number;
  margin_on_price_pct?: number;
  /** Median door total of the credible shops (similar items carry a 10% allowance). */
  competitor_reference_minor?: number | null;
  competitor_cheapest_minor?: number | null;
  competitor_cheapest_retailer?: string | null;
  competitor_basis?: "exact" | "similar" | "none";
  competitor_count?: number;
  competitors_ignored?: number;
  positioning?: "cheaper" | "matched" | "dearer" | "unknown";
  conversion_factor?: number;
  delivery_rate_bps?: number;
  needs_owner_review?: boolean;
  /** Written reason when the margin is outside 15-50%. The owner sees it in /admin. */
  band_exception?: BandException | null;
  /** The price carries the delivery fee: the cost left room, and it is spent on free delivery instead of a lower price. */
  delivery_included?: boolean;
  /** Room left above the band's top after landing under the cheapest shop: spent on quantity offers, sets and free delivery. */
  headroom_minor?: number;
  /** A cheaper price that would beat the cheapest shop but sits under the 15% band: the owner may choose it as a traffic product. */
  below_band_option?: PriceOption | null;
  /** Our best in-band price is still well above what shops charge. */
  price_blocks_sales?: boolean;
  quantity_offers?: QuantityOffer[];
  /** Where the price sits against Taager's own minimum / maximum (reference only; unproven with Taager until G1). */
  taager_position?: "below_minimum" | "within" | "above_maximum" | "unknown";
  taager_minimum_minor?: number | null;
  notes: string[];
};

type Row = { price: number; net: number; bps: number };
const pct = (bps: number) => Math.round(bps / 10) / 10;

/**
 * One product's price inside the margin band.
 * - With shops to compare: the highest in-band price whose door total (price + delivery fee) is just under the
 *   cheapest credible shop's. If the cost leaves room above the band's top, the room is spent on delivery included
 *   (same door-total rule, margin counted after we pay the fee) rather than on a lower headline price.
 * - Our lowest in-band price above the shops: priced there, marked, and the under-band price is offered as an option.
 * - No shop found: Taager's default selling price, moved into the band.
 * - A cheap item whose US$2 floor needs more than 50%: the lowest price that earns the floor, with the reason written.
 */
export function decidePrice(args: {
  inputs: { cost_minor: number | null; floor_minor: number | null; suggested_minor: number | null; max_minor?: number | null };
  competitors: CompetitorEvidence[];
  m: MarketFacts;
  deliveryRateBps?: number | null;
}): PriceDecision {
  const { m } = args;
  const notes: string[] = [];
  const { cost_minor, floor_minor, suggested_minor } = args.inputs;
  const max_minor = args.inputs.max_minor ?? null;
  if (cost_minor === null || cost_minor <= 0) return { state: "blocked", blocked_reason: "missing_taager_cost", notes };
  const rate = args.deliveryRateBps ?? m.defaultDeliveryRateBps;
  const inputs = { cost_minor, floor_minor };
  const floor = floorMinor(m);
  const ref = marketReference(args.competitors);
  const anchor = Math.max(floor_minor ?? 0, suggested_minor ?? 0);
  if (ref.basis === "none" && anchor <= cost_minor) return { state: "blocked", blocked_reason: "needs_market_research", notes: ["Taager's minimum profit is 0 and no other shop was found: price unknown."] };

  const top = Math.max(cost_minor * 3 + floor * 3 + m.shippingMinor * 2, Math.round((ref.cheapest_minor ?? 0) * 1.3), anchor);
  const rows = (freeDelivery: boolean): Row[] => pricePoints(cost_minor + 1, top, m).map((price) => {
    const net = netPerDelivered(price, inputs, m, rate, freeDelivery);
    return { price, net, bps: marginBps(net, price) };
  });
  const earning = rows(false).filter((r) => r.net >= floor);
  if (!earning.length) return { state: "blocked", blocked_reason: "no_profitable_price", notes };
  const inBand = earning.filter((r) => r.bps >= MARGIN_BAND.minBps && r.bps <= MARGIN_BAND.maxBps);

  let pick: Row;
  let exception: BandException | null = null;
  let deliveryIncluded = false;
  let headroom = 0;
  let belowOption: PriceOption | null = null;
  const targetTotal = ref.cheapest_minor === null ? null : Math.floor(ref.cheapest_minor * UNDERCUT);
  if (!inBand.length) {
    // Margin rises with price, so an empty band means the floor itself needs more than 50%.
    pick = earning[0];
    exception = { kind: "above_band", reason: `Low-cost item: earning the US$${MARGIN_BAND.floorUsd} floor per delivered order needs a ${pct(pick.bps)}% margin, above the 50% band.` };
  } else if (targetTotal === null) {
    pick = [...inBand].reverse().find((r) => r.price <= anchor) ?? inBand[0];
    notes.push(pick.price === anchor ? "No competing retailer found: priced at Taager's default selling price." : "No competing retailer found: Taager's default selling price moved into the 15-50% band.");
  } else {
    const under = inBand.filter((r) => r.price + m.shippingMinor <= targetTotal);
    if (under.length) {
      pick = under[under.length - 1];
      if (pick === inBand[inBand.length - 1]) {
        headroom = Math.max(0, targetTotal - m.shippingMinor - pick.price);
        // Room above the band's top: spend it on delivery included when that earns more and stays in the band.
        const withFee = rows(true).filter((r) => r.net >= floor && r.bps >= MARGIN_BAND.minBps && r.bps <= MARGIN_BAND.maxBps && r.price <= targetTotal && r.price > pick.price);
        const best = withFee[withFee.length - 1];
        if (headroom > 0 && best && best.net > pick.net) {
          pick = best; deliveryIncluded = true;
          notes.push("Taager's cost leaves room: spent on delivery included instead of a lower price. Approve the delivery-included offer with the product.");
        } else if (headroom > 0) notes.push("Taager's cost leaves room above the band: use it for a quantity offer, a set or free delivery.");
      }
    } else {
      pick = inBand[0];
      const cheaper = earning.filter((r) => r.price + m.shippingMinor <= targetTotal);
      const alt = cheaper[cheaper.length - 1];
      if (alt) belowOption = { price_minor: alt.price, profit_delivered_minor: alt.net, margin_on_price_pct: pct(alt.bps),
        reason: `Beating ${ref.cheapest_retailer ?? "the cheapest shop"} needs a ${pct(alt.bps)}% margin, under the 15% band. Choose it only as a deliberate traffic product.` };
    }
  }
  const doorTotal = pick.price + (deliveryIncluded ? 0 : m.shippingMinor);
  const positioning = ref.cheapest_minor === null ? "unknown" : doorTotal < ref.cheapest_minor ? "cheaper" : doorTotal <= (ref.median_minor ?? ref.cheapest_minor) * 1.03 ? "matched" : "dearer";
  const blocksSales = ref.median_minor !== null && doorTotal > ref.median_minor * 1.15;
  const taager_position = floor_minor === null ? "unknown" : pick.price < floor_minor ? "below_minimum" : max_minor !== null && max_minor > 0 && pick.price > max_minor ? "above_maximum" : "within";
  if (taager_position === "below_minimum") notes.push("Priced below Taager's minimum to match the market; confirm Taager accepts it with the first test order.");
  if (taager_position === "above_maximum") notes.push("Priced above Taager's maximum; confirm Taager accepts it with the first test order.");
  if (positioning === "dearer") notes.push("Door total is above the cheapest shop even at the lowest in-band price; demand will be weaker.");
  if (blocksSales) notes.push("Price blocks sales: more than 15% above what shops typically charge.");
  if (exception) notes.push(exception.reason);
  const exp = expectedPerOrder(profitDelivered(pick.price, inputs, m, deliveryIncluded), rate, m);
  const f = conversionFactor(doorTotal, ref.cheapest_minor);
  return {
    state: "priced", price_minor: pick.price, customer_total_minor: doorTotal,
    profit_delivered_minor: pick.net, expected_profit_per_order_minor: exp,
    expected_profit_usd: Math.round(minorToUsd(exp, m) * 100) / 100,
    margin_on_price_pct: pct(pick.bps),
    competitor_reference_minor: ref.median_minor, competitor_cheapest_minor: ref.cheapest_minor, competitor_cheapest_retailer: ref.cheapest_retailer,
    competitor_basis: ref.basis, competitor_count: ref.count, competitors_ignored: ref.ignored,
    positioning, conversion_factor: Math.round(f * 100) / 100, delivery_rate_bps: rate,
    needs_owner_review: !!exception || ref.basis === "none" || blocksSales, band_exception: exception,
    delivery_included: deliveryIncluded, headroom_minor: headroom, below_band_option: belowOption, price_blocks_sales: blocksSales,
    taager_position, taager_minimum_minor: floor_minor,
    quantity_offers: deliveryIncluded ? [] : quantityOffers(pick.price, inputs, m), notes,
  };
}

export type Reprice = { action: "keep" | "change" | "pause"; reason: string; new_price_minor?: number; new_delivery_included?: boolean; decision: PriceDecision };
/**
 * A listing after a new Taager sync or new shop prices. Pause (hidden at once, the database does the same on every
 * read) when the current price earns under the floor; propose a change when the margin left the band without an
 * approved reason or the right price moved by 4% or more; otherwise keep, so prices do not flicker.
 */
export function reprice(args: Parameters<typeof decidePrice>[0] & { current_price_minor: number; current_delivery_included?: boolean; exception_approved?: boolean }): Reprice {
  const { m } = args;
  const decision = decidePrice(args);
  const cost = args.inputs.cost_minor;
  if (cost === null || cost <= 0) return { action: "pause", reason: "Taager no longer states a cost for this product.", decision };
  const rate = args.deliveryRateBps ?? m.defaultDeliveryRateBps;
  const net = netPerDelivered(args.current_price_minor, { cost_minor: cost, floor_minor: args.inputs.floor_minor }, m, rate, !!args.current_delivery_included);
  const usd = (v: number) => "US$" + (Math.round(minorToUsd(v, m) * 100) / 100).toFixed(2);
  const next = decision.state === "priced" ? { new_price_minor: decision.price_minor, new_delivery_included: !!decision.delivery_included } : {};
  if (net < floorMinor(m)) return { action: "pause", reason: `This price now earns ${usd(net)} per delivered order, under the US$${MARGIN_BAND.floorUsd} floor.`, ...next, decision };
  if (decision.state !== "priced") return { action: "keep", reason: "No better price could be worked out (" + decision.blocked_reason + "); the current one still earns " + usd(net) + ".", decision };
  const bps = marginBps(net, args.current_price_minor);
  const outside = bps < MARGIN_BAND.minBps || bps > MARGIN_BAND.maxBps;
  if (outside && !args.exception_approved && !decision.band_exception) return { action: "change", reason: `Margin is now ${pct(bps)}%, outside the 15-50% band.`, ...next, decision };
  const moved = Math.abs(decision.price_minor! - args.current_price_minor) / args.current_price_minor;
  if (moved >= 0.04 || !!decision.delivery_included !== !!args.current_delivery_included) return { action: "change", reason: decision.price_minor! < args.current_price_minor ? "Shops got cheaper or Taager's cost fell: a lower price now fits." : "Taager's cost or shop prices rose: a higher price now fits.", ...next, decision };
  return { action: "keep", reason: `Still right: ${pct(bps)}% margin, ${usd(net)} per delivered order.`, decision };
}

export type QuantityOffer = { quantity: number; price_minor: number; saving_minor: number; profit_delivered_minor: number };

/**
 * "2 for X" / "3 for X" offers built from our own single price at FULL unit cost. Taager's own quantity prices are
 * real (taager-economics.ts reads them and reports both figures); this function is the full-cost baseline. Each offer is a rounded price about 10% (2 pieces) or 15% (3 pieces)
 * under buying singly, and must earn at least as much as one single sale while counting the FULL unit cost
 * for every piece, so it stays profitable whatever Taager charges for multi-piece orders. One delivery fee.
 */
export function quantityOffers(price: number, inp: ProfitInputs, m: MarketFacts): QuantityOffer[] {
  const single = profitDelivered(price, inp, m);
  if (single <= 0) return [];
  const out: QuantityOffer[] = [];
  for (const [q, off] of [[2, 0.10], [3, 0.15]] as const) {
    const target = Math.floor(q * price * (1 - off));
    const scaled = { cost_minor: inp.cost_minor * q, floor_minor: inp.floor_minor === null ? null : inp.floor_minor * q };
    const points = pricePoints(scaled.cost_minor + 1, target, m);
    if (!points.length) continue;
    const x = Math.max(...points);
    const profit = profitDelivered(x, scaled, m);
    if (x >= q * price || profit < single) continue;
    out.push({ quantity: q, price_minor: x, saving_minor: q * price - x, profit_delivered_minor: profit });
  }
  return out;
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
