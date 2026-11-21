import {describe,it,expect} from "vitest";
import {evaluateOfflineProductPipeline} from "./offline-product-pipeline";
import {scoringWeights} from "./intelligence";
const now="2026-11-21T08:00:00Z";
const candidate={market:"sa" as const,sku:"sku-1",observations:Object.keys(scoringWeights).map(factor=>({
 factor:factor as keyof typeof scoringWeights,score:80,source:"fixture",observedAt:now,
 market:"sa" as const,sku:"sku-1",verified:true
})),stockVerifiedAt:now,commercialCostVerified:true,mediaRightsVerified:true,variantsVerified:true};
const editorial={market:"sa" as const,sku:"sku-1",revision:"r1",proposals:[
 {field:"title" as const,segments:[{text:"منتج للمنزل",factIds:["f1"]}]}
]};
const release={market:"sa" as const,sku:"sku-1",revision:"r1",sourceVerified:true,costVerified:true,stockFresh:true,
 variantsVerified:true,mediaLicensed:true,editorialReviewed:true,legalCopyApproved:true,
 shippingConfirmed:true,ownerApprovedRevision:"r1",duplicateResolved:true};
const input={market:"sa" as const,asOf:now,candidate,editorial,verifiedFactIds:["f1"],release};
describe("unified offline product pipeline",()=>{
 it("composes four modules without granting execution",()=>{
  const r=evaluateOfflineProductPipeline(input);
  expect(r.blockers).toEqual([]);
  expect(r.readyForOwnerReview).toBe(true);
  expect(r.canExecute||r.canPublish||r.canIndex||r.canOrder||r.canSpend).toBe(false);
  expect(r.taskStates).toHaveLength(6);
 });
 it("rejects mixed market or revisions",()=>{
  expect(()=>evaluateOfflineProductPipeline({...input,editorial:{...editorial,revision:"r2"}})).toThrow();
  expect(()=>evaluateOfflineProductPipeline({...input,release:{...release,market:"eg"}})).toThrow();
 });
 it("aggregates commercial and editorial blockers",()=>{
  const r=evaluateOfflineProductPipeline({...input,candidate:{...candidate,commercialCostVerified:false},
   editorial:{...editorial,proposals:[{field:"title" as const,segments:[{text:"Free shipping guaranteed",factIds:["f1"]}]}]}});
  expect(r.readyForOwnerReview).toBe(false);
  expect(r.blockers).toContain("research:unverified_cost");
  expect(r.blockers).toContain("editorial:unsafe_or_upstream_copy:title");
 });
});
