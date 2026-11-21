import {describe,it,expect,vi} from "vitest";
import {markets,type MarketCode} from "../lib/store/markets";
import {scoringWeights} from "../lib/store/intelligence";
import {planAllOfflineAiMarkets,planOfflineAiMarket,prepareOfflineAiReview,type AiOfflineCase} from "../lib/store/offline-ai-workflows";
import type {Observation,VerifiedFact} from "../lib/store/research-evidence";
const countryCodes=["sa","ae","om","eg","iq"] as const;
const at="2026-11-21T06:00:00.000Z";
const facts:VerifiedFact[]=[
 {id:"spec-capacity",statement:"Capacity 500 ml",source:"offline-sample-sheet",verified:true},
];
function research(market:MarketCode,sku="ITEM-1"):Observation[]{
 return (Object.keys(scoringWeights) as (keyof typeof scoringWeights)[]).map(factor=>({
  factor,score:80,source:"offline sample observation",observedAt:"2026-11-21T05:45:00.000Z",market,sku,verified:true,
 }));
}
function testCase(market:MarketCode,task:AiOfflineCase["task"]="product_copy"):AiOfflineCase{
 return {market,sku:"ITEM-1",contentRevision:"content-1",task,channel:"storefront",facts,observations:research(market),
  proposedDraft:{segments:[{text:"سعة ٥٠٠ مل",factIds:["spec-capacity"]}]},
 };
}
describe("M4F offline five-market AI preparation",()=>{
 it.each(countryCodes)("%s: zero spend and human review default, even with apparently valid evidence",market=>{
  const p=planOfflineAiMarket(market);
  expect(p.locale).toBe(markets[market].locale);
  expect(p.aiDailyBudgetMicrousd).toBe(0);
  expect(p.activeProvider).toBe(false);
  expect(p.autoPublish).toBe(false);
  expect(p.autoAds).toBe(false);
  const result=prepareOfflineAiReview(testCase(market),at);
  expect(result.issues).toEqual(["draft_claim_review"]);
  expect(result.locale).toBe(markets[market].locale);
  expect(result.draftSegments).toHaveLength(1);
  expect(result.verifiedResearchScore).toBe(80);
  expect(result.requiresHumanReview).toBe(true);
  expect([result.canCallModel,result.canPublish,result.canLaunchAds,result.canSpend,result.canRecommendPublicly])
   .toEqual([false,false,false,false,false]);
 });
 it("prepares all five markets without triggering external work",()=>{
  const spy=vi.spyOn(globalThis,"fetch");
  try{
   expect(planAllOfflineAiMarkets().map(x=>x.market)).toEqual(countryCodes);
   expect(spy).not.toHaveBeenCalled();
  }finally{spy.mockRestore();}
 });
 it("rejects cross-country and unverifiable research observations",()=>{
  const x=testCase("iq","product_research");
  const changed={...x,observations:research("sa")};
  const out=prepareOfflineAiReview(changed,at);
  expect(out.issues).toContain("untrusted_observation");
  expect(out.issues).toContain("research_incomplete");
  const stale=prepareOfflineAiReview(x,"2027-01-01T06:00:00.000Z");
  expect(stale.verifiedResearchScore).toBeNull();
  expect(stale.issues).toContain("research_incomplete");
  expect(()=>planOfflineAiMarket("xx" as MarketCode)).toThrow("invalid_market");
 });
 it("does not treat an unverified or missing source as safe AI input",()=>{
  const x=testCase("eg");
  const result=prepareOfflineAiReview({...x,facts:[{...facts[0],verified:false}]},at);
  expect(result.issues).toContain("untrusted_facts");
  expect(result.draftSegments).toEqual([]);
  expect(result.canPublish).toBe(false);
 });
 it("rejects fabricated claim references and suspicious claims while retaining human review",()=>{
  const x=testCase("ae");
  const wrong=prepareOfflineAiReview({...x,proposedDraft:{segments:[{text:"صناعة ممتازة",factIds:["unknown-id"]}]}},at);
  expect(wrong.issues).toContain("invalid_draft");
  const suspect=prepareOfflineAiReview({...x,proposedDraft:{segments:[{text:"100% guaranteed cure",factIds:["spec-capacity"]}]}},at);
  expect(suspect.issues).toContain("unsafe_claim");
  expect(suspect.issues).toContain("draft_claim_review");
  expect(suspect.canPublish).toBe(false);
 });
 it("requires a real localization source market without auto-translating",()=>{
  const x=testCase("om","localization");
  expect(prepareOfflineAiReview(x,at).issues).toContain("localization_source_missing");
  expect(prepareOfflineAiReview({...x,sourceMarket:"om"},at).issues).toContain("localization_source_missing");
  const ok=prepareOfflineAiReview({...x,sourceMarket:"sa"},at);
  expect(ok.issues).not.toContain("localization_source_missing");
  expect(ok.issues).toContain("draft_claim_review");
 });
 it("recommendations never imply verified availability for unrelated products",()=>{
  const x=testCase("sa","recommendations");
  const report=prepareOfflineAiReview({...x,candidateSkus:["ITEM-2","ITEM-3"]},at);
  expect(report.verifiedResearchScore).toBe(80);
  expect(report.issues).toContain("recommendation_evidence_missing");
  expect(report.canRecommendPublicly).toBe(false);
  const bad=prepareOfflineAiReview({...x,candidateSkus:["ITEM-2","ITEM-2"]},at);
  expect(bad.issues).toContain("candidate_list_invalid");
 });
 it("does not mistake sample IDs for approved commercial product identities",()=>{
  const x=testCase("sa");
  expect(prepareOfflineAiReview({...x,sku:"SIM-123"},at).issues).toContain("invalid_identity");
  expect(prepareOfflineAiReview({...x,contentRevision:""},at).issues).toContain("missing_revision");
  expect(prepareOfflineAiReview({...x,market:"uk" as MarketCode},at).issues).toContain("invalid_market");
 });
});
