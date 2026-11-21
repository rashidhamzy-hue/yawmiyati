import {describe,it,expect,vi} from "vitest";
import {dashboardClient} from "../lib/store/dashboard-client";
import {markets,type MarketCode} from "../lib/store/markets";
import {marketPolicyPages} from "../lib/store/market-policy-pages";
import {saudiDelivery,saudiShippingPage} from "../lib/store/saudi-commerce-content";
import {historicSupplierTerms} from "../lib/store/historic-supplier-terms";

const base="https://db.example";
describe("M4D owner API fail-closed transport boundaries",()=>{
 it("rejects owner RPC without valid user token before network",async()=>{
  const send=vi.fn();
  const client=dashboardClient(base,"publishable-key",send);
  for(const token of [""," ","Bearer injected\nHeader: yes","x".repeat(8200)]){
   await expect(client.summary(token,"sa")).rejects.toThrow("Owner authentication required");
  }
  expect(send).not.toHaveBeenCalled();
 });
 it("rejects invalid market even if static type is bypassed",async()=>{
  const send=vi.fn(),client=dashboardClient(base,"public",send);
  for(const market of ["us","../admin","","prototype"]){
   await expect(client.catalog("token",market as MarketCode)).rejects.toThrow("Invalid owner market");
  }
  expect(send).not.toHaveBeenCalled();
 });
 it("rejects cross-market or invalid summary response before UI presentation",async()=>{
  const requests=vi.fn(async()=>Response.json({
   store:"iq",currency:"IQD",orders:10,customers:2,
   recorded_net_minor:"150000",order_statuses:{},
  }));
  const client=dashboardClient(base,"public",requests);
  await expect(client.summary("token","sa")).rejects.toThrow("Invalid market summary");
  expect(requests).toHaveBeenCalledTimes(1);
 });
 it("rejects mismatched report currency and malformed owner controls",async()=>{
  const request=vi.fn(async()=>Response.json({
   store:"om",currency:"SAR",window_days:30,warnings:[],
  }));
  const client=dashboardClient(base,"public",request);
  await expect(client.performance("token","om")).rejects.toThrow("Invalid report");
  expect(request).toHaveBeenCalledTimes(1);
  await expect(client.review("token","om"," ","approved")).rejects.toThrow("Invalid decision target");
  await expect(client.candidateContent("token","sa",0)).rejects.toThrow("Invalid product");
  await expect(client.createDraft("token","sa",0,"2026-11-21T00:00:00Z","revision")).rejects.toThrow("Invalid review revision");
  await expect(client.catalog("token","sa",-1)).rejects.toThrow("Invalid catalog offset");
  expect(request).toHaveBeenCalledTimes(1);
 });
});

describe("M4D owner-supplied historical country policies",()=>{
 it("preserves known supplier quotation amounts while distinguishing live price",()=>{
  const t=historicSupplierTerms;
  expect([t.sa.shippingQuote?.amount,t.ae.shippingQuote?.amount,t.om.shippingQuote?.amount,t.eg.shippingQuote,t.iq.shippingQuote?.amount]).toEqual(["28","19","3",null,"7000"]);
  expect(Object.values(t).every(x=>x.status==="historic_unverified"&&!x.customerPriceAuthorized&&!x.checkoutEnabled&&!x.supplierConnected)).toBe(true);
  expect(saudiDelivery.shipping).toMatch(/٢٨ ر.س/);
  expect(saudiDelivery.shipping).toMatch(/التقديرية|نؤكد/);
  expect(marketPolicyPages.ae.groups[1][1]).toMatch(/التقديري ١٩ درهماً/);
  expect(marketPolicyPages.om.groups[1][1]).toMatch(/التقديري ٣ ريالات عُمانية/);
  expect(marketPolicyPages.iq.groups[1][1]).toMatch(/٧٬٠٠٠ دينار عراقي.*إرشادي/);
  expect(marketPolicyPages.eg.groups[1][1]).toMatch(/٩٥ جنيه.*١٠٠ جنيه.*١٠٥ جنيه/);
 });
 it("preserves supplied country delivery timelines as estimates, not promises",()=>{
  const info=JSON.stringify([saudiDelivery,saudiShippingPage,marketPolicyPages]);
  expect(info).toContain("٢٤–٤٨ ساعة");
  expect(info).toContain("٢–٣ أيام");
  expect(info).toContain("٤–٥ أيام");
  expect(info).toContain("٢–٥ أيام");
  expect(info).not.toMatch(/١٥ يوماً|٣ أيام للإرجاع|١٤ يوماً للسلع المعيبة/);
  expect(info).toMatch(/ليست.*النهائية|إرشادي|تقدير/);
  expect(info).not.toMatch(/المورّد|المورد|Taager/);
 });
});
