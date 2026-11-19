import {expect,it} from "vitest";
import {prepareListingDraft,publicationGate,type CandidateApprovalInput,type PublicationInput} from "../lib/store/catalog-approval";
const now="2026-11-19T12:00:00Z";
const candidate:CandidateApprovalInput={market:"sa",wooProductId:12,wooVariationId:0,sku:"fixture",observedAt:now,decision:"shortlisted",proposedPriceMinor:10000,supplierCostMinor:4000,title:"Fixture",contentRevision:"r1",approvedContentRevision:"r1",approvedBy:"owner"};
it("prepares only an unsellable draft",()=>{
 const result=prepareListingDraft(candidate,now);
 expect(result.ready).toBe(true);
 if(result.ready){expect(result.status).toBe("draft");expect(result.stockState).toBe("unknown");}
});
it("blocks unverified economics, stale source data and changed content",()=>{
 const result=prepareListingDraft({...candidate,supplierCostMinor:null,contentRevision:"r2",observedAt:"2026-11-17T00:00:00Z"},now);
 expect(result.ready).toBe(false);
 if(!result.ready)expect(result.failures).toEqual(["fresh_supplier_observation","verified_cost","approved_content_revision"]);
});
const release:PublicationInput={listingStatus:"approved",stockState:"available",stockCheckedAt:now,stockVerified:true,approvalCurrent:true,commercialReviewCurrent:true,marketReleaseAuthorized:true};
it("requires all release conditions",()=>{
 expect(publicationGate(release,now).ready).toBe(true);
 expect(publicationGate({...release,marketReleaseAuthorized:false,stockVerified:false},now).ready).toBe(false);
 expect(publicationGate(release,"2026-11-19T12:16:00Z").failures).toContain("fresh_verified_stock");
 expect(publicationGate({...release,listingStatus:"draft"},now).ready).toBe(false);
});
