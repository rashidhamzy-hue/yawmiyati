import {describe,it,expect} from "vitest";
import {planFiveMarketCatalog} from "./offline-five-market-catalog-plan";
import {scoringWeights} from "./intelligence";
import type {MarketCode} from "./markets";
import type {ShortlistCandidate} from "./offline-catalog-shortlist";
const now="2026-11-21T08:00:00Z";
const codes=["sa","ae","om","eg","iq"] as const;
function verified(market:MarketCode,sku:string):ShortlistCandidate{
 return {market,sku,commercialCostVerified:true,mediaRightsVerified:true,variantsVerified:true,stockVerifiedAt:now,
  observations:Object.keys(scoringWeights).map(factor=>({
   market,sku,factor:factor as keyof typeof scoringWeights,score:80,
   observedAt:now,source:"offline fixture",verified:true
  }))};
}
function intake(count:number){
 return Object.fromEntries(codes.map(m=>[m,Array.from({length:count},(_,i)=>verified(m,"SKU-"+String(i).padStart(4,"0")))])) as Record<MarketCode,ShortlistCandidate[]>;
}
describe("five-market offline catalog planning",()=>{
 it("proposes a maximum of 150 per country without allowing launch",()=>{
  const result=planFiveMarketCatalog(intake(151),now);
  expect(result.totalProposed).toBe(750);
  expect(result.totalSubmitted).toBe(755);
  expect(result.allQuantityTargetsMet).toBe(true);
  expect(result).toMatchObject({verifiedLiveSupplierData:false,canImport:false,canLaunch:false,canSpend:false});
  expect(result.markets.every(m=>m.proposed.length===150&&m.offlineTaskPreviews.length===900)).toBe(true);
 });
 it("reports underfilled countries without inventing products",()=>{
  const result=planFiveMarketCatalog(intake(2),now);
  expect(result.totalProposed).toBe(10);
  expect(result.allQuantityTargetsMet).toBe(false);
  expect(result.markets[0].selectionShortfall).toBe(98);
 });
 it("excludes unverified costs while preserving country isolation",()=>{
  const data=intake(1);
  data.eg=[{...data.eg[0],commercialCostVerified:false}];
  const result=planFiveMarketCatalog(data,now,1,2);
  const egypt=result.markets.find(m=>m.market==="eg")!;
  expect(egypt.proposed).toHaveLength(0);
  expect(egypt.heldWithinTopN[0].blockers).toContain("unverified_cost");
  expect(egypt.meetsQuantityTarget).toBe(false);
  expect(()=>planFiveMarketCatalog({...data,iq:data.sa},now,1,2)).toThrow();
 });
 it("rejects invalid targets and absent markets",()=>{
  expect(()=>planFiveMarketCatalog(intake(1),now,151,151)).toThrow();
  expect(()=>planFiveMarketCatalog(intake(1),now,3,2)).toThrow();
  const missing={...intake(1)} as Partial<Record<MarketCode,ShortlistCandidate[]>>;
  delete missing.iq;
  expect(()=>planFiveMarketCatalog(missing as Record<MarketCode,ShortlistCandidate[]>,now)).toThrow();
 });
});
