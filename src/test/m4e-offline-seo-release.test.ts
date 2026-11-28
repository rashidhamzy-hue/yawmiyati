import {describe,it,expect} from "vitest";
import {markets,type MarketCode} from "../lib/store/markets";
import {SEO_EDITORIAL_SLUGS} from "../lib/store/seo-planning";
import {auditOfflineSeoCandidates,planOfflineEditorialSeoAudit,planMarketEditorialLinks,type SeoCandidate,type SeoEvidence} from "../lib/store/offline-seo-release";

const markets5=["sa","ae","om","eg","iq"] as const;
const evidence:SeoEvidence={
 contentApproved:true,policyReviewed:true,sourceRightsVerified:true,
 marketReleaseSigned:true,routeLiveVerified:true,
 sourceRef:"source_ref_123",contentRevision:"revision_123",ownerDecisionRef:"owner_123",
};
function home(market:MarketCode,partial:Partial<SeoCandidate>={}):SeoCandidate{
 return {market,kind:"home",evidence,...partial};
}
function product(market:MarketCode,slug="coffee-set",group="shared-product-1"):SeoCandidate{
 return {market,kind:"product",alternateGroupRef:group,evidence,
  product:{listing_id:"list-"+market,slug,title:"مجموعة قهوة عصرية",price_minor:"15900",currency:markets[market].currency}};
}
describe("M4E offline SEO release planning",()=>{
 it("creates 40 editorial proposals without publishing any of them",()=>{
  const result=planOfflineEditorialSeoAudit();
  expect(result.proposalCount).toBe(5*(1+SEO_EDITORIAL_SLUGS.length));
  expect(result.needsReviewCount).toBe(result.proposalCount);
  expect(result.publishableCount).toBe(0);
  expect(result.sitemapXml).toBeNull();
  expect(result.robotsTxt).toBeNull();
  expect(result.canonicalManifest).toBeNull();
  expect(result.entries.every(e=>!e.reviewReady&&!e.releaseAuthorized&&!e.sitemapEligible&&
   e.robots==="noindex,nofollow"&&e.canonicalUrl===null&&e.hreflang.length===0&&e.structuredData===null)).toBe(true);
  expect(new Set(result.entries.map(e=>e.relativePath)).size).toBe(result.entries.length);
  expect(result.entries).toHaveLength(40);
 });
 it.each(markets5)("%s: local links use only known categories and do not cross store scope",market=>{
  const paths=planMarketEditorialLinks(market,"home");
  expect(paths[0]).toBe("/"+market+"/");
  expect(paths).not.toContain("/"+market+"/c/home");
  expect(paths).toHaveLength(7);
  expect(new Set(paths).size).toBe(paths.length);
  expect(paths.every(x=>x.startsWith("/"+market+"/"))).toBe(true);
  expect(()=>planMarketEditorialLinks(market,"unknown")).toThrow("invalid_editorial_category");
 });
 it("refuses fabricated country and unsupported category routes",()=>{
  const output=auditOfflineSeoCandidates([
   home("us" as MarketCode),{market:"iq",kind:"category",category:"../checkout",evidence},
   {market:"eg",kind:"product",product:product("sa").product,evidence},
  ]);
  expect(output.entries[0].blockers).toContain("invalid_market");
  expect(output.entries[0].relativePath).toBeNull();
  expect(output.entries[1].blockers).toContain("invalid_route");
  expect(output.entries[2].blockers).toContain("invalid_product");
  expect(output.publishableCount).toBe(0);
 });
 it("treats forged fully approved fields as advisory only, never permission to index",()=>{
  const output=auditOfflineSeoCandidates([home("sa",{alternateGroupRef:"home-group"})]);
  expect(output.entries[0].reviewReady).toBe(true);
  expect(output.entries[0].blockers).toEqual([]);
  expect(output.entries[0].canonicalUrl).toBeNull();
  expect(output.entries[0].sitemapEligible).toBe(false);
  expect(output.entries[0].releaseAuthorized).toBe(false);
  expect(output.entries[0].hreflang).toEqual([]);
  expect(output.sitemapXml).toBeNull();
  expect(output.publishableCount).toBe(0);
 });
 it("keeps source evidence gaps explicit",()=>{
  const output=auditOfflineSeoCandidates([home("ae",{evidence:{
   contentApproved:false,policyReviewed:false,sourceRightsVerified:false,
   marketReleaseSigned:false,routeLiveVerified:false,sourceRef:null,
   contentRevision:null,ownerDecisionRef:null,
  }})]);
  expect(output.entries[0].blockers).toEqual([
   "missing_content_approval","missing_policy_review","missing_media_rights",
   "missing_market_signoff","missing_live_verification","missing_evidence_reference",
  ]);
  expect(output.needsReviewCount).toBe(1);
 });
 it("rejects repeat product paths or drafts reused as product release claims",()=>{
  const one=product("om");
  const output=auditOfflineSeoCandidates([one,{...one,product:{...one.product!,listing_id:"different"}}]);
  expect(output.entries[1].blockers).toContain("duplicate_route");
  const bad=auditOfflineSeoCandidates([{...one,product:{...one.product!,slug:"demo-product"}}]);
  expect(bad.entries[0].blockers).toContain("invalid_product");
  expect(bad.publishableCount).toBe(0);
 });
 it("suggests only exact proposed cross-country siblings with explicit shared entity references",()=>{
  const candidates=markets5.map(m=>product(m));
  const result=auditOfflineSeoCandidates(candidates);
  for(const [index,market] of markets5.entries()){
   const entry=result.entries[index];
   expect(entry.market).toBe(market);
   expect(entry.reviewReady).toBe(true);
   expect(entry.alternateSuggestions).toHaveLength(4);
   expect(entry.alternateSuggestions.every(x=>x.market!==market&&x.relativePath.startsWith("/"+x.market+"/p/"))).toBe(true);
   expect(entry.hreflang).toEqual([]);
  }
 });
 it("never invents a cross-country alternative without explicit matching approved group",()=>{
  const result=auditOfflineSeoCandidates([product("sa","coffee-set","group-a"),product("iq","coffee-set","group-b")]);
  expect(result.entries.every(e=>e.alternateSuggestions.length===0)).toBe(true);
 });
 it("rejects duplicate market within the same alternate group, suppressing all affected siblings",()=>{
  const result=auditOfflineSeoCandidates([
   product("sa","one","shared-1"),product("sa","two","shared-1"),product("ae","three","shared-1"),
  ]);
  expect(result.entries[0].blockers).toContain("conflicting_alternate_group");
  expect(result.entries[1].blockers).toContain("conflicting_alternate_group");
  expect(result.entries[2].blockers).toContain("conflicting_alternate_group");
  expect(result.entries.every(e=>e.alternateSuggestions.length===0)).toBe(true);
 });
 it("does not connect same shared ref across unrelated category slugs",()=>{
  const result=auditOfflineSeoCandidates([
   {market:"sa",kind:"category",category:"home",alternateGroupRef:"categories",evidence},
   {market:"ae",kind:"category",category:"beauty",alternateGroupRef:"categories",evidence},
  ]);
  expect(result.entries.every(e=>e.alternateSuggestions.length===0)).toBe(true);
 });
 it("does not trust incomplete locale evidence for a matching group",()=>{
  const sa=product("sa"),ae=product("ae");
  const result=auditOfflineSeoCandidates([sa,{...ae,evidence:{...evidence,marketReleaseSigned:false}}]);
  expect(result.entries[0].alternateSuggestions).toEqual([]);
  expect(result.entries[1].reviewReady).toBe(false);
 });
 it("limits unbounded SEO inventory and malicious alternate refs",()=>{
  expect(()=>auditOfflineSeoCandidates(Array.from({length:501},()=>home("sa")))).toThrow("offline_seo_candidate_limit");
  const result=auditOfflineSeoCandidates([home("eg",{alternateGroupRef:"<script>"})]);
  expect(result.entries[0].blockers).toContain("invalid_alternate_group");
 });
});
