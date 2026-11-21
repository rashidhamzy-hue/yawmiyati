/**
 * M5I integration boundary checks: product intelligence/owner review and COD
 * checkout are separate OFFLINE rehearsals; test data is never shipped.
 */
import {describe,it,expect,vi} from "vitest";
import {markets,type MarketCode} from "../lib/store/markets";
import {scoringWeights} from "../lib/store/intelligence";
import {evaluateOfflineProductPipeline} from "../lib/store/offline-product-pipeline";
import {createOfflineJob,applyOfflineJobEvent} from "../lib/store/offline-job-lifecycle";
import {createOfflineCheckoutSession} from "../lib/store/simulation/checkout-session";
import {SIMULATION_MODE} from "../lib/store/simulation/fixtures";
const all=Object.keys(markets) as MarketCode[];
const at="2026-11-21T08:00:00Z";
function productReview(market:MarketCode){
 const sku=market+"-OFFLINE-01",revision="local-review-1";
 return evaluateOfflineProductPipeline({
  market,asOf:at,verifiedFactIds:["fact-1"],
  candidate:{market,sku,commercialCostVerified:true,mediaRightsVerified:true,variantsVerified:true,stockVerifiedAt:at,
   observations:Object.keys(scoringWeights).map(factor=>({
    market,sku,factor:factor as keyof typeof scoringWeights,score:80,observedAt:at,verified:true,source:"test-only-source"
   }))},
  editorial:{market,sku,revision,proposals:[{field:"title",segments:[{text:"منتج تجريبي",factIds:["fact-1"]}]}]},
  release:{market,sku,revision,sourceVerified:true,costVerified:true,stockFresh:true,variantsVerified:true,
   mediaLicensed:true,editorialReviewed:true,legalCopyApproved:true,shippingConfirmed:true,
   duplicateResolved:true,ownerApprovedRevision:revision}
 });
}
describe("M5I five-country offline cross-system boundary",()=>{
 it("rehearses review and independent COD simulation without live effects",()=>{
  const network=vi.spyOn(globalThis,"fetch");
  try{
   for(const market of all){
    const pipeline=productReview(market);
    expect(pipeline.readyForOwnerReview).toBe(true);
    expect(pipeline).toMatchObject({canExecute:false,canPublish:false,canIndex:false,canOrder:false,canSpend:false});
    const j=createOfflineJob(market,pipeline.sku,pipeline.revision,"research",at);
    const leased=applyOfflineJobEvent(j,{id:"lease",jobId:j.id,type:"lease",token:"offline-only",until:"2026-11-21T08:02:00Z"},at);
    const completed=applyOfflineJobEvent(leased,{id:"done",jobId:j.id,type:"complete",token:"offline-only"},"2026-11-21T08:01:00Z");
    const accepted=applyOfflineJobEvent(completed,{id:"review",jobId:j.id,type:"review_accept",revision:pipeline.revision,decisionRef:"offline-fixture"},"2026-11-21T08:02:00Z");
    expect(accepted).toMatchObject({status:"review_accepted",canPublish:false,canCallModel:false});
    // Separate synthetic checkout uses its own fixture SKUs, never the proposed SKU above.
    const session=createOfflineCheckoutSession(market);
    const fixture=session.catalog().find(x=>x.variants.some(v=>v.stock==="available"&&v.availableUnits>0))!;
    const variant=fixture.variants.find(v=>v.stock==="available"&&v.availableUnits>0)!;
    session.updateLine({mode:SIMULATION_MODE,sku:fixture.sku,variantSku:variant.sku,quantity:1});
    session.setAddress({mode:SIMULATION_MODE,address:session.sampleAddress()});
    const quoted=session.review({mode:SIMULATION_MODE});
    expect(quoted).toMatchObject({synthetic:true,reviewed:true,currency:markets[market].currency});
    const order=session.place({mode:SIMULATION_MODE,clientRequestId:"offline-m5i-"+market,acknowledgeSimulation:true});
    expect(order).toMatchObject({synthetic:true,market,currency:markets[market].currency,
     paymentCollected:false,supplierAcknowledged:false,status:"pending"});
    expect(session.place({mode:SIMULATION_MODE,clientRequestId:"offline-m5i-"+market,acknowledgeSimulation:true}).id).toBe(order.id);
   }
   expect(network).not.toHaveBeenCalled();
  }finally{network.mockRestore();}
 });
 it("rejects cross-country product content before review",()=>{
  const r=productReview("sa");
  expect(r.market).toBe("sa");
  const j=createOfflineJob("iq",r.sku,r.revision,"research",at);
  expect(()=>applyOfflineJobEvent(j,{id:"bad",jobId:"sa:foreign",type:"expire"},at)).toThrow();
 });
});
