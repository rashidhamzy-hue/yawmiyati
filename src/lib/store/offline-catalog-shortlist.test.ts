import {describe,it,expect} from "vitest";
import {shortlistCandidates,type ShortlistCandidate} from "./offline-catalog-shortlist";
import {scoringWeights} from "./intelligence";
import type {Observation} from "./research-evidence";
const now="2026-11-21T08:00:00Z";
function candidate(sku:string,market:"sa"|"eg"="sa",score=80):ShortlistCandidate{
 const observations=(Object.keys(scoringWeights) as (keyof typeof scoringWeights)[]).map(factor=>({
  factor,score,source:"verified-fixture",observedAt:now,market,sku,verified:true
 })) satisfies Observation[];
 return {sku,market,observations,stockVerifiedAt:now,commercialCostVerified:true,
  mediaRightsVerified:true,variantsVerified:true};
}
describe("offline catalog shortlist",()=>{
 it("ranks complete evidence deterministically without publishing",()=>{
  const r=shortlistCandidates("sa",[candidate("low","sa",50),candidate("high","sa",90)],now);
  expect(r.map(x=>x.sku)).toEqual(["high","low"]);
  expect(r.map(x=>x.rank)).toEqual([1,2]);
  expect(r.every(x=>!x.canPublish&&!x.canOrder)).toBe(true);
 });
 it("blocks missing evidence despite a high score",()=>{
  const r=shortlistCandidates("sa",[{...candidate("unsafe","sa",100),mediaRightsVerified:false},candidate("safe","sa",50)],now);
  expect(r[0].sku).toBe("safe");
  expect(r[1].blockers).toContain("unverified_media_rights");
  expect(r[1].rank).toBeNull();
 });
 it("rejects cross-market and duplicate candidates",()=>{
  expect(()=>shortlistCandidates("sa",[candidate("x","eg")],now)).toThrow();
  expect(()=>shortlistCandidates("sa",[candidate("x"),candidate("x")],now)).toThrow();
 });
 it("fails closed for stale stock and incomplete research",()=>{
  const c=candidate("old");
  const r=shortlistCandidates("sa",[{...c,stockVerifiedAt:"2026-11-01T00:00:00Z",observations:[]}],now);
  expect(r[0].eligibleForOwnerReview).toBe(false);
  expect(r[0].blockers).toContain("stale_or_unverified_stock");
  expect(r[0].blockers).toContain("incomplete_research");
 });
 it("limits shortlist size and rejects invalid limits",()=>{
  expect(shortlistCandidates("sa",[candidate("a"),candidate("b")],now,1)).toHaveLength(1);
  expect(()=>shortlistCandidates("sa",[],now,151)).toThrow();
 });
});
