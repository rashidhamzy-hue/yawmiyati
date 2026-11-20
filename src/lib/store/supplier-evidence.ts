import { markets, type MarketCode } from "./markets";

/**
 * Read-only advisory validation of a supplier's commercial evidence.
 * Never publish a listing, update inventory or submit an order from this helper.
 * The server must authenticate the provider, persist provenance, and enforce
 * fresh stock and current approvals transactionally.
 */
export type SupplierEvidence = {
  market: MarketCode;
  providerId: string;
  supplierSku: string;
  currency: string;
  observationAt: string;
  authenticatedSource: boolean;
  reportedStock: "available" | "unavailable" | "unknown";
  stockEvidenceRef: string | null;
  wholesaleCostMinor: number | null;
  costEvidenceRef: string | null;
};

export function assessSupplierEvidence(
  input: SupplierEvidence,
  expectedMarket: MarketCode,
  asOf: string,
) {
  const failures: string[] = [];
  if (!Object.hasOwn(markets, expectedMarket) || input.market !== expectedMarket)
    failures.push("market_mismatch");
  if (
    !input.providerId.trim() || input.providerId.length > 120 ||
    !input.supplierSku.trim() || input.supplierSku.length > 200
  ) failures.push("supplier_identity");
  if (input.currency !== markets[expectedMarket]?.currency)
    failures.push("currency_mismatch");
  if (!input.authenticatedSource) failures.push("unauthenticated_supplier_source");
  const now = Date.parse(asOf);
  const observed = Date.parse(input.observationAt);
  if (
    !Number.isFinite(now) || !Number.isFinite(observed) ||
    observed > now || now - observed > 15 * 60_000
  ) failures.push("stale_supplier_observation");
  if (!["available", "unavailable", "unknown"].includes(input.reportedStock))
    failures.push("invalid_stock_state");
  if (input.reportedStock !== "available" || !input.stockEvidenceRef?.trim())
    failures.push("no_verified_available_stock");
  if (
    input.wholesaleCostMinor === null ||
    !Number.isSafeInteger(input.wholesaleCostMinor) ||
    input.wholesaleCostMinor < 0 ||
    !input.costEvidenceRef?.trim()
  ) failures.push("unverified_supplier_cost");
  return {
    eligibleForReview: failures.length === 0,
    failures,
  } as const;
}
