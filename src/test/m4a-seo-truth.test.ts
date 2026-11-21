import {describe,expect,it} from "vitest";
import {markets} from "../lib/store/markets";
import {buildOfflineSeoInventory,planMarketSeo,planCategorySeo,planProductSeo,planSearchSeo,SEO_EDITORIAL_SLUGS} from "../lib/store/seo-planning";
import {marketIdentity} from "../lib/store/market-identity";
import {marketPolicyPages} from "../lib/store/market-policy-pages";
import {saudiDelivery,saudiShippingPage} from "../lib/store/saudi-commerce-content";

const countryCodes=["sa","ae","om","eg","iq"] as const;

describe("M4A five-country source-only SEO",()=>{
 it("generates distinctive market editorial drafts, never indexable or URL-claimed",()=>{
  const inventory=buildOfflineSeoInventory();
  expect(inventory).toHaveLength(5*(1+SEO_EDITORIAL_SLUGS.length+1));
  expect(new Set(inventory.map(x=>x.relativePath)).size).toBe(inventory.length);
  expect(inventory.every(x=>x.mode==="SOURCE_ONLY_NO_INDEX"&&x.robots==="noindex,nofollow"&&
    x.canonicalUrl===null&&x.hreflang.length===0&&!x.sitemapEligible&&
    x.structuredData===null&&!x.ownerReleaseAuthorized)).toBe(true);
  const titles=countryCodes.map(m=>planMarketSeo(m).title);
  expect(new Set(titles).size).toBe(5);
  for(const market of countryCodes){
   expect(planMarketSeo(market).title).toContain(marketIdentity[market].name);
   expect(planMarketSeo(market).description).toContain(marketIdentity[market].fullName);
   expect(planSearchSeo(market).relativePath).toBe("/"+market+"/search");
   expect(planSearchSeo(market).robots).toBe("noindex,nofollow");
   for(const slug of SEO_EDITORIAL_SLUGS){
    const category=planCategorySeo(market,slug)!;
    expect(category.relativePath).toBe("/"+market+"/c/"+slug);
    expect(category.description).toContain(marketIdentity[market].fullName);
    expect(category.sitemapEligible).toBe(false);
   }
  }
 });
 it("rejects invalid markets and unknown category slugs, with no mass thin-page templates",()=>{
  expect(planCategorySeo("ae","unknown-category")).toBeNull();
  expect(planCategorySeo("iq","../checkout")).toBeNull();
  expect(()=>planMarketSeo("us" as "sa")).toThrow("invalid_seo_market");
  expect(()=>planCategorySeo("us" as "sa","home")).toThrow();
  expect(()=>planSearchSeo("us" as "sa")).toThrow();
 });
 it("accepts only credible pre-approved public product fields, never creates Offer JSON-LD",()=>{
  for(const market of countryCodes){
   const item={listing_id:"listing_123",slug:"teapot-01",title:"إبريق قهوة بتصميم بسيط",
    currency:markets[market].currency,price_minor:"11900"};
   const planned=planProductSeo(market,item)!;
   expect(planned.relativePath).toBe("/"+market+"/p/teapot-01");
   expect(planned.title).toContain(item.title);
   expect(planned.structuredData).toBeNull();
   expect(planned.robots).toBe("noindex,nofollow");
   expect(planned.canonicalUrl).toBeNull();
   expect(planProductSeo(market,{...item,price_minor:"0"})).toBeNull();
   expect(planProductSeo(market,{...item,slug:"demo"})).toBeNull();
   expect(planProductSeo(market,{...item,synthetic:true})).toBeNull();
   expect(planProductSeo(market,{...item,mayPublish:false})).toBeNull();
   expect(planProductSeo(market,{...item,currency:"USD"})).toBeNull();
   expect(planProductSeo(market,{...item,slug:"../admin"})).toBeNull();
  }
 });
});

describe("M4A country policy truth",()=>{
 it("never markets unverified supplier quotations or coming-soon promises as shopper terms",()=>{
  const copied=JSON.stringify([saudiDelivery,saudiShippingPage,marketPolicyPages]);
  expect(copied).not.toMatch(/٢٨ ر.س|٢٨ ريالاً|١٩ درهماً|٣ ريالات عُمانية|٧٬٠٠٠ دينار عراقي/);
  expect(copied).not.toMatch(/المتوقعة|المتوقع|سيكون متاحاً|سيتم نشر|عند بدء استقبال الطلبات|Taager/);
  for(const market of ["ae","om","eg","iq"] as const){
   const page=marketPolicyPages[market];
   expect(page.groups).toHaveLength(6);
   expect(page.groups[1][1]).toMatch(/العنوان|عنوانج|موقع|منطقة التوصيل|عنوانچ/);
  }
  expect(saudiDelivery.shipping).toContain("عنوان التسليم");
 });
});
