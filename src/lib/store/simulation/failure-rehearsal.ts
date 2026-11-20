/**
 * Milestone 3B — controlled adversarial OFFLINE rehearsal.
 * Browser-safe scenarios only. Signed HMAC tampering is tested separately\n * in Node CI, never imported into the localhost browser bundle.\n * Every observation is synthetic. A PASS means a failure was DETECTED and
 * isolated, never that a supplier/order/payment/release was verified.
 * No environment access, network, persistence or live mutations.
 */
import {markets,type MarketCode} from "../markets";
import {assessSupplierEvidence,type SupplierEvidence} from "../supplier-evidence";
import {evaluateCodEvidence} from "../pricing";
import {compareOrderSnapshots} from "../reconciliation";
import {createOfflineCommerceSandbox} from "./offline-commerce";
import {createSimulatedOutbox} from "./outbox";
import {SIMULATION_MODE} from "./fixtures";
import {fiveMarketReadiness} from "./offline-launch-readiness";

export const FAILURE_SCENARIOS=[
 "expired_stock_evidence",
 "wrong_market_or_currency_cost",
 "missing_cod_cost_policy",
 "failed_order_lifecycle",
 "retry_then_dead_letter",
 "reconciliation_divergence",
] as const;
export type FailureScenario=typeof FAILURE_SCENARIOS[number];
export type ScenarioOutcome={
 readonly market:MarketCode;readonly scenario:FailureScenario;readonly caught:boolean;
 readonly synthetic:true;readonly evidence:"offline_injected_failure";
 readonly liveReleaseApproved:false;readonly paymentCollected:false;
 readonly supplierAcknowledged:false;readonly networkCalls:0;
};
export type FailureMatrix={
 readonly mode:typeof SIMULATION_MODE;readonly synthetic:true;
 readonly outcomes:readonly ScenarioOutcome[];
 readonly scenariosPerMarket:number;readonly detected:number;readonly total:number;
 readonly allDetected:boolean;readonly productionReady:false;readonly mayPublish:false;
 readonly mayDispatch:false;readonly maySpend:false;
};
const clock="2026-11-20T12:00:00.000Z";
const marketsList=Object.keys(markets) as MarketCode[];
function mockEvidence(market:MarketCode):SupplierEvidence{
 return {market,providerId:"SIM-ADVISORY",supplierSku:"SIM-TEST-01",currency:markets[market].currency,
  observationAt:clock,authenticatedSource:false,reportedStock:"available",
  stockEvidenceRef:"offline-only-stock",wholesaleCostMinor:100,
  costEvidenceRef:"offline-only-cost"};
}
function rejects(operation:()=>unknown,expected:string){
 try{operation();return false;}catch(e){return e instanceof Error&&e.message.includes(expected);}
}
function scenario(market:MarketCode,id:FailureScenario):boolean {
 switch(id){
  case "expired_stock_evidence":{
   const result=assessSupplierEvidence({...mockEvidence(market),observationAt:"2026-11-20T11:00:00.000Z"},market,clock);
   return !result.eligibleForReview&&result.failures.includes("stale_supplier_observation");
  }
  case "wrong_market_or_currency_cost":{
   const foreign=marketsList.find(m=>m!==market)!;
   const result=assessSupplierEvidence({
    ...mockEvidence(market),market:foreign,currency:markets[foreign].currency,
    wholesaleCostMinor:null,costEvidenceRef:null,
   },market,clock);
   return !result.eligibleForReview&&result.failures.includes("market_mismatch")&&
     result.failures.includes("currency_mismatch")&&result.failures.includes("unverified_supplier_cost");
  }
  case "missing_cod_cost_policy":{
   const result=evaluateCodEvidence({
    price:10000,supplierCost:2000,outboundDelivery:null,deliveredFees:null,
    returnCost:null,adCost:0,deliveryBps:null,
   });
   return result.state==="incomplete"&&
     ["outboundDelivery","deliveredFees","returnCost","deliveryBps"].every(k=>result.missing.includes(k as never));
  }
  case "failed_order_lifecycle":{
   const sandbox=createOfflineCommerceSandbox();
   const item=sandbox.catalog(market).find(p=>p.variants.some(v=>v.stock==="available"&&v.availableUnits>0))!;
   const variant=item.variants.find(v=>v.stock==="available"&&v.availableUnits>0)!;
   const order=sandbox.place({mode:SIMULATION_MODE,market,clientRequestId:"failure-flow-"+market,
    lines:[{sku:item.sku,variantSku:variant.sku,quantity:1}]});
   const earlyShipmentRejected=rejects(()=>sandbox.transition({mode:SIMULATION_MODE,market,
    orderId:order.id,to:"shipped",eventId:"bad-early"}),"invalid_transition");
   const accepted=sandbox.transition({mode:SIMULATION_MODE,market,orderId:order.id,to:"accepted",eventId:"accepted"});
   const failed=sandbox.transition({mode:SIMULATION_MODE,market,orderId:order.id,to:"failed",eventId:"failed"});
   const duplicate=sandbox.transition({mode:SIMULATION_MODE,market,orderId:order.id,to:"failed",eventId:"failed"});
   const blockedDelivered=rejects(()=>sandbox.transition({mode:SIMULATION_MODE,market,orderId:order.id,
    to:"delivered",eventId:"invalid-delivery"}),"invalid_transition");
   return earlyShipmentRejected&&accepted.status==="accepted"&&failed.status==="failed"&&
    duplicate.events.length===failed.events.length&&blockedDelivered&&
    !failed.paymentCollected&&!failed.supplierAcknowledged;
  }
  case "retry_then_dead_letter":{
   const outbox=createSimulatedOutbox();
   const job=outbox.enqueue({mode:SIMULATION_MODE,market,jobType:"notify_owner",
    dedupeKey:"failure-replay-"+market,dueAtMs:0,payload:{synthetic:true}});
   let now=0;
   for(let attempt=1;attempt<=3;attempt++){
    const leased=outbox.lease({mode:SIMULATION_MODE,market,nowMs:now,leaseMs:1000});
    if(!leased||leased.id!==job.id||leased.attempts!==attempt)return false;
    const staleRejected=rejects(()=>outbox.complete({mode:SIMULATION_MODE,market,id:job.id,
      expectedAttempt:attempt-1,success:true,nowMs:now}),"stale_lease");
    if(!staleRejected)return false;
    const next=outbox.complete({mode:SIMULATION_MODE,market,id:job.id,
      expectedAttempt:attempt,success:false,nowMs:now});
    if(next.status!==(attempt===3?"dead_letter":"queued"))return false;
    now=next.dueAtMs;
   }
   const replay=outbox.enqueue({mode:SIMULATION_MODE,market,jobType:"notify_owner",
    dedupeKey:"failure-replay-"+market,dueAtMs:0,payload:{synthetic:true}});
   const blockedLease=outbox.lease({mode:SIMULATION_MODE,market,nowMs:now+100000,leaseMs:1000})===null;
   const crossMarket=marketsList.find(x=>x!==market)!;
   return replay.id===job.id&&replay.status==="dead_letter"&&blockedLease&&
    rejects(()=>outbox.complete({mode:SIMULATION_MODE,market:crossMarket,id:job.id,
       expectedAttempt:3,success:true,nowMs:now}),"job_not_found_or_cross_market");
  }
  case "reconciliation_divergence":{
   const id="SIM-"+market.toUpperCase()+"-ORDER-00001";
   const missing=compareOrderSnapshots([{id,status:"failed"}],[]);
   const mismatch=compareOrderSnapshots([{id,status:"failed"}],[{id,status:"delivered"}]);
   const unexpected=compareOrderSnapshots([],[{id,status:"delivered"}]);
   return missing.length===1&&missing[0].kind==="missing_remote"&&
    mismatch.length===1&&mismatch[0].kind==="status_mismatch"&&
    unexpected.length===1&&unexpected[0].kind==="unmapped_remote"&&
    rejects(()=>compareOrderSnapshots([{id,status:"failed"},{id,status:"failed"}],[]),"Duplicate local order");
  }

 }
}
export function runOfflineFailureMatrix():FailureMatrix {
 const outcomes=marketsList.flatMap(market=>FAILURE_SCENARIOS.map(id=>({
  market,scenario:id,caught:scenario(market,id),synthetic:true as const,
  evidence:"offline_injected_failure" as const,liveReleaseApproved:false as const,
  paymentCollected:false as const,supplierAcknowledged:false as const,networkCalls:0 as const,
 })));
 const detected=outcomes.filter(o=>o.caught).length;
 const readiness=fiveMarketReadiness();
 return {mode:SIMULATION_MODE,synthetic:true,outcomes,
  scenariosPerMarket:FAILURE_SCENARIOS.length,detected,total:outcomes.length,
  allDetected:detected===outcomes.length,productionReady:false,
  mayPublish:readiness.releaseAuthorization,mayDispatch:false,maySpend:false};
}
