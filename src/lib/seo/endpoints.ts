/**
 * Crawler-facing files served by the Worker: robots.txt, sitemaps, llms.txt
 * and Google product feeds. Content uses the production origin; robots.txt
 * blocks everything unless the request is on the production host AND the
 * owner launch switch (INDEXING_LIVE) is on.
 */
import {MARKETS as BRAIN_MARKETS} from "../../../supabase/functions/_shared/brain/markets";
import {assistantCopy} from "@/lib/store/assistant-copy";
import {humanLink} from "@/lib/store/shop-assistant";
import {markets,type MarketCode} from "@/lib/store/markets";
import {marketIdentity} from "@/lib/store/market-identity";
import {customerServiceCopy} from "@/lib/store/customer-service-copy";
import {SEO_EDITORIAL_SLUGS,planCategorySeo} from "@/lib/store/seo-planning";
import {fetchPublicCatalog,type PublicListing} from "@/lib/store/public-catalog";
import {fetchStoreOffers} from "@/lib/store/store-offers";
import {publicBrowserConfig} from "@/lib/store/staging-public-config";
import {productMediaPath} from "@/lib/store/product-media";
import {shopCopy} from "@/lib/store/shop-copy";
import {commerceFacts} from "./commerce-facts";
import {fetchPolicyFacts,policySentences,type PolicyFacts} from "@/lib/store/policy-facts";
import {
 DEFAULT_MARKET,MARKET_CODES,SHARED_INFO_TOPICS,SITE_ORIGIN,hostMayBeIndexed,
 marketUrl,minorToDecimal,productSuffix,xmlEscape,
} from "./site";

export type CatalogReader=(market:MarketCode)=>Promise<PublicListing[]>;

const defaultCatalog:CatalogReader=market=>{
 const {origin,key}=publicBrowserConfig(import.meta.env["VITE_YAWMIYATI_SUPABASE_URL"],import.meta.env["VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY"]);
 return fetchPublicCatalog(origin,key,market);
};

/** Released products only; an unreachable catalog yields an empty list, never an error page. */
async function released(read:CatalogReader,market:MarketCode):Promise<PublicListing[]>{
 try{return (await read(market)).filter(row=>productSuffix(row.slug)!==null);}
 catch{return [];}
}

const PRIVATE_PATHS=["/admin","/i/",...MARKET_CODES.flatMap(m=>["/"+m+"/cart","/"+m+"/checkout","/"+m+"/order/","/"+m+"/search"])];

export function robotsTxt(host:string):string{
 if(!hostMayBeIndexed(host))return [
  "# Yawmiyati — not open for indexing on this host.",
  "User-agent: *","Disallow: /","",
 ].join("\n");
 return [
  "# Yawmiyati — search engines and AI assistants are welcome to read and cite the store.",
  "User-agent: *","Allow: /",...PRIVATE_PATHS.map(p=>"Disallow: "+p),"",
  "Sitemap: "+SITE_ORIGIN+"/sitemap.xml","",
 ].join("\n");
}

/** Pages that exist in every market, as path suffixes. */
export function sharedSuffixes():string[]{
 return ["",...SEO_EDITORIAL_SLUGS.map(s=>"/c/"+s),"/story",...SHARED_INFO_TOPICS.map(t=>"/info/"+t)];
}

/** Same rule as the page head (sharedPageLinks): the store chooser at "/" is x-default for home pages, the default market otherwise. */
function alternates(suffix:string):string{
 return MARKET_CODES.map(m=>`<xhtml:link rel="alternate" hreflang="${markets[m].locale}" href="${xmlEscape(marketUrl(m,suffix))}"/>`).join("")+
  `<xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(suffix?marketUrl(DEFAULT_MARKET,suffix):SITE_ORIGIN+"/")}"/>`;
}

/** Slugs of the owner-approved sets on sale in a market (the offers page lists them). */
export type SetReader=(market:MarketCode)=>Promise<string[]>;
const SET_SLUG=/^[a-z0-9][a-z0-9_-]{0,139}$/;
const defaultSets:SetReader=async market=>(await fetchStoreOffers(market)).bundles.map(b=>b.slug);
async function releasedSets(read:SetReader,market:MarketCode):Promise<string[]>{
 try{return [...new Set(await read(market))].filter(slug=>SET_SLUG.test(slug)&&!slug.startsWith("sim-")&&!slug.includes("demo"));}
 catch{return [];}
}

export function sitemapIndexXml():string{
 return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`+
  MARKET_CODES.map(m=>`<sitemap><loc>${SITE_ORIGIN}/sitemaps/${m}.xml</loc></sitemap>`).join("")+`</sitemapindex>\n`;
}

/**
 * One sitemap per market: the pages every store has (with hreflang alternates), then what only this store sells —
 * its products, its offers page and its sets. Sets and the offers page are listed only while the store has a set on
 * sale, so a search engine is never sent to an empty page. The store chooser at "/" rides in the default market's file.
 */
export async function marketSitemapXml(market:MarketCode,read:CatalogReader=defaultCatalog,readSets:SetReader=defaultSets):Promise<string>{
 const url=(loc:string,extra="")=>`<url><loc>${xmlEscape(loc)}</loc>${extra}</url>`;
 const root=market===DEFAULT_MARKET?[url(SITE_ORIGIN+"/",alternates(""))]:[];
 const shared=sharedSuffixes().map(suffix=>url(marketUrl(market,suffix),alternates(suffix)));
 const [rows,sets]=await Promise.all([released(read,market),releasedSets(readSets,market)]);
 const products=rows.map(row=>url(marketUrl(market,productSuffix(row.slug)!)));
 const offers=sets.length?[url(marketUrl(market,"/offers")),...sets.map(slug=>url(marketUrl(market,"/set/"+slug)))]:[];
 return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`+
  root.join("")+shared.join("")+products.join("")+offers.join("")+`</urlset>\n`;
}

function displayPrice(row:PublicListing,market:MarketCode){
 return minorToDecimal(row.price_minor,markets[market].minorDigits)+" "+row.currency;
}

/** llms.txt (llmstxt.org): a plain summary AI assistants can read and cite. */
export async function llmsTxt(read:CatalogReader=defaultCatalog):Promise<string>{
 const lines:string[]=[
  "# Yawmiyati (يومياتي)","",
  "> Yawmiyati is an Arabic online lifestyle store for home, kitchen and coffee, beauty and care, fashion accessories, wellness and smart organizing. It runs one store per country — Saudi Arabia, United Arab Emirates, Oman, Egypt and Iraq — with local prices, local delivery fees and cash on delivery.","",
  "- Language: Arabic (each store uses its own local dialect).",
  "- Payment: cash on delivery only. No card is needed to order.",
  "- Every order is confirmed with the customer by phone before it ships.",
  "- Prices shown are the product price; the delivery fee is added once per order and the full total is shown before ordering.","",
 ];
 for(const market of MARKET_CODES){
  const id=marketIdentity[market],copy=customerServiceCopy[market],facts=commerceFacts[market];
  lines.push(`## ${id.name} store (${markets[market].locale}, ${markets[market].currency})`,"",
   `- [Store home](${marketUrl(market)}): يومياتي ${id.name}`,
   `- [Payment, delivery and returns](${marketUrl(market,"/info/shipping-returns")}): ${copy.shippingIntro}`,
   `- Delivery fee: ${copy.shipping}`,
   `- Delivery time: ${copy.delivery}`,
   `- Returns: ${copy.returns}`,
   `- Payment: ${copy.payment}`,
   `- [Store facts (JSON)](${SITE_ORIGIN}/api/store-facts/${market}.json): the same published policies, machine-readable`,
   `- [Offers and sets](${marketUrl(market,"/offers")})`);
  if(facts.flatShipping)lines.push(`- Delivery fee (machine-readable): ${facts.flatShipping} ${markets[market].currency} per order`);
  for(const slug of SEO_EDITORIAL_SLUGS){
   const page=planCategorySeo(market,slug);
   if(page)lines.push(`- [${page.title.split(" | ")[0]}](${marketUrl(market,"/c/"+slug)})`);
  }
  const products=await released(read,market);
  if(products.length){
   lines.push("","### Products ("+id.name+")","");
   for(const row of products.slice(0,200))lines.push(`- [${row.title.replace(/[[\]]/g,"")}](${marketUrl(market,productSuffix(row.slug)!)}): ${displayPrice(row,market)}`);
  }
  lines.push("");
 }
 lines.push("## Optional","",
  `- [Our story](${marketUrl(DEFAULT_MARKET,"/story")})`,
  `- [Privacy](${marketUrl(DEFAULT_MARKET,"/info/privacy")})`,
  `- [Terms](${marketUrl(DEFAULT_MARKET,"/info/terms")})`,
  `- [Sitemap](${SITE_ORIGIN}/sitemap.xml)`,"");
 return lines.join("\n");
}

/** One feed item, or null when the product has no picture of its own yet (a feed never carries a placeholder). */
function feedItem(market:MarketCode,row:PublicListing,idOf:(slug:string)=>string):string|null{
 if(!row.image)return null;
 const facts=commerceFacts[market],currency=markets[market].currency,digits=markets[market].minorDigits;
 const url=marketUrl(market,productSuffix(row.slug)!),price=(minor:string)=>`${minorToDecimal(minor,digits)} ${currency}`;
 const section=row.approved_category_slugs?.[0],sectionName=section?shopCopy(market).sectionNames[section]:undefined;
 // Delivery included: the shopper pays the product price only, so the feed says delivery costs nothing for this item.
 const shipping=row.delivery_included?`<g:shipping><g:country>${facts.countryCode}</g:country><g:price>0 ${currency}</g:price></g:shipping>`
  :facts.flatShipping?`<g:shipping><g:country>${facts.countryCode}</g:country><g:price>${facts.flatShipping} ${currency}</g:price></g:shipping>`:"";
 // An owner-approved time-limited price: list price as the price, the offer as sale price, with its real end date.
 const sale=row.sale?`<g:price>${price(row.sale.list_price_minor)}</g:price><g:sale_price>${price(row.price_minor)}</g:sale_price><g:sale_price_effective_date>${new Date().toISOString().slice(0,10)}T00:00:00Z/${row.sale.ends_at}</g:sale_price_effective_date>`
  :`<g:price>${price(row.price_minor)}</g:price>`;
 return `<item><g:id>${xmlEscape(idOf(row.slug))}</g:id><title>${xmlEscape(row.title.trim().slice(0,150))}</title>`+
  `<description>${xmlEscape(row.title.trim())}</description><link>${xmlEscape(url)}</link>`+
  `<g:image_link>${xmlEscape(SITE_ORIGIN+productMediaPath(row.image))}</g:image_link>`+sale+
  `<g:availability>in_stock</g:availability><g:condition>new</g:condition><g:brand>${xmlEscape("يومياتي")}</g:brand><g:identifier_exists>no</g:identifier_exists>`+
  (sectionName?`<g:product_type>${xmlEscape(sectionName)}</g:product_type>`:"")+
  (row.kind==="bundle"?`<g:is_bundle>yes</g:is_bundle>`:"")+shipping+`</item>`;
}
async function feedXml(market:MarketCode,read:CatalogReader,idOf:(slug:string)=>string):Promise<string>{
 const id=marketIdentity[market];
 const items=(await released(read,market)).map(row=>feedItem(market,row,idOf)).filter(Boolean);
 return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>`+
  `<title>${xmlEscape("يومياتي "+id.name)}</title><link>${marketUrl(market)}</link>`+
  `<description>${xmlEscape("منتجات يومياتي "+id.fullName)}</description>`+items.join("")+`</channel></rss>\n`;
}
/**
 * Google Merchant Center feed for free shopping listings: published, in-stock products with their own picture, the
 * current price in the market's currency, and delivery as the shopper pays it.
 */
export async function merchantFeedXml(market:MarketCode,read:CatalogReader=defaultCatalog):Promise<string>{
 return feedXml(market,read,slug=>market+"-"+slug);
}
/**
 * Meta catalogue feed (one catalogue per market) for dynamic and retargeting ads. The item id is the product slug:
 * exactly the content id the Pixel and the Conversions API send, so Meta can match an event to a catalogue item.
 */
export async function metaFeedXml(market:MarketCode,read:CatalogReader=defaultCatalog):Promise<string>{
 return feedXml(market,read,slug=>slug);
}

const text=(body:string,type:string,maxAge=3600)=>new Response(body,{headers:{
 "content-type":type+"; charset=utf-8","cache-control":`public, max-age=${maxAge}`,
}});

/** Returns a response for crawler files, or null for every other path. */
/**
 * Machine-readable store facts for one market: the same published sentences shoppers read (customer-service-copy.ts),
 * nothing more. Read by the shopping assistant's server side and by AI search; never a place for unpublished terms.
 */
/** `policy`: the confirmed customer-facing facts, when the database holds any; a confirmed number that differs from our written sentence replaces it. */
export function storeFacts(market:MarketCode,policy:PolicyFacts|null=null){
 const written=customerServiceCopy[market],id=marketIdentity[market],sentences=policySentences(market,policy),copy={...written,shipping:sentences.shipping,delivery:sentences.delivery,returns:sentences.returns};
 return {market,country:BRAIN_MARKETS[market].countryName,country_ar:id.name,currency:markets[market].currency,minor_digits:markets[market].minorDigits,locale:markets[market].locale,
  dialect:BRAIN_MARKETS[market].dialect,payment:copy.payment,shipping:copy.shipping,delivery:copy.delivery,returns:copy.returns,
  confirmation_call:assistantCopy(market).callAnswer,tracking:copy.tracking,human:humanLink(market),
  sections:SEO_EDITORIAL_SLUGS.map(slug=>({slug,name:planCategorySeo(market,slug)?.title.split(" | ")[0]??slug})),
  help:marketUrl(market,"/info/help"),policies:marketUrl(market,"/info/shipping-returns"),
  // The assistant's own words for WhatsApp, from the same market dictionary (the WhatsApp adapter reads them here).
  assistant:(a=>({greeting:a.waGreeting,which_country:a.waWhichCountry,order_ask:a.waOrderAsk,order_not_found:a.waOrderNotFound,
   status:{placed:a.waStatusPlaced,confirmed:a.waStatusConfirmed,shipped:a.waStatusShipped,delivered:a.waStatusDelivered,closed:a.waStatusClosed},
   confirm_done:a.waConfirmDone,confirm_unknown:a.waConfirmUnknown,handover:a.waHandover,human_word:a.waHumanWord,confirm_word:a.waConfirmWord,text_only:a.waTextOnly,
   dont_know:a.dontKnow,nothing_fits:a.nothingFits,found:a.found(2),sections_lead:a.sectionsLead}))(assistantCopy(market))};
}
export async function handleSeoRequest(request:Request,read:CatalogReader=defaultCatalog):Promise<Response|null>{
 if(request.method!=="GET"&&request.method!=="HEAD")return null;
 const url=new URL(request.url),path=url.pathname;
 if(path==="/robots.txt")return text(robotsTxt(url.hostname),"text/plain");
 if(path==="/sitemap.xml")return text(sitemapIndexXml(),"application/xml");
 if(path==="/llms.txt")return text(await llmsTxt(read),"text/plain");
 const facts=/^\/api\/store-facts\/(sa|ae|om|eg|iq)\.json$/.exec(path);
 if(facts){
  const m=facts[1] as MarketCode;
  let policy:PolicyFacts|null=null;
  try{const {origin,key}=publicBrowserConfig(import.meta.env["VITE_YAWMIYATI_SUPABASE_URL"],import.meta.env["VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY"]);policy=await fetchPolicyFacts(origin,key,m);}catch{policy=null;}
  return text(JSON.stringify(storeFacts(m,policy)),"application/json");
 }
 const sitemap=/^\/sitemaps\/(sa|ae|om|eg|iq)\.xml$/.exec(path);
 if(sitemap)return text(await marketSitemapXml(sitemap[1] as MarketCode,read),"application/xml");
 const feed=/^\/feeds\/google-(sa|ae|om|eg|iq)\.xml$/.exec(path);
 if(feed)return text(await merchantFeedXml(feed[1] as MarketCode,read),"application/xml");
 const meta=/^\/feeds\/meta-(sa|ae|om|eg|iq)\.xml$/.exec(path);
 if(meta)return text(await metaFeedXml(meta[1] as MarketCode,read),"application/xml");
 return null;
}

/** Header added to every response on hosts that must not be indexed. */
export function robotsHeaderFor(host:string):string|null{
 return hostMayBeIndexed(host)?null:"noindex, nofollow";
}
