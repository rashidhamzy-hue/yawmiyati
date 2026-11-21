/**
 * M4B: offline-only product/media/category/variant/stock approval contract.
 *
 * Advisory deterministic validator, not a trust boundary. Inputs can be forged
 * by callers. NEVER use this result to publish or sell a product. A future
 * authenticated server must verify provider/media evidence and owner signoff
 * from locked records, check buyer-facing rights, then enforce release gates
 * transactionally. This module has no network, persistence or provider calls.
 */
import {markets,type MarketCode} from "./markets";

export const CATEGORY_SLUGS=["home","kitchen","beauty","fashion","wellness","organize"] as const;
export type CategorySlug=typeof CATEGORY_SLUGS[number];
export type ProofMedia={
 id:string;url:string;alt:string;sha256:string;
 sourceRef:string;rightsRef:string;approvedRevision:string;
};
export type ProofVariant={
 sku:string;attributes:Readonly<Record<string,string>>;
 priceMinor:number;stock:"available"|"unavailable"|"unknown";
 availableUnits:number|null;observedAt:string;
 stockSourceRef:string;costMinor:number|null;costSourceRef:string|null;
};
export type ProductProofInput={
 market:MarketCode;currency:string;providerId:string;sourceProductId:string;
 productSku:string;title:string;contentRevision:string;
 approvedContentRevision:string|null;ownerApprovalRef:string|null;
 categorySlugs:readonly string[];categoryApprovalRef:string|null;
 media:readonly ProofMedia[];mediaApprovalRef:string|null;
 variants:readonly ProofVariant[];observedAt:string;
};
export type ProofIssue={
 path:string;code:
 |"market_currency"|"identity"|"synthetic_identity"|"content_approval"
 |"category_provenance"|"invalid_category"|"duplicate_category"
 |"media_provenance"|"invalid_media"|"duplicate_media"
 |"variant_matrix"|"duplicate_variant"|"stock_freshness"|"stock_evidence"
 |"cost_evidence"|"price_precision"|"too_many_items";
};
export type ProductProofResult={
 readonly market:MarketCode;readonly advisory:"OFFLINE_ONLY";
 readonly issues:readonly ProofIssue[];
 readonly readyForHumanReview:boolean;
 readonly publishAuthorized:false;readonly orderable:false;
 readonly canSyncSupplier:false;readonly hasVerifiedRealEvidence:false;
};
const id=(v:unknown,max=200)=>typeof v==="string"&&v.trim().length>0&&v.length<=max&&
 !/[\x00-\x1f]/.test(v);
const synthetic=(v:string)=>/^sim(?:[-_:]|$)|^demo(?:[-_:]|$)|^fixture(?:[-_:]|$)/i.test(v);
const sha=(v:unknown)=>typeof v==="string"&&/^[a-f0-9]{64}$/i.test(v);
const time=(value:unknown,now:number,ttlMs:number)=>{
 if(typeof value!=="string"||!/\d{4}-\d{2}-\d{2}T/.test(value))return false;
 const t=Date.parse(value);
 return Number.isFinite(t)&&t<=now&&now-t<=ttlMs;
};
const secureUrl=(raw:unknown,hosts:readonly string[])=>{
 if(typeof raw!=="string"||raw.length>2000||hosts.length===0)return false;
 try{
  const u=new URL(raw);
  const allowed=new Set(hosts.map(x=>x.toLowerCase()));
  return u.protocol==="https:"&&u.port===""&&!!u.hostname&&
   !u.username&&!u.password&&!u.hash&&!u.search&&
   allowed.has(u.hostname.toLowerCase())&&
   !/(?:^|\.)localhost$|(?:^|\.)local$/.test(u.hostname)&&
   !/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname);
 }catch{return false;}
};
const attrKey=(a:Readonly<Record<string,string>>):string=>{
 return JSON.stringify(Object.entries(a).sort(([x],[y])=>x.localeCompare(y)));
};

/**
 * Allowed hosts are supplied by a future owner-approved media-domain policy;
 * passing them to this helper does not prove that policy is genuine.
 * Stock TTL is 15 minutes; content/media source evidence must be rechecked
 * separately by an authenticated server before listing release.
 */
export function assessOfflineProductProof(
 input:ProductProofInput,expectedMarket:MarketCode,asOf:string,
 allowedMediaHosts:readonly string[],
):ProductProofResult {
 const issues:ProofIssue[]=[];
 const add=(path:string,code:ProofIssue["code"])=>issues.push({path,code});
 const now=Date.parse(asOf);
 if(!Object.hasOwn(markets,expectedMarket)||input.market!==expectedMarket||
   input.currency!==markets[expectedMarket]?.currency)add("market","market_currency");
 if(!id(input.providerId,120)||!id(input.sourceProductId)||
   !id(input.productSku)||!id(input.title,300))add("identity","identity");
 if([input.providerId,input.sourceProductId,input.productSku].some(v=>typeof v==="string"&&synthetic(v)))
  add("identity","synthetic_identity");
 if(!id(input.contentRevision)||input.contentRevision!==input.approvedContentRevision||
   !id(input.ownerApprovalRef,500))add("contentRevision","content_approval");
 if(!id(input.categoryApprovalRef,500))add("categorySlugs","category_provenance");
 if(!Array.isArray(input.categorySlugs)||input.categorySlugs.length<1||input.categorySlugs.length>6)
  add("categorySlugs","invalid_category");
 else{
  if(new Set(input.categorySlugs).size!==input.categorySlugs.length)add("categorySlugs","duplicate_category");
  input.categorySlugs.forEach((x,i)=>{
   if(!CATEGORY_SLUGS.includes(x as CategorySlug))add("categorySlugs["+i+"]","invalid_category");
  });
 }
 if(!id(input.mediaApprovalRef,500))add("media","media_provenance");
 if(!Array.isArray(input.media)||input.media.length<1||input.media.length>12)
  add("media","too_many_items");
 else{
  const ids=new Set<string>(),digests=new Set<string>();
  input.media.forEach((m,i)=>{
   const path="media["+i+"]";
   if(!m||!id(m.id)||!id(m.alt,240)||!sha(m.sha256)||
      !id(m.sourceRef,500)||!id(m.rightsRef,500)||
      !id(m.approvedRevision)||m.approvedRevision!==input.contentRevision||
      !secureUrl(m.url,allowedMediaHosts))add(path,"invalid_media");
   if(ids.has(m?.id)||digests.has(m?.sha256))add(path,"duplicate_media");
   if(m){ids.add(m.id);digests.add(m.sha256);}
  });
 }
 if(!Array.isArray(input.variants)||input.variants.length<1||input.variants.length>100)
  add("variants","too_many_items");
 else{
  const skus=new Set<string>(),matrix=new Set<string>();
  input.variants.forEach((v,i)=>{
   const path="variants["+i+"]";
   if(!v||!id(v.sku)||synthetic(v.sku)||!v.attributes||
     typeof v.attributes!=="object"||Array.isArray(v.attributes)||
     Object.keys(v.attributes).length>8||
     Object.entries(v.attributes).some(([k,val])=>!id(k,60)||!id(val,120)))
    add(path,"variant_matrix");
   else {
    const fingerprint=attrKey(v.attributes);
    if(skus.has(v.sku)||matrix.has(fingerprint))add(path,"duplicate_variant");
    skus.add(v.sku);matrix.add(fingerprint);
   }
   if(!Number.isSafeInteger(v?.priceMinor)||v.priceMinor<=0)add(path,"price_precision");
   if(!time(v?.observedAt,now,15*60_000))add(path,"stock_freshness");
   if(v?.stock!=="available"||!Number.isSafeInteger(v?.availableUnits)||
      (v?.availableUnits??0)<=0||!id(v?.stockSourceRef,500))add(path,"stock_evidence");
   if(!Number.isSafeInteger(v?.costMinor)||v.costMinor===null||v.costMinor<0||
      !id(v?.costSourceRef,500))add(path,"cost_evidence");
  });
 }
 if(!time(input.observedAt,now,15*60_000))add("observedAt","stock_freshness");
 return {market:expectedMarket,advisory:"OFFLINE_ONLY",issues,
  readyForHumanReview:issues.length===0,
  publishAuthorized:false,orderable:false,canSyncSupplier:false,hasVerifiedRealEvidence:false};
}
