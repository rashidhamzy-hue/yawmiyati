/**
 * M5D: offline release readiness and owner decision contract.
 * Never mutates a database or enables publishing, checkout or indexing.
 */
import type {MarketCode} from "./markets";
export type ReleaseEvidence={
 readonly market:MarketCode;readonly sku:string;readonly revision:string;
 readonly sourceVerified:boolean;readonly costVerified:boolean;
 readonly stockFresh:boolean;readonly variantsVerified:boolean;
 readonly mediaLicensed:boolean;readonly editorialReviewed:boolean;
 readonly legalCopyApproved:boolean;readonly shippingConfirmed:boolean;
 readonly ownerApprovedRevision:string|null;
 readonly duplicateResolved:boolean;
};
export type ReleaseAssessment={
 readonly market:MarketCode;readonly sku:string;readonly revision:string;
 readonly blockers:readonly string[];
 readonly readyForReleaseReview:boolean;
 readonly canPublish:false;readonly canIndex:false;readonly canCheckout:false;
};
export function assessRelease(e:ReleaseEvidence):ReleaseAssessment{
 if(!["sa","ae","om","eg","iq"].includes(e.market)||!e.sku?.trim()||!e.revision?.trim())throw Error("Invalid release identity");
 const checks=[
  ["source_unverified",e.sourceVerified],["cost_unverified",e.costVerified],
  ["stock_stale",e.stockFresh],["variants_unverified",e.variantsVerified],
  ["media_unlicensed",e.mediaLicensed],["editorial_unreviewed",e.editorialReviewed],
  ["legal_copy_unapproved",e.legalCopyApproved],["shipping_unconfirmed",e.shippingConfirmed],
  ["duplicate_unresolved",e.duplicateResolved],
  ["owner_revision_unapproved",e.ownerApprovedRevision===e.revision]
 ] as const;
 const blockers=checks.filter(([,ok])=>ok!==true).map(([name])=>name);
 return {market:e.market,sku:e.sku,revision:e.revision,blockers,
  readyForReleaseReview:blockers.length===0,
  canPublish:false,canIndex:false,canCheckout:false};
}
export function assessReleaseBatch(market:MarketCode,items:readonly ReleaseEvidence[]):readonly ReleaseAssessment[]{
 if(items.length>10000)throw Error("Release batch too large");
 const seen=new Set<string>();
 return items.map(item=>{
  if(item.market!==market||seen.has(item.sku))throw Error("Cross-market or duplicate release candidate");
  seen.add(item.sku);
  return assessRelease(item);
 });
}
