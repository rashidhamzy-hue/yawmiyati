/**
 * M3A — source-only launch-readiness assessment, not a launch authorization service.
 * No provider or Supabase data, no secrets, no real orders, no external I/O.
 * Local checklist inputs NEVER change any release flag or prove source evidence.
 */
import {markets,type MarketCode} from "../markets";

export const READINESS_GATES = [
  {id:"supplier_contract",label:"Supplier agreement and market-specific authenticated contract",scope:"market"},
  {id:"catalog_provenance",label:"Owner-approved authentic products, media rights and variants",scope:"market"},
  {id:"stock_cost",label:"Fresh verified stock and wholesale-cost evidence",scope:"market"},
  {id:"delivery_cod",label:"Verified shipping rates, COD/return/refusal economics",scope:"market"},
  {id:"country_legal",label:"Approved privacy, returns, payments and consumer policies",scope:"market"},
  {id:"checkout_e2e",label:"Authenticated idempotent end-to-end order and reconciliation test",scope:"market"},
  {id:"security_abuse",label:"Access control, abuse limits, backups and incident tests",scope:"market"},
  {id:"owner_signoff",label:"Explicit owner production-release authorization",scope:"market"},
] as const;
export type ReadinessGateId=typeof READINESS_GATES[number]["id"];
export type LocalReviewNote = "not_reviewed" | "reviewed_offline" | "needs_work";
export type LocalNote = {market:MarketCode;gate:ReadinessGateId;note:LocalReviewNote};
export type ReadinessStatus = {
  readonly market:MarketCode; readonly currency:string;
  readonly gates:readonly {id:ReadinessGateId; label:string; verified:false; review:LocalReviewNote; blocker:string}[];
  readonly blocked:true; readonly verifiedCount:0; readonly blockedCount:number;
  readonly canPublish:false;readonly canCheckout:false;readonly canDispatch:false;readonly canSpend:false;
};
const marketKeys=Object.keys(markets) as MarketCode[];
const allowed:readonly LocalReviewNote[]=["not_reviewed","reviewed_offline","needs_work"];
export function parseLocalNotes(input:unknown):LocalNote[]{
 if(!Array.isArray(input)||input.length>marketKeys.length*READINESS_GATES.length)throw Error("invalid_local_review_notes");
 const seen=new Set<string>();
 return input.map(raw=>{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("invalid_local_review_notes");
  const row=raw as Record<string,unknown>;
  if(typeof row.market!=="string"||!Object.hasOwn(markets,row.market)||
    typeof row.gate!=="string"||!READINESS_GATES.some(g=>g.id===row.gate)||
    !allowed.includes(row.note as LocalReviewNote)||
    Object.keys(row).some(k=>!["market","gate","note"].includes(k)))throw Error("invalid_local_review_notes");
  const key=row.market+":"+row.gate;
  if(seen.has(key))throw Error("duplicate_local_review_note");
  seen.add(key);
  return {market:row.market as MarketCode,gate:row.gate as ReadinessGateId,note:row.note as LocalReviewNote};
 });
}
export function offlineReadiness(market:MarketCode,rawNotes:unknown=[]):ReadinessStatus {
 if(!Object.hasOwn(markets,market))throw Error("invalid_market");
 const notes=parseLocalNotes(rawNotes);
 const rows=READINESS_GATES.map(gate=>({
  id:gate.id,label:gate.label,verified:false as const,
  review:notes.find(n=>n.market===market&&n.gate===gate.id)?.note??"not_reviewed" as LocalReviewNote,
  blocker:"requires_authenticated_production_evidence_and_explicit_owner_release",
 }));
 return {
  market,currency:markets[market].currency,gates:rows,blocked:true,
  verifiedCount:0,blockedCount:rows.length,
  canPublish:false,canCheckout:false,canDispatch:false,canSpend:false,
 };
}
export function fiveMarketReadiness(rawNotes:unknown=[]) {
 const notes=parseLocalNotes(rawNotes);
 const countries=marketKeys.map(market=>offlineReadiness(market,notes));
 return {mode:"OFFLINE_REVIEW_ONLY" as const,syntheticReview:true,blocked:true,
  allFiveReady:false as const,releaseAuthorization:false as const,
  verifiedEvidenceSources:0,blockedGates:countries.reduce((n,x)=>n+x.blockedCount,0),
  countries};
}
export function exportLocalReadinessNotes(input:unknown):string {
 const notes=parseLocalNotes(input);
 // Export only non-sensitive enum selections, never user-generated strings or supplier records.
 return JSON.stringify({
  kind:"yawmiyati_local_launch_readiness_notes",
  mode:"OFFLINE_REVIEW_ONLY",
  changesProduction:false,
  evidenceVerified:false,
  notes,
  readiness:fiveMarketReadiness(notes),
 },null,2);
}
