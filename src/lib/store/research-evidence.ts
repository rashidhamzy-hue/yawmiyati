import {scoringWeights,scoreProduct,contentBrief} from "./intelligence";
import type {MarketCode} from "./markets";
type Factor=keyof typeof scoringWeights;
export type Observation={factor:Factor;score:number;source:string;observedAt:string;market:MarketCode;sku:string;verified:boolean};
export function assessResearch(market:MarketCode,sku:string,observations:readonly Observation[],asOf:string,maxAgeDays=30){
 const now=Date.parse(asOf);
 if(!Number.isFinite(now)||!Number.isFinite(maxAgeDays)||maxAgeDays<=0||!sku.trim())throw Error("Invalid assessment context");
 const evidence:Partial<Record<Factor,Observation>>={};
 for(const o of observations){
  if(o.market!==market||o.sku!==sku||!o.verified)continue;
  const timestamp=Date.parse(o.observedAt);
  if(!Number.isFinite(timestamp)||timestamp>now||now-timestamp>maxAgeDays*86400000)continue;
  if(!Object.hasOwn(scoringWeights,o.factor)||!Number.isFinite(o.score)||o.score<0||o.score>100||!o.source.trim())throw Error("Invalid verified observation");
  const previous=evidence[o.factor];
  if(!previous||timestamp>Date.parse(previous.observedAt))evidence[o.factor]=o;
  else if(timestamp===Date.parse(previous.observedAt)&&previous.score!==o.score)throw Error("Conflicting verified evidence");
 }
 const scores:Partial<Record<Factor,number>>={};
 for(const k of Object.keys(evidence) as Factor[])scores[k]=evidence[k]!.score;
 return {...scoreProduct(scores),evidence,market,sku,approvalRequired:true as const};
}
export type VerifiedFact={id:string;statement:string;source:string;verified:boolean};
export function prepareContent(market:MarketCode,facts:readonly VerifiedFact[],channel:"storefront"|"seo"|"social"|"ad"){
 const verified=facts.filter(f=>f.verified);
 if(verified.some(f=>!f.source.trim())||new Set(verified.map(f=>f.id)).size!==verified.length)throw Error("Invalid fact provenance");
 return {...contentBrief(market,verified.map(({id,statement})=>({id,statement})),channel),sourceRegistry:verified.map(({id,source})=>({id,source})),outputContract:{segments:[{text:"string",factIds:["verified fact ID"]}],requiresHumanClaimReview:true}};
}
export function validateContentDraft(draft:unknown,allowedFactIds:readonly string[]){
 if(!draft||typeof draft!=="object"||!Array.isArray((draft as {segments?:unknown}).segments))throw Error("Invalid draft");
 const segments=(draft as {segments:unknown[]}).segments;
 if(!segments.length||segments.length>30)throw Error("Invalid segment count");
 const allowed=new Set(allowedFactIds);
 for(const segment of segments){
  if(!segment||typeof segment!=="object")throw Error("Invalid segment");
  const s=segment as {text?:unknown;factIds?:unknown};
  if(typeof s.text!=="string"||!s.text.trim()||s.text.length>2000||!Array.isArray(s.factIds)||!s.factIds.length||s.factIds.some(id=>typeof id!=="string"||!allowed.has(id)))throw Error("Untraceable draft claim");
 }
 // Citation membership is not proof of semantic entailment or safety.
 return {state:"needs_human_review" as const,segments};
}
