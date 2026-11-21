import {describe,it,expect} from "vitest";
import {summarizeOwnerActions} from "./owner-action-queue";
const disabled={enabled:false,daily_budget_microusd:0,auto_pricing_enabled:false,auto_publish_enabled:false};
describe("owner operations action queue",()=>{
 it("displays unknowns as unknown instead of treating them as zero",()=>{
  const r=summarizeOwnerActions("sa",null,null,null);
  expect(r).toMatchObject({market:"sa",pendingProposalCount:null,catalogRecordCount:null,aiPolicyKnown:false,liveReleaseVerified:false});
  expect(r.actions.map(a=>a.code)).toEqual(expect.arrayContaining(["policy_not_loaded","proposals_unknown","catalog_unknown","release_requirements"]));
 });
 it("prioritizes real observed pending approvals and active automation",()=>{
  const r=summarizeOwnerActions("eg",[],[{id:"a",kind:"copy",rationale:"",state:"pending",proposal:{},created_at:"2026-11-21"},
   {id:"b",kind:"copy",rationale:"",state:"approved",proposal:{},created_at:"2026-11-21"}],
  {...disabled,enabled:true});
  expect(r.pendingProposalCount).toBe(1);
  expect(r.actions.map(a=>a.code)).toEqual(expect.arrayContaining(["automation_enabled","proposals_pending"]));
  expect(r.liveReleaseVerified).toBe(false);
 });
 it("never labels inventory observations as live stock proof",()=>{
  const r=summarizeOwnerActions("iq",[{listing_id:"x",slug:"x",title:"",listing_status:"draft",variant_count:1,available_count:7}],[],disabled);
  expect(r.catalogRecordCount).toBe(1);
  expect(r.actions.some(a=>a.code==="inventory_observation"&&a.explanation.includes("not a verified"))).toBe(true);
 });
 it("supports all five markets and rejects invalid codes",()=>{
  for(const m of ["sa","ae","om","eg","iq"] as const){
   expect(summarizeOwnerActions(m,[],[],disabled).market).toBe(m);
  }
  expect(()=>summarizeOwnerActions("fr" as "sa",[],[],disabled)).toThrow();
 });
});
