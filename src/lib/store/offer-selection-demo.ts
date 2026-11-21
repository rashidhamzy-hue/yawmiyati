import { markets, type MarketCode } from "./markets";
import { scoringWeights } from "./intelligence";
import type { Offer } from "./offer-selection";

export const demoDate = "2026-11-21T10:00:00Z";
const baseline = { sa: 65, ae: 60, om: 6, eg: 550, iq: 22000 };
export function demoCatalog(market: MarketCode) {
  const unit = baseline[market] * 10 ** markets[market].minorDigits;
  function offer(sku: string, title: string, components: Offer["components"], packs: number): Offer {
    const price = unit * packs;
    return {
      sku, title, market, category: "Home / Kitchen storage", components,
      commercialCostVerified: true, variantsVerified: true, mediaRightsVerified: true, stockVerifiedAt: demoDate,
      observations: (Object.keys(scoringWeights) as (keyof typeof scoringWeights)[]).map(factor => ({
        market, sku, factor, score: 75, source: "Fictional " + factor + " observation", verified: true, observedAt: demoDate,
      })),
      shopperShipping: 0, sellerFloor: Math.floor(price * 0.8),
      competitor: { deliveredMinor: price, observedAt: demoDate, source: "Demo local shop, matching pack" },
      economics: { price, supplierCost: Math.floor(price / 2), outboundDelivery: Math.floor(unit / 10),
        deliveredFees: Math.floor(unit / 20), returnCost: Math.floor(unit / 10), adCost: Math.floor(unit / 8), deliveryBps: 8500 },
    };
  }
  const rack = (quantity: number) => [{id: "rack", quantity}];
  const single = offer("DEMO-R1", "رف مطبخ", rack(1), 1);
  const pair = offer("DEMO-R2", "رفّان للمطبخ", rack(2), 2);
  const triple = offer("DEMO-R3", "مجموعة من ثلاثة رفوف", rack(3), 3);
  if (market === "iq") triple.economics.returnCost = null;
  const mixed = offer("DEMO-KIT", "رف مطبخ مع خطّاف", [...rack(1), {id: "hook", quantity: 1}], 2);
  const unknown = offer("DEMO-X", "مجموعة أدوات مطبخ", null, 2);
  const offers = [single, pair, triple, mixed, unknown];
  return {offers, reportedTotal: market === "om" ? null : market === "ae" ? 9 : offers.length};
}
