/**
 * M4E offline SEO release planning. No live canonical tags, sitemap XML,
 * hreflang tags, search indexing, JSON-LD, network calls or publishing.
 * Caller-provided "evidence" is untrusted and NEVER authorizes indexing.
 */
import {markets,type MarketCode} from "./markets";
import {SEO_EDITORIAL_SLUGS,planMarketSeo,planCategorySeo,planProductSeo,type SeoDraft} from "./seo-planning";
import {marketExperience} from "./market-experience";
import type {PublicListing} from "./public-catalog";

export type SeoEvidence={
 readonly contentApproved:boolean;
 readonly policyReviewed:boolean;
 readonly sourceRightsVerified:boolean;
 readonly marketReleaseSigned:boolean;
 readonly routeLiveVerified:boolean;
 readonly sourceRef:string|null;
 readonly contentRevision:string|null;
 readonly ownerDecisionRef:string|null;
};
export type SeoCandidate={
 readonly market:MarketCode;
 readonly kind:"home"|"category"|"product";
 readonly category?:string;
 readonly product?:PublicListing;
 /** Same cross-country entity; only an explicitly approved reference may group product translations. */
 readonly alternateGroupRef?:string|null;
 readonly evidence:SeoEvidence;
};
export type SeoBlocker=
 |"invalid_market"|"invalid_route"|"invalid_product"|"missing_content_approval"
 |"missing_policy_review"|"missing_media_rights"|"missing_market_signoff"
 |"missing_live_verification"|"missing_evidence_reference"|"duplicate_route"
 |"invalid_alternate_group"|"conflicting_alternate_group";
export type OfflineSeoEntry={
 readonly market:MarketCode;
 readonly kind:SeoCandidate["kind"];
 readonly relativePath:string|null;
 readonly title:string|null;
 readonly blockers:readonly SeoBlocker[];
 readonly reviewReady:boolean;
 /** Proposed relative sibling routes only; never emit link rel=alternate from these. */
 readonly alternateSuggestions:readonly {readonly market:MarketCode;readonly relativePath:string}[];
 readonly internalLinkSuggestions:readonly string[];
 readonly robots:"noindex,nofollow";
 readonly canonicalUrl:null;
 readonly hreflang:readonly never[];
 readonly sitemapEligible:false;
 readonly structuredData:null;
 readonly releaseAuthorized:false;
};
export type OfflineSeoAudit={
 readonly mode:"OFFLINE_ONLY";
 readonly entries:readonly OfflineSeoEntry[];
 readonly proposalCount:number;
 readonly needsReviewCount:number;
 readonly publishableCount:0;
 readonly sitemapXml:null;
 readonly robotsTxt:null;
 readonly canonicalManifest:null;
};
const marketCodes=Object.keys(markets) as MarketCode[];
const validRef=(v:unknown)=>typeof v==="string"&&v.trim().length>=4&&v.length<=160&&!/[\x00-\x1f<>]/.test(v);
const reviewEvidence=(e:SeoEvidence):SeoBlocker[]=>{
 const b:SeoBlocker[]=[];
 if(!e?.contentApproved)b.push("missing_content_approval");
 if(!e?.policyReviewed)b.push("missing_policy_review");
 if(!e?.sourceRightsVerified)b.push("missing_media_rights");
 if(!e?.marketReleaseSigned)b.push("missing_market_signoff");
 if(!e?.routeLiveVerified)b.push("missing_live_verification");
 if(!validRef(e?.sourceRef)||!validRef(e?.contentRevision)||!validRef(e?.ownerDecisionRef))b.push("missing_evidence_reference");
 return b;
};
function route(candidate:SeoCandidate):SeoDraft|null {
 if(!Object.hasOwn(markets,candidate.market))return null;
 if(candidate.kind==="home"){
  if(candidate.category!==undefined||candidate.product!==undefined)return null;
  return planMarketSeo(candidate.market);
 }
 if(candidate.kind==="category"){
  if(candidate.product!==undefined)return null;
  return planCategorySeo(candidate.market,candidate.category);
 }
 if(candidate.kind==="product"){
  if(candidate.category!==undefined||!candidate.product)return null;
  return planProductSeo(candidate.market,candidate.product);
 }
 return null;
}
const dedupe=(values:readonly string[]):string[]=>[...new Set(values)];
/** Safe source-only links to editorial category pages in the selected country. */
export function planMarketEditorialLinks(market:MarketCode,category?:string):readonly string[]{
 if(!Object.hasOwn(markets,market))throw Error("invalid_seo_market");
 if(category!==undefined&&!SEO_EDITORIAL_SLUGS.some(x=>x===category))throw Error("invalid_editorial_category");
 const order=marketExperience[market].categoryOrder.filter(x=>SEO_EDITORIAL_SLUGS.some(y=>y===x));
 const result=["/"+market+"/",...order.filter(x=>x!==category).map(x=>"/"+market+"/c/"+x)];
 return dedupe(result);
}
/**
 * A future authenticated server must independently verify all references and
 * only then produce real SEO metadata. This function deliberately cannot.
 * It does not generate sitemap.xml or robots.txt even if every boolean is true.
 */
export function auditOfflineSeoCandidates(candidates:readonly SeoCandidate[]):OfflineSeoAudit{
 if(!Array.isArray(candidates)||candidates.length>500)throw Error("offline_seo_candidate_limit");
 const keys=new Set<string>();
 const staged:{candidate:SeoCandidate;draft:SeoDraft|null;blockers:SeoBlocker[]}[]=[];
 for(const candidate of candidates){
  if(!candidate||typeof candidate!=="object")throw Error("invalid_seo_candidate");
  const blockers=reviewEvidence(candidate.evidence);
  const marketValid=Object.hasOwn(markets,candidate.market);
  if(!marketValid)blockers.push("invalid_market");
  let draft:SeoDraft|null=null;
  if(marketValid){
   draft=route(candidate);
   if(!draft)blockers.push("invalid_route");
  }
  if(candidate.kind==="product"&&!draft)blockers.push("invalid_product");
  if(candidate.alternateGroupRef!=null&&!validRef(candidate.alternateGroupRef))blockers.push("invalid_alternate_group");
  if(draft){
   if(keys.has(draft.relativePath))blockers.push("duplicate_route");
   keys.add(draft.relativePath);
  }
  staged.push({candidate,draft,blockers});
 }
 const groups=new Map<string,number[]>();
 for(let i=0;i<staged.length;i++){
  const r=staged[i];
  if(!r.draft||r.blockers.length||!r.candidate.alternateGroupRef)continue;
  const id=r.candidate.kind+":"+(r.candidate.kind==="category"?r.candidate.category+":":"")+r.candidate.alternateGroupRef;
  groups.set(id,[...(groups.get(id)??[]),i]);
 }
 for(const ids of groups.values()){
  const marketsInGroup=ids.map(i=>staged[i].candidate.market);
  if(new Set(marketsInGroup).size!==ids.length){
   ids.forEach(i=>staged[i].blockers.push("conflicting_alternate_group"));
  }
 }
 const entries=staged.map((r,i):OfflineSeoEntry=>{
  const approved=r.blockers.length===0;
  const group=r.candidate.alternateGroupRef ? groups.get(r.candidate.kind+":"+(r.candidate.kind==="category"?r.candidate.category+":":"")+r.candidate.alternateGroupRef)??[] : [];
  const siblings=approved&&r.draft ? group.filter(j=>j!==i&&staged[j].blockers.length===0&&staged[j].draft).map(j=>({
   market:staged[j].candidate.market,relativePath:staged[j].draft!.relativePath,
  })).sort((a,b)=>marketCodes.indexOf(a.market)-marketCodes.indexOf(b.market)) : [];
  return {
   market:r.candidate.market,kind:r.candidate.kind,
   relativePath:r.draft?.relativePath??null,
   title:r.draft?.title??null,
   blockers:dedupe(r.blockers) as SeoBlocker[],
   reviewReady:approved,
   alternateSuggestions:siblings,
   internalLinkSuggestions:r.draft ? planMarketEditorialLinks(r.candidate.market,r.candidate.kind==="category"?r.candidate.category:undefined) : [],
   robots:"noindex,nofollow",
   canonicalUrl:null,hreflang:[],sitemapEligible:false,
   structuredData:null,releaseAuthorized:false,
  };
 });
 return {mode:"OFFLINE_ONLY",entries,proposalCount:entries.length,
  needsReviewCount:entries.filter(e=>!e.reviewReady).length,
  publishableCount:0,sitemapXml:null,robotsTxt:null,canonicalManifest:null};
}
/**
 * Drafts for editorial routing, not listings or an indexable sitemap.
 * All values are explicit "unreviewed" placeholders: 40 routes, no product inventory.
 */
export function planOfflineEditorialSeoAudit():OfflineSeoAudit{
 const e:SeoEvidence={contentApproved:false,policyReviewed:false,sourceRightsVerified:false,
  marketReleaseSigned:false,routeLiveVerified:false,sourceRef:null,contentRevision:null,ownerDecisionRef:null};
 const rows=marketCodes.flatMap(market=>([
  {market,kind:"home" as const,alternateGroupRef:"editorial_home",evidence:e},
  ...SEO_EDITORIAL_SLUGS.map(category=>({market,kind:"category" as const,category,alternateGroupRef:"editorial_"+category,evidence:e})),
 ]));
 return auditOfflineSeoCandidates(rows);
}
