import {describe,expect,it,vi} from "vitest";
import {markets,type MarketCode} from "../lib/store/markets";
import {assessOfflineProductProof,type ProductProofInput} from "../lib/store/offline-product-proof";

const countries=["sa","ae","om","eg","iq"] as const;
const now="2026-11-21T00:15:00.000Z",validAt="2026-11-21T00:07:00.000Z";
const hash="0123456789abcdef".repeat(4);
function candidate(market:MarketCode):ProductProofInput{
 return {
  market,currency:markets[market].currency,
  providerId:"provider-example",sourceProductId:"remote_123",productSku:"SKU-123",
  title:"Coffee set",contentRevision:"revision-2",
  approvedContentRevision:"revision-2",ownerApprovalRef:"approval-record-1",
  categorySlugs:["kitchen"],categoryApprovalRef:"category-owner-review-1",
  mediaApprovalRef:"media-owner-review-1",
  media:[{id:"img-1",url:"https://media.example.org/product/1.webp",
   alt:"Coffee set photographed on a table",sha256:hash,
   sourceRef:"provider-media-1",rightsRef:"rights-license-review-1",approvedRevision:"revision-2"}],
  variants:[{sku:"sku-123-sm",attributes:{size:"small",color:"white"},
   priceMinor:11000,stock:"available",availableUnits:4,observedAt:validAt,
   stockSourceRef:"provider-stock-observation",costMinor:6500,costSourceRef:"provider-cost-observation"}],
  observedAt:validAt,
 };
}
const assess=(x:ProductProofInput,m:MarketCode=x.market,hosts:readonly string[]=["media.example.org"])=>
 assessOfflineProductProof(x,m,now,hosts);
function codes(x:ProductProofInput,m:MarketCode=x.market,hosts?:readonly string[]){
 return assess(x,m,hosts).issues.map(y=>y.code);
}
describe("M4B offline product evidence contracts",()=>{
 it.each(countries)("%s: requires valid media, category, variant matrix, stock and currency but never authorizes publishing",market=>{
  const x=candidate(market),r=assess(x);
  expect(r.issues).toEqual([]);
  expect(r.readyForHumanReview).toBe(true);
  expect(r.advisory).toBe("OFFLINE_ONLY");
  expect([r.publishAuthorized,r.orderable,r.canSyncSupplier,r.hasVerifiedRealEvidence])
   .toEqual([false,false,false,false]);
  const other=countries.find(m=>m!==market)!;
  expect(codes(x,other)).toContain("market_currency");
  expect(codes({...x,currency:"USD"})).toContain("market_currency");
  expect(codes({...x,providerId:"SIM-provider"})).toContain("synthetic_identity");
  expect(codes({...x,productSku:"demo_123"})).toContain("synthetic_identity");
 });
 it("rejects missing owner content, category and media revision signoff",()=>{
  const x=candidate("sa");
  expect(codes({...x,approvedContentRevision:"old-revision"})).toContain("content_approval");
  expect(codes({...x,ownerApprovalRef:null})).toContain("content_approval");
  expect(codes({...x,categoryApprovalRef:null})).toContain("category_provenance");
  expect(codes({...x,mediaApprovalRef:null})).toContain("media_provenance");
  expect(codes({...x,categorySlugs:["kitchen","kitchen"]})).toContain("duplicate_category");
  expect(codes({...x,categorySlugs:["sale-miracle-cure"]})).toContain("invalid_category");
  expect(codes({...x,media:[{...x.media[0],approvedRevision:"other"}]})).toContain("invalid_media");
 });
 it("rejects unsafe image URLs, missing rights proof, duplicate media and unapproved hosts",()=>{
  const x=candidate("ae"),good=x.media[0];
  for(const url of [
   "http://media.example.org/item.jpg","https://media.example.org@evil.test/x",
   "https://media.example.org/item?token=secret",
   "https://media.example.org/item#fragment","https://127.0.0.1/item",
   "https://evil.test/a","data:image/svg+xml,a",
  ])expect(codes({...x,media:[{...good,url}]})).toContain("invalid_media");
  expect(codes(x,"ae",[])).toContain("invalid_media");
  expect(codes({...x,media:[{...good,rightsRef:""}]})).toContain("invalid_media");
  expect(codes({...x,media:[good,{...good,id:"img-2"}]})).toContain("duplicate_media");
  expect(codes({...x,media:[{...good,sha256:"fake"}]})).toContain("invalid_media");
 });
 it("rejects duplicate variants and duplicate attribute combinations",()=>{
  const x=candidate("om"),first=x.variants[0];
  expect(codes({...x,variants:[first,{...first}]})).toContain("duplicate_variant");
  expect(codes({...x,variants:[first,{...first,sku:"new-sku"}]})).toContain("duplicate_variant");
  expect(codes({...x,variants:[{...first,priceMinor:1.5}]})).toContain("price_precision");
  expect(codes({...x,variants:[{...first,sku:"fixture-123"}]})).toContain("variant_matrix");
  expect(codes({...x,variants:[{...first,attributes:{color:"",size:"small"}}]})).toContain("variant_matrix");
  expect(codes({...x,variants:[]})).toContain("too_many_items");
 });
 it("rejects stale/future stock, unknown availability, missing cost and overstock claims",()=>{
  const x=candidate("eg"),v=x.variants[0];
  expect(codes({...x,observedAt:"2026-11-20T23:00:00.000Z"})).toContain("stock_freshness");
  expect(codes({...x,variants:[{...v,observedAt:"2026-11-21T00:16:00.000Z"}]})).toContain("stock_freshness");
  expect(codes({...x,variants:[{...v,stock:"unknown"}]})).toContain("stock_evidence");
  expect(codes({...x,variants:[{...v,availableUnits:0}]})).toContain("stock_evidence");
  expect(codes({...x,variants:[{...v,stockSourceRef:""}]})).toContain("stock_evidence");
  expect(codes({...x,variants:[{...v,costMinor:null}]})).toContain("cost_evidence");
  expect(codes({...x,variants:[{...v,costMinor:-1}]})).toContain("cost_evidence");
  expect(codes({...x,variants:[{...v,costSourceRef:null}]})).toContain("cost_evidence");
 });
 it("is deterministic and performs no network requests or mutations",()=>{
  const spy=vi.spyOn(globalThis,"fetch");
  try{
   const x=candidate("iq");const prior=structuredClone(x);
   expect(assess(x)).toEqual(assess(x));expect(x).toEqual(prior);
   expect(spy).not.toHaveBeenCalled();
  }finally{spy.mockRestore();}
 });
});
