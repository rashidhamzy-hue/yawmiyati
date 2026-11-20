import {describe,it,expect} from "vitest";
import {markets} from "../lib/store/markets";
import {validateSupplierOrderRequest,validateSupplierOrderReceipt,validateSupplierProduct} from "../lib/store/supplier-contracts";
import {SIMULATION_MODE} from "../lib/store/simulation/fixtures";
import {createSimulatedOutbox} from "../lib/store/simulation/outbox";
import {createSignedSyntheticEvent,acceptSignedSyntheticEvent} from "../lib/store/simulation/signed-webhook";
import {addressSamples,validateSyntheticAddress} from "../lib/store/simulation/addresses";
const countries=["sa","ae","om","eg","iq"] as const;

describe("typed integration boundary",()=>{
 const order={market:"sa",internalOrderId:"ORDER-001",currency:"SAR",idempotencyKey:"request-123",lines:[{supplierSku:"SKU-1",quantity:1}]};
 it("validates currency/market, rejects simulation and missing acknowledgement",()=>{
  expect(validateSupplierOrderRequest("sa",order).currency).toBe("SAR");
  expect(()=>validateSupplierOrderRequest("eg",order)).toThrow("supplier_market_or_currency_mismatch");
  expect(()=>validateSupplierOrderRequest("sa",{...order,internalOrderId:"SIM-SA-ORDER-1"})).toThrow("synthetic_order_forbidden");
  expect(()=>validateSupplierOrderRequest("sa",{...order,lines:[{supplierSku:"SIM-SA-001",quantity:1}]})).toThrow("synthetic_order_forbidden");
  expect(()=>validateSupplierOrderReceipt(order,{market:"sa",internalOrderId:order.internalOrderId,idempotencyKey:order.idempotencyKey,accepted:true,supplierOrderId:null,observedAt:"2026-11-20T12:00:00Z",evidenceRef:null})).toThrow("supplier_acknowledgment_missing");
  expect(validateSupplierOrderReceipt(order,{market:"sa",internalOrderId:order.internalOrderId,idempotencyKey:order.idempotencyKey,accepted:true,supplierOrderId:"EXT-123",observedAt:"2026-11-20T12:00:00Z",evidenceRef:"signed:123"}).accepted).toBe(true);
 });
 it("validates supplier stock snapshots and forbids synthetic provider identities",()=>{
  const p={market:"sa",providerId:"provider",sku:"SKU-2",title:"Test",currency:"SAR",costMinor:200,stock:"available",stockObservedAt:"2026-11-20T12:00:00Z",evidenceRef:"source",variantSkus:[]};
  expect(validateSupplierProduct("sa",p).sku).toBe("SKU-2");
  expect(()=>validateSupplierProduct("sa",{...p,providerId:"SIM-provider"})).toThrow("synthetic_supplier_identity_forbidden");
  expect(()=>validateSupplierProduct("sa",{...p,currency:"IQD"})).toThrow("supplier_market_or_currency_mismatch");
 });
});
describe("offline outbox and signed fixture events",()=>{
 const enqueue=(q:ReturnType<typeof createSimulatedOutbox>,market:"sa"|"eg"="sa")=>q.enqueue({mode:SIMULATION_MODE,market,jobType:"catalog_sync",dedupeKey:"catalog-seed",dueAtMs:1000,payload:{batch:1}});
 it("deduplicates per-market and rejects changed job payloads",()=>{
  const q=createSimulatedOutbox();
  expect(enqueue(q).id).toBe(enqueue(q).id);
  expect(enqueue(q,"eg").id).not.toBe(enqueue(q).id);
  expect(()=>q.enqueue({mode:SIMULATION_MODE,market:"sa",jobType:"catalog_sync",dedupeKey:"catalog-seed",dueAtMs:1000,payload:{batch:2}})).toThrow("job_dedupe_conflict");
 });
 it("leases with fencing, exponential backoff and dead-letter after 3 failures",()=>{
  const q=createSimulatedOutbox();
  const job=enqueue(q);
  expect(q.lease({mode:SIMULATION_MODE,market:"sa",nowMs:999,leaseMs:100})).toBeNull();
  const first=q.lease({mode:SIMULATION_MODE,market:"sa",nowMs:1000,leaseMs:100})!;
  expect(first.attempts).toBe(1);
  expect(q.lease({mode:SIMULATION_MODE,market:"sa",nowMs:1005,leaseMs:100})).toBeNull();
  expect(()=>q.complete({mode:SIMULATION_MODE,market:"sa",id:job.id,expectedAttempt:0,success:true,nowMs:1020})).toThrow("stale_lease");
  const failed=q.complete({mode:SIMULATION_MODE,market:"sa",id:job.id,expectedAttempt:1,success:false,nowMs:1050});
  expect(failed.status).toBe("queued");
  const second=q.lease({mode:SIMULATION_MODE,market:"sa",nowMs:3050,leaseMs:100})!;
  expect(second.attempts).toBe(2);
  q.complete({mode:SIMULATION_MODE,market:"sa",id:job.id,expectedAttempt:2,success:false,nowMs:3070});
  const third=q.lease({mode:SIMULATION_MODE,market:"sa",nowMs:7070,leaseMs:100})!;
  const done=q.complete({mode:SIMULATION_MODE,market:"sa",id:job.id,expectedAttempt:3,success:false,nowMs:7080});
  expect(done.status).toBe("dead_letter");
  expect(third.attempts).toBe(3);
  expect(q.lease({mode:SIMULATION_MODE,market:"sa",nowMs:999999,leaseMs:100})).toBeNull();
 });
 it("restores queued and leased jobs after snapshot/replay, rejects cross-market writes",()=>{
  const q=createSimulatedOutbox();
  const j=enqueue(q);
  const lease=q.lease({mode:SIMULATION_MODE,market:"sa",nowMs:1000,leaseMs:100})!;
  const restored=createSimulatedOutbox(JSON.parse(JSON.stringify(q.snapshot())));
  expect(()=>restored.complete({mode:SIMULATION_MODE,market:"iq",id:j.id,expectedAttempt:1,success:true,nowMs:1050})).toThrow("job_not_found_or_cross_market");
  expect(restored.lease({mode:SIMULATION_MODE,market:"sa",nowMs:1100,leaseMs:100})!.attempts).toBe(2);
  expect(()=>restored.complete({mode:SIMULATION_MODE,market:"sa",id:j.id,expectedAttempt:lease.attempts,success:true,nowMs:1120})).toThrow("stale_lease");
 });
 it("checks signature, market, tampering and duplicate signed events",()=>{
  const q=createSimulatedOutbox();
  const secret="synthetic-test-secret";
  const event=createSignedSyntheticEvent({mode:SIMULATION_MODE,market:"sa",eventId:"event-one",orderId:"SIM-SA-ORDER-0001",status:"confirmed",secret});
  const input={mode:SIMULATION_MODE,expectedMarket:"sa" as const,event,secret,outbox:q,nowMs:1000};
  const accepted=acceptSignedSyntheticEvent(input);
  expect(accepted.payload.orderId).toBe("SIM-SA-ORDER-0001");
  expect(acceptSignedSyntheticEvent(input).id).toBe(accepted.id);
  expect(()=>acceptSignedSyntheticEvent({...input,secret:"wrong-test-secret"})).toThrow("invalid_signature");
  expect(()=>acceptSignedSyntheticEvent({...input,expectedMarket:"eg"})).toThrow("simulation_market_mismatch");
  expect(()=>acceptSignedSyntheticEvent({...input,event:{...event,eventId:"other-id"}})).toThrow("invalid_event_payload");
 });
});
describe("address fixtures",()=>{
 it.each(countries)("preserves country-specific fields without customer PII for %s",market=>{
  const a=validateSyntheticAddress(market,addressSamples[market]);
  expect(a.market).toBe(market);
  expect(a.synthetic).toBe(true);
  expect(a.phonePlaceholder).toContain("X");
  expect(a.street).toBe("شارع تجريبي");
  expect(()=>validateSyntheticAddress(market,{...a,phonePlaceholder:"+96170123456"})).toThrow("unsafe_or_cross_market_address");
 });
 it("rejects cross-market address mixing",()=>{
  expect(()=>validateSyntheticAddress("sa",addressSamples.eg)).toThrow("unsafe_or_cross_market_address");
 });
});
