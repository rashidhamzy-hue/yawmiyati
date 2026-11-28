import {describe,expect,it} from "vitest";
import {INDEXING_LIVE,marketUrl,minorToDecimal,productSuffix,sharedPageLinks,hostMayBeIndexed} from "@/lib/seo/site";
import {handleSeoRequest,llmsTxt,marketSitemapXml,merchantFeedXml,metaFeedXml,robotsTxt,robotsHeaderFor,sitemapIndexXml} from "@/lib/seo/endpoints";
import {metaEventFor} from "@/lib/analytics/meta-events";
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
 it("sitemap lists the offers page and sets only while the store has a set on sale",async()=>{
  const none=await marketSitemapXml("eg",reader({}),async()=>[]);
  expect(none).not.toMatch(/\/offers|\/set\//);
  const xml=await marketSitemapXml("eg",reader({}),async()=>["coffee-corner","coffee-corner","demo-set","Bad Slug","sim-x"]);
  expect(xml).toContain("<loc>https://yawmiyati.shop/eg/offers</loc>");
  expect(xml.match(/<loc>https:\/\/yawmiyati\.shop\/eg\/set\//g)).toHaveLength(1);
  expect(xml).toContain("<loc>https://yawmiyati.shop/eg/set/coffee-corner</loc>");
  const down=await marketSitemapXml("eg",reader({}),async()=>{throw Error("down");});
  expect(down).toContain("<loc>https://yawmiyati.shop/eg/story</loc>");
 });
 it("store chooser is x-default for home pages and is listed once, in the default market's sitemap",async()=>{
  const sa=await marketSitemapXml("sa",reader({})),ae=await marketSitemapXml("ae",reader({}));
  expect(sa).toContain("<loc>https://yawmiyati.shop/</loc>");
  expect(ae).not.toContain("<loc>https://yawmiyati.shop/</loc>");
  expect(ae).toContain('<loc>https://yawmiyati.shop/ae</loc><xhtml:link rel="alternate" hreflang="ar-SA" href="https://yawmiyati.shop/sa"/>');
  expect(ae).toContain('hreflang="x-default" href="https://yawmiyati.shop/"/>');
  expect(ae).toContain('hreflang="x-default" href="https://yawmiyati.shop/sa/story"/>');
 });
 it("every market's set and offers routes carry their own canonical and stay noindex",async()=>{
  const {readFileSync}=await import("node:fs");
  for(const m of ["sa","ae","om","eg","iq"]){
   const set=readFileSync(`src/routes/${m}.set.$slug.tsx`,"utf8"),offers=readFileSync(`src/routes/${m}.offers.tsx`,"utf8");
   expect(set).toContain(`canonicalLink("${m}","/set/"+params.slug)`);
   expect(offers).toContain(`canonicalLink("${m}","/offers")`);
   for(const file of [set,offers])expect(file).toContain('{name:"robots",content:"noindex,nofollow"}');
  }
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
 it("Google feed: published products with their own picture, decimal price, delivery as she pays it",async()=>{
  const img="11111111-2222-3333-4444-555555555555.jpg";
  const xml=await merchantFeedXml("sa",reader({sa:[listing({title:"A & B",image:img,approved_category_slugs:["kitchen"]}),listing({slug:"no-picture",listing_id:"L2"}),
   listing({slug:"free-one",listing_id:"L3",image:img,delivery_included:true}),
   listing({slug:"on-offer",listing_id:"L4",image:img,price_minor:"7900",sale:{ends_at:"2026-12-20T00:00:00.000Z",list_price_minor:"9900"}})]}));
  expect(xml).toContain("<g:id>sa-milk-frother</g:id>");expect(xml).toContain("<g:price>89 SAR</g:price>");
  expect(xml).toContain("<g:shipping><g:country>SA</g:country><g:price>28 SAR</g:price></g:shipping>");
  expect(xml).toContain("A &amp; B");
  expect(xml).toContain("<g:image_link>https://yawmiyati.shop/media/p/"+img+"</g:image_link>");
  expect(xml).toContain("<g:product_type>المطبخ والقهوة</g:product_type>");
  // No picture of its own: left out, never a placeholder.
  expect(xml).not.toContain("no-picture");
  // Delivery included: delivery costs nothing for that item.
  expect(xml).toMatch(/<g:id>sa-free-one<\/g:id>.*?<g:shipping><g:country>SA<\/g:country><g:price>0 SAR<\/g:price><\/g:shipping>/);
  // A real time-limited offer: list price, offer price and the offer's real end date.
  expect(xml).toMatch(/<g:id>sa-on-offer<\/g:id>.*?<g:price>99 SAR<\/g:price><g:sale_price>79 SAR<\/g:sale_price><g:sale_price_effective_date>\d{4}-\d\d-\d\dT00:00:00Z\/2026-12-20T00:00:00.000Z<\/g:sale_price_effective_date>/);
 });
 it("Meta catalogue feed uses the product slug as the id: the same id the Pixel and the server events send",async()=>{
  const img="11111111-2222-3333-4444-555555555555.jpg";
  const xml=await metaFeedXml("eg",reader({eg:[listing({image:img,currency:"EGP",price_minor:"45000"})]}));
  expect(xml).toContain("<g:id>milk-frother</g:id>");expect(xml).toContain("<g:price>450 EGP</g:price>");expect(xml).toContain("<g:availability>in_stock</g:availability>");
  expect(xml).toContain("<link>https://yawmiyati.shop/eg/p/milk-frother</link>");
  const e=metaEventFor("add_to_cart",{market:"eg",slug:"milk-frother",value_minor:"45000",quantity:1},"00000000-0000-4000-8000-000000000001")!;
  expect(e).toEqual({name:"AddToCart",event_id:"00000000-0000-4000-8000-000000000001",market:"eg",params:{content_ids:["milk-frother"],content_type:"product",value:450,currency:"EGP",num_items:1}});
  expect(xml).toContain("<g:id>"+e.params.content_ids![0]+"</g:id>");
  expect((await handleSeoRequest(new Request("https://yawmiyati.shop/feeds/meta-iq.xml"),reader({})))?.status).toBe(200);
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

describe("mother & kids section",()=>{
 it("is a full section in every market: name, short line, photo, page and sitemap entry",async()=>{
  const {storeSections,storeSection}=await import("@/lib/store/sections");
  const {editorialUpstream}=await import("@/lib/store/editorial-media");
  for(const m of ["sa","ae","om","eg","iq"] as const){
   const all=storeSections(m),kids=storeSection(m,"kids")!;
   expect(all).toHaveLength(7);
   expect(all.map(s=>s.slug)).toContain("kids");
   expect(kids.name).toBe("الأم والطفل");
   expect(kids.caption.length).toBeGreaterThan(3);
   expect(kids.photo).toContain("photo-1764665818844-7cb4f51935d5");
   expect(await marketSitemapXml(m,reader({}))).toContain(`<loc>https://yawmiyati.shop/${m}/c/kids</loc>`);
  }
  expect(storeSection("sa","garden")).toBeNull();
  expect(editorialUpstream(new URL("https://yawmiyati.shop/media/photo-1764665818844-7cb4f51935d5?w=960&q=70"))).toContain("images.unsplash.com/photo-1764665818844-7cb4f51935d5");
 });
});
