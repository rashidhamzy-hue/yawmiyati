import type { MarketCode } from "./markets";
import { shortlistCandidates, type ShortlistCandidate } from "./offline-catalog-shortlist";
import { evaluateCodEvidence, type CodEvidence } from "./pricing";

export type Offer = ShortlistCandidate & {
  measuredDemand?:number;
  title: string;
  category: string;
  // Component identities and quantities come from explicit supplier evidence.
  components: readonly { id: string; quantity: number }[] | null;
  sellerFloor: number | null;
  competitor: { deliveredMinor: number; source: string; observedAt: string } | null;
  // Shopper delivery charge is separate from seller-borne outboundDelivery.
  shopperShipping: number | null;
  economics: CodEvidence;
};

export function selectOffers(market: MarketCode, offers: readonly Offer[], reportedTotal: number | null, asOf: string, limit = 150) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 150) throw Error("Invalid family limit");
  if (reportedTotal !== null && (!Number.isSafeInteger(reportedTotal) || reportedTotal < offers.length)) throw Error("Invalid source count");
  const seen = new Set<string>();
  const now = Date.parse(asOf);
  if (!Number.isFinite(now)) throw Error("Invalid selection date");
  const evaluated = offers.map(offer => {
    if (seen.has(offer.sku)) throw Error("Duplicate offer SKU");
    seen.add(offer.sku);
    const [research] = shortlistCandidates(market, [offer], asOf, 1);
    const useMeasured=research.blockers.includes("incomplete_research") && typeof offer.measuredDemand==="number" && offer.measuredDemand>0 && offer.measuredDemand<=100;
    const reasons = research.blockers.filter(reason=>!(useMeasured && reason==="incomplete_research"));
    const parts = offer.components ?? [];
    const validParts = parts.length > 0 && parts.every(p => p.id.trim() && Number.isSafeInteger(p.quantity) && p.quantity > 0)
      && new Set(parts.map(p => p.id)).size === parts.length;
    if (!validParts) reasons.push("unverified_components");
    const signature = parts.map(p => [p.id, parts.length === 1 ? 1 : p.quantity] as const)
      .sort(([a], [b]) => a.localeCompare(b, "en"));
    const family = JSON.stringify(signature);
    const price = offer.economics.price;
    const money = (v: number | null): v is number => v !== null && Number.isSafeInteger(v) && v >= 0;
    if (!money(offer.sellerFloor) || price === null || price < offer.sellerFloor) reasons.push("missing_or_unmet_price_floor");
    const competitor = offer.competitor;
    const age = now - Date.parse(competitor?.observedAt ?? "");
    if (!competitor?.source.trim() || !money(competitor.deliveredMinor) || competitor.deliveredMinor === 0 || !(age >= 0 && age <= 30 * 86400000)) reasons.push("missing_local_comparison");
    else if (price === null || !money(offer.shopperShipping)) reasons.push("missing_customer_total");
    else if (BigInt(price) + BigInt(offer.shopperShipping) > BigInt(competitor.deliveredMinor)) reasons.push("above_comparable_delivered_price");
    const economics = evaluateCodEvidence(offer.economics);
    const contribution = economics.state === "evaluated" ? economics.scenarios[1].expectedContributionMinor : null;
    if (contribution === null) reasons.push(...(economics.state === "incomplete" ? economics.missing.map(k => "missing_" + k) : []));
    else if (BigInt(contribution) <= 0n) reasons.push("nonpositive_expected_margin");
    return { offer, family, score: useMeasured ? offer.measuredDemand! : research.score, rankingMethod:useMeasured?"regional_demand_then_expected_contribution":"factor_assessment", reasons, contribution };
  });
  const eligible = evaluated.filter(row => !row.reasons.length).sort((a,b) => {
    const scoreDifference = (b.score ?? 0) - (a.score ?? 0);
    if (scoreDifference) return scoreDifference;
    const marginA = BigInt(a.contribution!), marginB = BigInt(b.contribution!);
    return marginA === marginB ? a.offer.sku.localeCompare(b.offer.sku,"en") : marginA > marginB ? -1 : 1;
  });
  const families = new Set<string>();
  const selected = eligible.filter(row => {
    if (families.has(row.family) || families.size >= limit) return false;
    families.add(row.family);
    return true;
  });
  const coverage = reportedTotal === null ? "unknown" : reportedTotal === offers.length ? "complete" : "partial";
  return { coverage, reportedTotal, read: offers.length, selected, evaluated };
}
