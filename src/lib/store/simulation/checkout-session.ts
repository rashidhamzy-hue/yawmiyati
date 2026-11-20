/**
 * Milestone 2C — deterministic, entirely in-memory COD checkout rehearsal.
 * OWNER/TEST DEMO ONLY. No customer inputs, requests, persistence, payment,
 * customer messages, supplier calls, order dispatch or public routes.
 */
import { markets, type MarketCode } from "../markets";
import { addressSamples, validateSyntheticAddress, type SimAddress } from "./addresses";
import { SIMULATION_MODE, type SimProduct } from "./fixtures";
import {
  createOfflineCommerceSandbox,
  type SimulatedOrder,
  type SimulatedQuote,
  type SimulationLine,
} from "./offline-commerce";

export type CheckoutPreview = {
  readonly synthetic: true;
  readonly mode: typeof SIMULATION_MODE;
  readonly market: MarketCode;
  readonly currency: string;
  readonly lines: readonly SimulationLine[];
  readonly address: SimAddress | null;
  readonly quote: SimulatedQuote | null;
  readonly reviewed: boolean;
  readonly receipt: SimulatedOrder | null;
};

function assertSimulation(mode: unknown): asserts mode is typeof SIMULATION_MODE {
  if (mode !== SIMULATION_MODE) throw Error("simulation_mode_required");
}
function cloneQuote(quote: SimulatedQuote): SimulatedQuote {
  return { ...quote, lines: quote.lines.map(line => ({ ...line })) };
}

/** A session is local to a single country and cannot convert its draft to a real order. */
export function createOfflineCheckoutSession(market: MarketCode) {
  if (!Object.hasOwn(markets, market)) throw Error("invalid_market");
  const sandbox = createOfflineCommerceSandbox();
  const products: readonly SimProduct[] = sandbox.catalog(market);
  const lines = new Map<string, SimulationLine>();
  let address: SimAddress | null = null;
  let reviewed: { quote: SimulatedQuote; address: SimAddress } | null = null;
  let receiptId: string | null = null;
  let receiptRequestId: string | null = null;

  function assertEditable() {
    if (receiptId !== null) throw Error("simulation_locked_after_place");
  }
  function currentLines(): SimulationLine[] {
    return [...lines.values()].map(line => ({ ...line }));
  }
  function snapshot(): CheckoutPreview {
    const selected = currentLines();
    const quote = selected.length ? sandbox.quote(market, selected) : null;
    return {
      synthetic: true, mode: SIMULATION_MODE, market, currency: markets[market].currency,
      lines: selected,
      address: address ? { ...address } : null,
      quote: quote ? cloneQuote(quote) : null,
      reviewed: reviewed !== null,
      receipt: receiptId ? sandbox.get(market, receiptId) : null,
    };
  }
  function updateLine(input: {
    mode: typeof SIMULATION_MODE; sku: string; variantSku: string; quantity: number;
  }): CheckoutPreview {
    assertSimulation(input.mode);
    assertEditable();
    if (!Number.isSafeInteger(input.quantity) || input.quantity < 0 || input.quantity > 20)
      throw Error("invalid_quantity");
    const product = products.find(p => p.sku === input.sku && p.market === market && p.synthetic && !p.mayPublish);
    if (!product) throw Error("unknown_or_cross_market_sku");
    const variant = product.variants.find(v => v.sku === input.variantSku);
    if (!variant) throw Error("unknown_variant");
    if (input.quantity === 0 && !lines.has(variant.sku)) throw Error("unknown_cart_line");
    const next = new Map(lines);
    if (input.quantity === 0) next.delete(variant.sku);
    else next.set(variant.sku, { sku: product.sku, variantSku: variant.sku, quantity: input.quantity });
    // Quote before changing state: existing offline rules guard stock, max lines,
    // total overflow and cross-market SKUs. Removal of the final line is valid.
    if (next.size) sandbox.quote(market, [...next.values()]);
    lines.clear();
    for (const [key, value] of next) lines.set(key, { ...value });
    reviewed = null; // any edit invalidates a previously reviewed quote
    return snapshot();
  }
  function setAddress(input: { mode: typeof SIMULATION_MODE; address: unknown }): CheckoutPreview {
    assertSimulation(input.mode);
    assertEditable();
    // The existing validator returns a canonical, non-personal sample.
    // User-supplied fields must never become a checkout snapshot.
    address = validateSyntheticAddress(market, input.address);
    reviewed = null;
    return snapshot();
  }
  function review(input: { mode: typeof SIMULATION_MODE }): CheckoutPreview {
    assertSimulation(input.mode);
    assertEditable();
    if (!address) throw Error("synthetic_address_required");
    const selected = currentLines();
    if (!selected.length) throw Error("empty_cart");
    const quote = sandbox.quote(market, selected);
    reviewed = { quote: cloneQuote(quote), address: { ...address } };
    return snapshot();
  }
  function place(input: {
    mode: typeof SIMULATION_MODE;
    clientRequestId: string;
    acknowledgeSimulation: boolean;
  }): SimulatedOrder {
    assertSimulation(input.mode);
    if (input.acknowledgeSimulation !== true) throw Error("simulation_acknowledgement_required");
    if (!reviewed || !address) throw Error("review_required");
    if (!/^[a-zA-Z0-9_-]{5,80}$/.test(input.clientRequestId)) throw Error("invalid_idempotency_key");
    if (receiptId) {
      if (input.clientRequestId !== receiptRequestId) throw Error("simulation_already_placed");
      return sandbox.get(market, receiptId)!;
    }
    const current = sandbox.quote(market, currentLines());
    if (JSON.stringify(current.lines) !== JSON.stringify(reviewed.quote.lines) ||
      current.totalMinor !== reviewed.quote.totalMinor ||
      JSON.stringify(address) !== JSON.stringify(reviewed.address))
      throw Error("stale_review");
    const order = sandbox.place({
      mode: SIMULATION_MODE, market, lines: reviewed.quote.lines,
      clientRequestId: input.clientRequestId,
    });
    receiptId = order.id;
    receiptRequestId = input.clientRequestId;
    return order;
  }
  function sampleAddress(): SimAddress {
    return { ...addressSamples[market] };
  }
  return Object.freeze({
    mode: SIMULATION_MODE,
    market,
    catalog: (): readonly SimProduct[] => products.slice(),
    sampleAddress,
    snapshot,
    updateLine,
    setAddress,
    review,
    place,
  });
}
