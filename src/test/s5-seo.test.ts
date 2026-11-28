import {describe,expect,it} from "vitest";
import {INDEXING_LIVE,marketUrl,minorToDecimal,productSuffix,sharedPageLinks,hostMayBeIndexed} from "@/lib/seo/site";
import {handleSeoRequest,llmsTxt,marketSitemapXml,merchantFeedXml,robotsTxt,robotsHeaderFor,sitemapIndexXml} from "@/lib/seo/endpoints";
import {faqNode,productNode} from "@/lib/seo/structured-data";
import {productHead} from "@/lib/seo/route-head";
import {commerceFacts} from "@/lib/seo/commerce-facts";
import {customerServiceCopy} from "@/lib/store/customer-service-copy";
import {parsePublicProductPage,type PublicListing} from "@/lib/store/public-catalog";
import type {MarketCode} from "@/lib/store/markets";

const listing=(over:Partial<PublicListing>={}):PublicListing=>({listing_id:"L1",slug:"milk-frother",title:"خفّاقة حليب",price_minor:"8900",currency:"SAR",...over});
const reader=(rows:Partial<Record<MarketCode,PublicListing[]>>)=>async(m:MarketCode)=>rows[m]??[];

describe("S5 indexing stays off until owner launch approval",()=>{
 it("launch switch is off and every host is noindex",()=>{
  expect(INDEXING_LIVE).toBe(false);
  for(const host of ["yawmiyati.shop","www.yawmiyati.shop","yawmiyati-storefront-staging.rashid-hamzy.workers.dev","staging.yawmiyati.shop"]){
   expect(hostMayBeIndexed(host)).toBe(false);
   expect(robotsHeaderFor(host)).toBe("noindex, nofollow");
   expect(robotsTxt(host)).toContain("Disallow: /\n");
  }
 });
});

describe("canonical and hreflang",()=>{
 it("links all five Arabic regional stores plus x-default",()=>{
  const links=sharedPageLinks("eg","/c/kitchen");
  expect(links[0]).toEqual({rel:"canonical",href:"https://yawmiyati.shop/eg/c/kitchen"});
  expect(links.filter(l=>l.hrefLang).map(l=>l.hrefLang)).toEqual(["ar-SA","ar-AE","ar-OM","ar-EG","ar-IQ","x-default"]);
  expect(links.find(l=>l.hrefLang==="x-default")!.href).toBe("https://yawmiyati.shop/sa/c/kitchen");
 });
 it("never publishes simulated or demo slugs",()=>{
  expect(productSuffix("milk-frother")).toBe("/p/milk-frother");
  expect(productSuffix("sim-123")).toBeNull();
  expect(productSuffix("demo-cup")).toBeNull();
  expect(productSuffix("../x")).toBeNull();
 });
 it("converts minor units exactly",()=>{
  expect(minorToDecimal("8900",2)).toBe("89");
  expect(minorToDecimal("8950",2)).toBe("89.5");
  expect(minorToDecimal("3500",3)).toBe("3.5");
  expect(minorToDecimal("5",2)).toBe("0.05");
  expect(minorToDecimal("7000000",3)).toBe("7000");
 });
});

describe("Product JSON-LD from released data only",()=>{
 it("includes price, COD, real shipping and return window",()=>{
  const node=productNode("sa",{...listing(),description:"وصف"})!;
  expect(node.url).toBe("https://yawmiyati.shop/sa/p/milk-frother");
  expect(node.offers.price).toBe("89");
  expect(node.offers.priceCurrency).toBe("SAR");
  expect(node.offers.shippingDetails!.shippingRate.value).toBe("28");
  expect(node.offers.hasMerchantReturnPolicy!.merchantReturnDays).toBe(7);
  expect(JSON.stringify(node)).not.toMatch(/aggregateRating|review|brand/);
 });
 it("omits facts that are not published (Egypt rate varies, Iraq returns unknown)",()=>{
  expect(productNode("eg",listing({currency:"EGP"}))!.offers.shippingDetails).toBeUndefined();
  expect(productNode("iq",listing({currency:"IQD",price_minor:"25000000"}))!.offers.hasMerchantReturnPolicy).toBeUndefined();
 });
 it("rejects currency mismatch and unpublishable slugs",()=>{
  expect(productNode("ae",listing())).toBeNull();
  expect(productNode("sa",listing({slug:"demo-x"}))).toBeNull();
 });
 it("product head stays noindex and has a canonical only with real data",()=>{
  const empty=productHead("sa",null);
  expect(empty.links).toEqual([]);expect(empty.scripts).toEqual([]);
  const real=productHead("sa",{...listing(),description:"وصف"});
  expect(real.links).toEqual([{rel:"canonical",href:"https://yawmiyati.shop/sa/p/milk-frother"}]);
  expect(real.meta).toContainEqual({name:"robots",content:"noindex,nofollow"});
  expect(real.scripts[0].children).not.toContain("<");
 });
 it("product head carries FAQ, section breadcrumb and video from the approved page, in the fixed layout",()=>{
  const img="11111111-2222-3333-4444-555555555555.jpg",vid="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.mp4";
  const page=parsePublicProductPage({release:"public_approved",market:"sa",listing_id:"l1",category:"kitchen",images:[{id:img,alt:"خفاقة حليب"}],videos:[vid],
   page:{title:"خفاقة حليب",description:"وصف.",benefit_line:"رغوة ناعمة في ثوانٍ.",bullets:["أ","ب","ج"],in_box:["خفاقة"],how_to_use:["اضغطي الزر"],
    faq:[{q:"هل تحتاج بطاريات؟",a:"نعم، تعمل ببطاريتين."},{q:"هل تُغسل؟",a:"يُغسل الرأس بالماء."}],seo:{title:"خفاقة حليب كهربائية",description:"خفاقة حليب لرغوة ناعمة."}}},"sa","l1")!;
  expect(page).toMatchObject({benefit_line:"رغوة ناعمة في ثوانٍ.",in_box:["خفاقة"],how_to_use:["اضغطي الزر"]});
  const head=productHead("sa",{...listing(),listing_id:"l1",description:"وصف",page});
  const g=JSON.parse(head.scripts[0].children)["@graph"] as Record<string,any>[];
  expect(g.map(n=>n["@type"])).toEqual(["Product","BreadcrumbList","FAQPage","VideoObject"]);
  expect(g[1].itemListElement.map((i:any)=>i.item)).toEqual(["https://yawmiyati.shop/sa","https://yawmiyati.shop/sa/c/kitchen","https://yawmiyati.shop/sa/p/milk-frother"]);
  expect(g[2].mainEntity[0]).toEqual({"@type":"Question",name:"هل تحتاج بطاريات؟",acceptedAnswer:{"@type":"Answer",text:"نعم، تعمل ببطاريتين."}});
  expect(g[3].contentUrl).toBe("https://yawmiyati.shop/media/v/"+vid);expect(g[3]).not.toHaveProperty("duration");
  expect(faqNode("https://x/y",[{q:"س",a:"ج"}])).toBeNull();
 });
});

describe("commerce facts mirror customer copy",()=>{
 it("shipping numbers appear in each market's customer copy",()=>{
  const arabic=(s:string)=>s.replace(/\d/g,d=>"٠١٢٣٤٥٦٧٨٩"[Number(d)]);
  expect(customerServiceCopy.sa.shipping).toContain(arabic("28"));
  expect(customerServiceCopy.ae.shipping).toContain(arabic("19"));
  expect(customerServiceCopy.om.shipping).toContain(arabic("3"));
  expect(customerServiceCopy.eg.shipping).toContain(arabic("95"));
  expect(customerServiceCopy.eg.shipping).toContain(arabic("105"));
  expect(customerServiceCopy.iq.shipping).toContain("٧٬٠٠٠");
  expect(customerServiceCopy.sa.returns).toContain(arabic(String(commerceFacts.sa.returnDays)));
  expect(customerServiceCopy.eg.returns).toContain(arabic(String(commerceFacts.eg.returnDays)));
  expect(customerServiceCopy.om.returns).toContain(arabic(String(commerceFacts.om.defectiveOnlyReturnDays)));
 });
});

describe("crawler files",()=>{
 it("sitemap index lists five market sitemaps on the production origin",()=>{
  const xml=sitemapIndexXml();
  for(const m of ["sa","ae","om","eg","iq"])expect(xml).toContain(`https://yawmiyati.shop/sitemaps/${m}.xml`);
 });
 it("market sitemap has shared pages with alternates and released products only",async()=>{
  const xml=await marketSitemapXml("sa",reader({sa:[listing(),listing({slug:"demo-x",listing_id:"L2"})]}));
  expect(xml).toContain("<loc>https://yawmiyati.shop/sa</loc>");
  expect(xml).toContain("<loc>https://yawmiyati.shop/sa/c/kitchen</loc>");
  expect(xml).toContain('hreflang="ar-IQ" href="https://yawmiyati.shop/iq/info/shipping-returns"');
  expect(xml).toContain("<loc>https://yawmiyati.shop/sa/p/milk-frother</loc>");
  expect(xml).not.toContain("demo-x");
  expect(xml).not.toMatch(/\/cart|\/checkout|\/search/);
 });
 it("an unreachable catalog still yields a valid sitemap",async()=>{
  const xml=await marketSitemapXml("ae",async()=>{throw Error("down");});
  expect(xml).toContain("<loc>https://yawmiyati.shop/ae/story</loc>");
 });
 it("llms.txt summarises all five stores with their published policies",async()=>{
  const body=await llmsTxt(reader({sa:[listing()]}));
  expect(body.startsWith("# Yawmiyati")).toBe(true);
  for(const m of ["sa","ae","om","eg","iq"] as const)expect(body).toContain(customerServiceCopy[m].shipping);
  expect(body).toContain("[خفّاقة حليب](https://yawmiyati.shop/sa/p/milk-frother): 89 SAR");
  expect(body).toMatch(/cash on delivery/i);
 });
 it("Google feed prices in decimal with shipping, without invented images",async()=>{
  const xml=await merchantFeedXml("sa",reader({sa:[listing({title:"A & B"})]}));
  expect(xml).toContain("<g:price>89 SAR</g:price>");
  expect(xml).toContain("<g:shipping><g:country>SA</g:country><g:price>28 SAR</g:price></g:shipping>");
  expect(xml).toContain("A &amp; B");
  expect(xml).not.toContain("image_link");
 });
 it("routes only the crawler paths",async()=>{
  const r=reader({});
  for(const path of ["/robots.txt","/sitemap.xml","/sitemaps/om.xml","/llms.txt","/feeds/google-eg.xml"]){
   const res=await handleSeoRequest(new Request("https://yawmiyati.shop"+path),r);
   expect(res?.status).toBe(200);
  }
  expect(await handleSeoRequest(new Request("https://yawmiyati.shop/sa"),r)).toBeNull();
  expect(await handleSeoRequest(new Request("https://yawmiyati.shop/sitemaps/xx.xml"),r)).toBeNull();
  expect(await handleSeoRequest(new Request("https://yawmiyati.shop/robots.txt",{method:"POST"}),r)).toBeNull();
 });
 it("home URL helper has no trailing slash",()=>{expect(marketUrl("om")).toBe("https://yawmiyati.shop/om");});
});
