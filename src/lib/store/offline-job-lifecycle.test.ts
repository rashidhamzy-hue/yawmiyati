import {describe,it,expect} from "vitest";
import {createOfflineJob,applyOfflineJobEvent,replayOfflineJob} from "./offline-job-lifecycle";
const t0="2026-11-21T08:00:00Z";
const t1="2026-11-21T08:01:00Z";
const t2="2026-11-21T08:02:00Z";
describe("offline AI job lifecycle",()=>{
 it("starts fail-closed, and finishing work still requires review",()=>{
  const start=createOfflineJob("eg","SKU-1","r1","localize",t0);
  expect(start).toMatchObject({status:"queued",attempts:0,canCallModel:false,canPublish:false,canSpend:false});
  const leased=applyOfflineJobEvent(start,{id:"e1",jobId:start.id,type:"lease",token:"token-1",until:t2},t0);
  const reviewed=applyOfflineJobEvent(leased,{id:"e2",jobId:start.id,type:"complete",token:"token-1"},t1);
  expect(reviewed.status).toBe("needs_review");
  expect(()=>applyOfflineJobEvent(reviewed,{id:"e3",jobId:start.id,type:"review_accept",revision:"r2",decisionRef:"test-review"},t2)).toThrow();
  const accepted=applyOfflineJobEvent(reviewed,{id:"e3",jobId:start.id,type:"review_accept",revision:"r1",decisionRef:"test-review"},t2);
  expect(accepted).toMatchObject({status:"review_accepted",canPublish:false,canCallModel:false});
 });
 it("retries bounded failures then dead-letters",()=>{
  const start=createOfflineJob("sa","SKU-2","r1","research",t0,2);
  const first=applyOfflineJobEvent(start,{id:"a",jobId:start.id,type:"lease",token:"L1",until:t1},t0);
  const retried=applyOfflineJobEvent(first,{id:"b",jobId:start.id,type:"fail",token:"L1",reason:"model_unavailable"},t0);
  expect(retried.status).toBe("queued");
  const second=applyOfflineJobEvent(retried,{id:"c",jobId:start.id,type:"lease",token:"L2",until:t2},t1);
  const dead=applyOfflineJobEvent(second,{id:"d",jobId:start.id,type:"fail",token:"L2",reason:"model_unavailable"},t1);
  expect(dead).toMatchObject({status:"dead_letter",attempts:2});
  expect(()=>applyOfflineJobEvent(dead,{id:"e",jobId:start.id,type:"lease",token:"L3",until:t2},t1)).toThrow();
 });
 it("expires leases and prevents stale completion",()=>{
  const start=createOfflineJob("om","SKU-3","r1","enrich",t0,1);
  const leased=applyOfflineJobEvent(start,{id:"a",jobId:start.id,type:"lease",token:"L",until:t1},t0);
  expect(()=>applyOfflineJobEvent(leased,{id:"b",jobId:start.id,type:"complete",token:"incorrect"},t0)).toThrow();
  expect(()=>applyOfflineJobEvent(leased,{id:"b",jobId:start.id,type:"expire"},t0)).toThrow();
  const dead=applyOfflineJobEvent(leased,{id:"b",jobId:start.id,type:"expire"},t2);
  expect(dead.status).toBe("dead_letter");
 });
 it("is event-idempotent, rejects conflicting replay and cross-job actions",()=>{
  const start=createOfflineJob("iq","SKU-4","r1","research",t0);
  const event={id:"x",jobId:start.id,type:"lease" as const,token:"token",until:t1};
  const leased=applyOfflineJobEvent(start,event,t0);
  expect(applyOfflineJobEvent(leased,event,t1)).toBe(leased);
  expect(()=>applyOfflineJobEvent(leased,{...event,token:"other"},t1)).toThrow();
  expect(()=>applyOfflineJobEvent(start,{...event,jobId:"ae:other"},t0)).toThrow();
  expect(replayOfflineJob(start,[{event,at:t0}])).toEqual(leased);
 });
 it("enforces time bounds and valid identity",()=>{
  const start=createOfflineJob("ae","SKU-5","r1","research",t1);
  expect(()=>applyOfflineJobEvent(start,{id:"x",jobId:start.id,type:"lease",token:"T",until:t2},t0)).toThrow();
  expect(()=>applyOfflineJobEvent(start,{id:"x",jobId:start.id,type:"lease",token:"T",until:"2026-11-21T08:12:00Z"},t1)).toThrow();
 });
});
