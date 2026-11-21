import {describe,it,expect} from "vitest";
import {assessRelease,assessReleaseBatch,type ReleaseEvidence} from "./offline-release-readiness";
const good:ReleaseEvidence={market:"sa",sku:"A",revision:"r1",sourceVerified:true,costVerified:true,stockFresh:true,
 variantsVerified:true,mediaLicensed:true,editorialReviewed:true,legalCopyApproved:true,
 shippingConfirmed:true,ownerApprovedRevision:"r1",duplicateResolved:true};
describe("offline release readiness",()=>{
 it("passes complete evidence to review but never publishes",()=>{
  expect(assessRelease(good)).toMatchObject({readyForReleaseReview:true,blockers:[],canPublish:false,canIndex:false,canCheckout:false});
 });
 it("requires exact owner-approved revision",()=>{
  expect(assessRelease({...good,revision:"r2"}).blockers).toContain("owner_revision_unapproved");
 });
 it("fails closed when stock, media or shipping are missing",()=>{
  const r=assessRelease({...good,stockFresh:false,mediaLicensed:false,shippingConfirmed:false});
  expect(r.blockers).toEqual(expect.arrayContaining(["stock_stale","media_unlicensed","shipping_unconfirmed"]));
 });
 it("rejects duplicate and cross-market batch identities",()=>{
  expect(()=>assessReleaseBatch("sa",[good,good])).toThrow();
  expect(()=>assessReleaseBatch("eg",[good])).toThrow();
 });
});
