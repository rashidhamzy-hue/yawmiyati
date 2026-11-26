/**
 * S5 — search-engine and AI-search foundations for yawmiyati.shop.
 *
 * Indexing is OFF. Every page keeps `noindex,nofollow`, robots.txt blocks all
 * crawlers, and every non-production host also sends `X-Robots-Tag: noindex`.
 * Turning indexing on is a launch decision that needs explicit owner approval:
 * flip INDEXING_LIVE and update the noindex guards in scripts/ in the same PR.
 *
 * Canonical, hreflang, sitemaps, llms.txt and the product feed always use the
 * production origin, so staging copies point search engines at the real store.
 */
import {markets,type MarketCode} from "@/lib/store/markets";

export const SITE_ORIGIN="https://yawmiyati.shop";
export const PRODUCTION_HOSTS:readonly string[]=["yawmiyati.shop","www.yawmiyati.shop"];
/** Owner launch switch. Never set true without explicit owner approval. */
export const INDEXING_LIVE=false as boolean;

export const MARKET_CODES=Object.keys(markets) as MarketCode[];
/** Default market for visitors whose country has no dedicated store. */
export const DEFAULT_MARKET:MarketCode="sa";

/** Hosts that may ever be indexed (production + launch switch). */
export function hostMayBeIndexed(host:string):boolean{
 return INDEXING_LIVE&&PRODUCTION_HOSTS.includes(host.toLowerCase());
}

/** Absolute URL for a market path suffix ("" for the market home). */
export function marketUrl(market:MarketCode,suffix=""):string{
 if(suffix&&!suffix.startsWith("/"))throw Error("suffix_must_start_with_slash");
 return SITE_ORIGIN+"/"+market+suffix;
}

/** Path suffixes that exist identically in all five stores. */
export const SHARED_INFO_TOPICS=["help","privacy","terms","shipping-returns"] as const;

type HeadLink={rel:string;href:string;hrefLang?:string};

/**
 * Canonical + hreflang alternates for a page that exists in every market.
 * All five stores are Arabic; the region subtag tells Google which country
 * each one serves. x-default goes to the default market.
 */
export function sharedPageLinks(market:MarketCode,suffix=""):HeadLink[]{
 return [
  {rel:"canonical",href:marketUrl(market,suffix)},
  ...MARKET_CODES.map(m=>({rel:"alternate",hrefLang:markets[m].locale,href:marketUrl(m,suffix)})),
  {rel:"alternate",hrefLang:"x-default",href:marketUrl(DEFAULT_MARKET,suffix)},
 ];
}

/** Canonical only — for pages whose content differs per market (products). */
export function canonicalLink(market:MarketCode,suffix=""):HeadLink[]{
 return [{rel:"canonical",href:marketUrl(market,suffix)}];
}

const SLUG=/^[a-z0-9][a-z0-9_-]{0,139}$/;
/** Product URL suffix, or null for slugs that must never be published. */
export function productSuffix(slug:string):string|null{
 if(!SLUG.test(slug)||slug.startsWith("sim-")||slug.includes("demo"))return null;
 return "/p/"+slug;
}

/** Exact decimal string from a minor-unit integer string (no float rounding). */
export function minorToDecimal(priceMinor:string,digits:number):string{
 if(!/^\d+$/.test(priceMinor))throw Error("invalid_minor_amount");
 const padded=priceMinor.padStart(digits+1,"0");
 const whole=padded.slice(0,padded.length-digits).replace(/^0+(?=\d)/,"");
 const fraction=digits?padded.slice(-digits).replace(/0+$/,""):"";
 return fraction?whole+"."+fraction:whole;
}

export function xmlEscape(value:string):string{
 return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}
