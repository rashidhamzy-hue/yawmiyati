/**
 * M5A: deterministic, offline shortlist for owner review. No provider access,
 * paid AI, publishing, stock claims, or database writes.
 * Inputs must be verified independently before being treated as real evidence.
 */
import type {MarketCode} from "./markets";
import {assessResearch,type Observation} from "./research-evidence";

export type ShortlistCandidate={
 readonly market:MarketCode;
 readonly sku:string;
 readonly observations:readonly Observation[];
 readonly stockVerifiedAt?:string;
 readonly commercialCostVerified:boolean;
 readonly mediaRightsVerified:boolean;
 readonly variantsVerified:boolean;
};
export type ShortlistResult={
 readonly market:MarketCode;
 readonly sku:string;
 readonly score:number|null;
 readonly rank:number|null;
 readonly missing:readonly string[];
 readonly blockers:readonly string[];
 readonly eligibleForOwnerReview:boolean;
 readonly canPublish:false;
 readonly canOrder:false;
};
const validDate=(s:string)=>Number.isFinite(Date.parse(s));
export function shortlistCandidates(market:MarketCode,candidates:readonly ShortlistCandidate[],asOf:string,limit=150):readonly ShortlistResult[]{
 if(!["sa","ae","om","eg","iq"].includes(market)||!validDate(asOf)||!Number.isInteger(limit)||limit<1||limit>150)throw Error("Invalid shortlist context");
 if(candidates.length>10000)throw Error("Candidate limit exceeded");
 const seen=new Set<string>();
 const results=candidates.map(c=>{
  if(c.market!==market||!c.sku?.trim()||seen.has(c.sku))throw Error("Cross-market or duplicate SKU");
  seen.add(c.sku);
  const blockers:string[]=[];
  let score:number|null=null;
  let missing:string[]=[];
  try{
   const assessment=assessResearch(market,c.sku,c.observations,asOf);
   score=assessment.score;
   missing=assessment.missing;
  }catch{blockers.push("invalid_research_evidence");}
  if(missing.length)blockers.push("incomplete_research");
  if(!c.commercialCostVerified)blockers.push("unverified_cost");
  if(!c.mediaRightsVerified)blockers.push("unverified_media_rights");
  if(!c.variantsVerified)blockers.push("unverified_variants");
  if(!c.stockVerifiedAt||!validDate(c.stockVerifiedAt)||Date.parse(c.stockVerifiedAt)>Date.parse(asOf)||
    Date.parse(asOf)-Date.parse(c.stockVerifiedAt)>86400000)blockers.push("stale_or_unverified_stock");
  return {market,sku:c.sku,score,rank:null,missing,blockers,
   eligibleForOwnerReview:blockers.length===0,canPublish:false as const,canOrder:false as const};
 });
 // A high research score never overrides commercial or provenance blockers.
 results.sort((a,b)=>Number(b.eligibleForOwnerReview)-Number(a.eligibleForOwnerReview)||
   (b.score??-1)-(a.score??-1)||a.sku.localeCompare(b.sku,"en"));
 return results.slice(0,limit).map((r,i)=>({...r,rank:r.eligibleForOwnerReview?i+1:null}));
}
