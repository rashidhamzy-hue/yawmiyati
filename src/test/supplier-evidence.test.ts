import { describe, expect, it } from "vitest";
import { assessSupplierEvidence, type SupplierEvidence } from "../lib/store/supplier-evidence";

const evidence: SupplierEvidence = {
  market: "sa",
  providerId: "supplier-test",
  supplierSku: "SKU-001",
  currency: "SAR",
  observationAt: "2026-11-20T09:00:00Z",
  authenticatedSource: true,
  reportedStock: "available",
  stockEvidenceRef: "provider-stock-observation-1",
  wholesaleCostMinor: 1500,
  costEvidenceRef: "provider-cost-observation-1",
};
const now = "2026-11-20T09:10:00Z";

describe("Supplier evidence advisory gate", () => {
 it("requires fresh authenticated stock and independently sourced wholesale cost", () => {
   expect(assessSupplierEvidence(evidence, "sa", now)).toEqual({eligibleForReview:true,failures:[]});
 });
 it("never treats a supplier stock label without provenance as verified", () => {
   const result=assessSupplierEvidence({...evidence,stockEvidenceRef:null}, "sa", now);
   expect(result.eligibleForReview).toBe(false);
   expect(result.failures).toContain("no_verified_available_stock");
 });
 it("fails closed when cost is unknown or lacks evidence", () => {
   for(const patch of [{wholesaleCostMinor:null},{costEvidenceRef:null}]){
     const result=assessSupplierEvidence({...evidence,...patch}, "sa", now);
     expect(result.failures).toContain("unverified_supplier_cost");
   }
 });
 it("rejects stale, future, and unauthenticated observations", () => {
   for(const patch of [
     {observationAt:"2026-11-20T08:54:59Z"},
     {observationAt:"2026-11-20T09:11:00Z"},
     {authenticatedSource:false},
   ]){
     expect(assessSupplierEvidence({...evidence,...patch}, "sa", now).eligibleForReview).toBe(false);
   }
 });
 it("blocks cross-market records and mismatched currency", () => {
   const cross=assessSupplierEvidence(evidence, "ae", now);
   expect(cross.failures).toContain("market_mismatch");
   expect(cross.failures).toContain("currency_mismatch");
   expect(assessSupplierEvidence({...evidence,market:"iq",currency:"IQD"}, "sa", now).eligibleForReview).toBe(false);
 });
 it("does not treat zero wholesale cost as unknown when provider explicitly verifies it", () => {
   expect(assessSupplierEvidence({...evidence,wholesaleCostMinor:0}, "sa", now).eligibleForReview).toBe(true);
 });
});
