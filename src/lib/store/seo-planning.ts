/**
 * Milestone 4A — offline SEO planning for five market storefronts.
 * S5 (26 Nov 2026): canonical/hreflang, sitemaps, Product JSON-LD and llms.txt now
 * live in src/lib/seo/ against https://yawmiyati.shop, with indexing still OFF
 * (INDEXING_LIVE=false, noindex meta, robots.txt Disallow). These drafts stay as-is.
 *
 * All output is DRAFT ONLY: it MUST NOT generate public indexable pages,
 * absolute canonical/hreflang URLs, sitemaps, or Product/Offer JSON-LD.
 * Those require verified domains, content, product identity, legal policies and
 * explicit owner authorization under a future authenticated release process.
 */
import {markets,type MarketCode} from "./markets";
import {marketIdentity} from "./market-identity";
import {marketExperience} from "./market-experience";
import type {PublicListing} from "./public-catalog";

export const SEO_EDITORIAL_SLUGS=[
 "kids","home","kitchen","beauty","fashion","wellness","organize",
] as const;
export type SeoCategory=typeof SEO_EDITORIAL_SLUGS[number];
export type SeoRouteKind="home"|"category"|"product"|"search";
export type SeoDraft={
 readonly mode:"SOURCE_ONLY_NO_INDEX";
 readonly market:MarketCode;readonly routeKind:SeoRouteKind;
 readonly relativePath:string;readonly title:string;readonly description:string;
 readonly robots:"noindex,nofollow";
 readonly canonicalUrl:null;readonly hreflang:readonly never[];
 readonly sitemapEligible:false;readonly structuredData:null;
 readonly ownerReleaseAuthorized:false;
};
const categoryNames:Record<SeoCategory,string>={
 kids:"الأم والطفل",
 home:"المنزل والديكور",kitchen:"المطبخ والقهوة",beauty:"الجمال والعناية",
 fashion:"الأزياء والإكسسوارات",wellness:"الراحة والرفاهية",organize:"التنظيم الذكي",
};
const safeText=(value:string,max=320)=>value.replace(/\s+/g," ").trim().slice(0,max);
const validSlug=(slug:unknown):slug is string=>typeof slug==="string"&&
 slug.length>=2&&slug.length<=140&&/^[a-z0-9][a-z0-9_-]*$/.test(slug)&&
 !slug.startsWith("SIM-")&&!slug.includes("demo");

function draft(market:MarketCode,routeKind:SeoRouteKind,relativePath:string,title:string,description:string):SeoDraft{
 return {mode:"SOURCE_ONLY_NO_INDEX",market,routeKind,relativePath,
  title:safeText(title,130),description:safeText(description,240),
  robots:"noindex,nofollow",canonicalUrl:null,hreflang:[],
  sitemapEligible:false,structuredData:null,ownerReleaseAuthorized:false};
}
export function planMarketSeo(market:MarketCode):SeoDraft{
 if(!Object.hasOwn(markets,market))throw Error("invalid_seo_market");
 const c=marketIdentity[market],v=marketExperience[market];
 return draft(market,"home","/"+market+"/",
  "يومياتي "+c.name+" | "+v.heroStart+" "+v.heroAccent,
  "اكتشفي أفكار يومياتي لـ"+c.fullName+"؛ "+v.heroDescription+" استكشفي أقسام البيت والقهوة والجمال والعناية واختاري ما يلائم ذوقك.");
}
export function planCategorySeo(market:MarketCode,category:unknown):SeoDraft|null{
 if(!Object.hasOwn(markets,market))throw Error("invalid_seo_market");
 if(typeof category!=="string"||!SEO_EDITORIAL_SLUGS.some(x=>x===category))return null;
 const slug=category as SeoCategory;
 const name=categoryNames[slug],id=marketIdentity[market],exp=marketExperience[market];
 return draft(market,"category","/"+market+"/c/"+slug,
  name+" | أفكار يومياتي "+id.name,
  "استكشفي قسم "+name+" في يومياتي "+id.fullName+". "+(exp.categoryCaptions[slug]??"أفكار وتفاصيل للحياة اليومية")+". هذا محتوى تحريري للاكتشاف؛ لا يمثل مخزوناً أو عروض شراء مؤكدة.");
}
/** Only pre-approved public RPC listing fields; never hallucinate inventory or photos. */
export function planProductSeo(market:MarketCode,row:unknown):SeoDraft|null{
 if(!Object.hasOwn(markets,market))throw Error("invalid_seo_market");
 if(!row||typeof row!=="object"||Array.isArray(row))return null;
 const r=row as Partial<PublicListing>&Record<string,unknown>;
 if(typeof r.listing_id!=="string"||!r.listing_id.trim()||
    typeof r.slug!=="string"||!validSlug(r.slug)||
    typeof r.title!=="string"||r.title.trim().length<3||r.title.length>200||
    typeof r.price_minor!=="string"||!/^\d+$/.test(r.price_minor)||
    !Number.isSafeInteger(Number(r.price_minor))||Number(r.price_minor)<=0||
    r.currency!==markets[market].currency||
    r.synthetic===true||r.mayPublish===false)return null;
 const name=marketIdentity[market].name;
 return draft(market,"product","/"+market+"/p/"+r.slug,
  r.title+" | يومياتي "+name,
  "صفحة معلومات "+r.title+" في يومياتي "+name+". عرض البيانات مشروط باعتماد المنتج؛ لا يدل السعر المعروض وحده على توافر المخزون أو قبول طلب شراء.");
}
export function planSearchSeo(market:MarketCode):SeoDraft{
 if(!Object.hasOwn(markets,market))throw Error("invalid_seo_market");
 return draft(market,"search","/"+market+"/search",
  "البحث | يومياتي "+marketIdentity[market].name,
  "ابحثي داخل معلومات المنتجات المعتمدة في يومياتي "+marketIdentity[market].fullName+". نتائج البحث ليست دليلاً على توافر المنتجات أو تفعيل الطلبات.");
}
/** No wildcard SEO page generation; no verified domain or launch approval yet. */
export function buildOfflineSeoInventory():readonly SeoDraft[]{
 return (Object.keys(markets) as MarketCode[]).flatMap(market=>[
  planMarketSeo(market),
  ...SEO_EDITORIAL_SLUGS.map(category=>planCategorySeo(market,category)!),
  planSearchSeo(market),
 ]);
}
