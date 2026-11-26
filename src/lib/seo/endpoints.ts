/**
 * Crawler-facing files served by the Worker: robots.txt, sitemaps, llms.txt
 * and Google product feeds. Content uses the production origin; robots.txt
 * blocks everything unless the request is on the production host AND the
 * owner launch switch (INDEXING_LIVE) is on.
 */
import {markets,type MarketCode} from "@/lib/store/markets";
import {marketIdentity} from "@/lib/store/market-identity";
import {customerServiceCopy} from "@/lib/store/customer-service-copy";
import {SEO_EDITORIAL_SLUGS,planCategorySeo} from "@/lib/store/seo-planning";
import {fetchPublicCatalog,type PublicListing} from "@/lib/store/public-catalog";
import {publicBrowserConfig} from "@/lib/store/staging-public-config";
import {commerceFacts} from "./commerce-facts";
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

function alternates(suffix:string):string{
 return MARKET_CODES.map(m=>`<xhtml:link rel="alternate" hreflang="${markets[m].locale}" href="${xmlEscape(marketUrl(m,suffix))}"/>`).join("")+
  `<xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(marketUrl(DEFAULT_MARKET,suffix))}"/>`;
}

export function sitemapIndexXml():string{
 return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`+
  MARKET_CODES.map(m=>`<sitemap><loc>${SITE_ORIGIN}/sitemaps/${m}.xml</loc></sitemap>`).join("")+`</sitemapindex>\n`;
}

export async function marketSitemapXml(market:MarketCode,read:CatalogReader=defaultCatalog):Promise<string>{
 const shared=sharedSuffixes().map(suffix=>`<url><loc>${xmlEscape(marketUrl(market,suffix))}</loc>${alternates(suffix)}</url>`);
 const products=(await released(read,market)).map(row=>`<url><loc>${xmlEscape(marketUrl(market,productSuffix(row.slug)!))}</loc></url>`);
 return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`+
  shared.join("")+products.join("")+`</urlset>\n`;
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
   `- Payment: ${copy.payment}`);
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

/**
 * Google Merchant Center product feed (RSS 2.0 + g: namespace) for one market.
 * The public catalog does not expose product photos yet, so items carry no
 * image_link until released media exists; Merchant Center will hold them
 * until then. Never add placeholder images.
 */
export async function merchantFeedXml(market:MarketCode,read:CatalogReader=defaultCatalog):Promise<string>{
 const id=marketIdentity[market],facts=commerceFacts[market],currency=markets[market].currency;
 const shipping=facts.flatShipping?`<g:shipping><g:country>${facts.countryCode}</g:country><g:price>${facts.flatShipping} ${currency}</g:price></g:shipping>`:"";
 const items=(await released(read,market)).map(row=>{
  const url=marketUrl(market,productSuffix(row.slug)!);
  return `<item><g:id>${xmlEscape(market+"-"+row.slug)}</g:id><title>${xmlEscape(row.title.trim().slice(0,150))}</title>`+
   `<description>${xmlEscape(row.title.trim())}</description><link>${xmlEscape(url)}</link>`+
   `<g:price>${minorToDecimal(row.price_minor,markets[market].minorDigits)} ${currency}</g:price>`+
   `<g:availability>in_stock</g:availability><g:condition>new</g:condition><g:identifier_exists>no</g:identifier_exists>`+
   shipping+`</item>`;
 });
 return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>`+
  `<title>${xmlEscape("يومياتي "+id.name)}</title><link>${marketUrl(market)}</link>`+
  `<description>${xmlEscape("منتجات يومياتي "+id.fullName)}</description>`+items.join("")+`</channel></rss>\n`;
}

const text=(body:string,type:string,maxAge=3600)=>new Response(body,{headers:{
 "content-type":type+"; charset=utf-8","cache-control":`public, max-age=${maxAge}`,
}});

/** Returns a response for crawler files, or null for every other path. */
export async function handleSeoRequest(request:Request,read:CatalogReader=defaultCatalog):Promise<Response|null>{
 if(request.method!=="GET"&&request.method!=="HEAD")return null;
 const url=new URL(request.url),path=url.pathname;
 if(path==="/robots.txt")return text(robotsTxt(url.hostname),"text/plain");
 if(path==="/sitemap.xml")return text(sitemapIndexXml(),"application/xml");
 if(path==="/llms.txt")return text(await llmsTxt(read),"text/plain");
 const sitemap=/^\/sitemaps\/(sa|ae|om|eg|iq)\.xml$/.exec(path);
 if(sitemap)return text(await marketSitemapXml(sitemap[1] as MarketCode,read),"application/xml");
 const feed=/^\/feeds\/google-(sa|ae|om|eg|iq)\.xml$/.exec(path);
 if(feed)return text(await merchantFeedXml(feed[1] as MarketCode,read),"application/xml");
 return null;
}

/** Header added to every response on hosts that must not be indexed. */
export function robotsHeaderFor(host:string):string|null{
 return hostMayBeIndexed(host)?null:"noindex, nofollow";
}
