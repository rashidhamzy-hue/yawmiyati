import type {MarketCode} from "./markets";
export type CandidateApprovalInput={
 market:MarketCode; wooProductId:number; wooVariationId:number; sku:string;
 observedAt:string; decision:"pending"|"shortlisted"|"rejected";
 proposedPriceMinor:number|null; supplierCostMinor:number|null;
 title:string; contentRevision:string|null; approvedContentRevision:string|null;
 approvedBy:string|null;
};
export function prepareListingDraft(x:CandidateApprovalInput,asOf:string){
 const failures:string[]=[];
 const now=Date.parse(asOf),observed=Date.parse(x.observedAt);
 if(!Number.isFinite(now)||!Number.isFinite(observed)||observed>now||now-observed>24*3600000)failures.push("fresh_supplier_observation");
 if(!Number.isSafeInteger(x.wooProductId)||x.wooProductId<=0||!Number.isSafeInteger(x.wooVariationId)||x.wooVariationId<0||!x.sku.trim())failures.push("supplier_identity");
 if(x.decision!=="shortlisted")failures.push("commercial_shortlist");
 if(x.proposedPriceMinor===null||!Number.isSafeInteger(x.proposedPriceMinor)||x.proposedPriceMinor<=0)failures.push("verified_price");
 if(x.supplierCostMinor===null||!Number.isSafeInteger(x.supplierCostMinor)||x.supplierCostMinor<0)failures.push("verified_cost");
 if(!x.title.trim()||x.title.length>500||!x.contentRevision?.trim()||x.contentRevision!==x.approvedContentRevision||!x.approvedBy?.trim())failures.push("approved_content_revision");
 if(failures.length)return {ready:false as const,failures};
 return {ready:true as const,market:x.market,source:{wooProductId:x.wooProductId,wooVariationId:x.wooVariationId,sku:x.sku},title:x.title.trim(),priceMinor:x.proposedPriceMinor!,contentRevision:x.contentRevision!,status:"draft" as const,stockState:"unknown" as const};
}
export type PublicationInput={
 listingStatus:"draft"|"approved"|"published"|"suspended"|"archived";
 stockState:"unknown"|"available"|"unavailable"; stockCheckedAt:string|null;
 stockVerified:boolean; approvalCurrent:boolean; commercialReviewCurrent:boolean;
 marketReleaseAuthorized:boolean;
};
export function publicationGate(x:PublicationInput,asOf:string){
 const failures:string[]=[];
 const now=Date.parse(asOf),stockAt=x.stockCheckedAt?Date.parse(x.stockCheckedAt):NaN;
 if(x.listingStatus!=="approved")failures.push("listing_approved");
 if(!x.stockVerified||x.stockState!=="available"||!Number.isFinite(now)||!Number.isFinite(stockAt)||stockAt>now||now-stockAt>15*60000)failures.push("fresh_verified_stock");
 if(!x.approvalCurrent)failures.push("current_content_approval");
 if(!x.commercialReviewCurrent)failures.push("current_commercial_review");
 if(!x.marketReleaseAuthorized)failures.push("explicit_market_release");
 return {ready:failures.length===0,failures};
}
// Advisory only: server must derive inputs from locked DB records and enforce the same gates transactionally.
