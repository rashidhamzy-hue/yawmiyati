/** Route head helpers shared by the five market storefronts. */
import type {MarketCode} from "@/lib/store/markets";
import {fetchPublicDetail,type PublicDetail} from "@/lib/store/public-catalog";
import {publicBrowserConfig} from "@/lib/store/staging-public-config";
import {productPageMetadata} from "@/lib/store/store-page-metadata";
import {SHARED_INFO_TOPICS,canonicalLink,productSuffix,sharedPageLinks} from "./site";
import {breadcrumbNode,graph,productNode,serializeJsonLd} from "./structured-data";

export function infoLinks(market:MarketCode,topic:string){
 return (SHARED_INFO_TOPICS as readonly string[]).includes(topic)?sharedPageLinks(market,"/info/"+topic):[];
}

const SSR_CATALOG_TIMEOUT_MS=1500;

/**
 * Server-side read of one released listing so the first HTML a crawler sees
 * carries the real title, canonical URL and Product JSON-LD. Client-side
 * navigations skip it (the page component loads its own data).
 */
export async function loadProductSeo(market:MarketCode,slug:string):Promise<PublicDetail|null>{
 if(typeof window!=="undefined"||!productSuffix(slug))return null;
 const {origin,key}=publicBrowserConfig(import.meta.env["VITE_YAWMIYATI_SUPABASE_URL"],import.meta.env["VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY"]);
 const request:typeof fetch=(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(SSR_CATALOG_TIMEOUT_MS)});
 try{return await fetchPublicDetail(origin,key,market,slug,request);}
 catch{return null;}
}

export function productHead(market:MarketCode,detail:PublicDetail|null|undefined){
 const m=productPageMetadata(market,detail??null);
 const suffix=detail?productSuffix(detail.slug):null;
 const product=detail&&suffix?productNode(market,detail):null;
 return {
  links:suffix?canonicalLink(market,suffix):[],
  scripts:product&&suffix?[{type:"application/ld+json",children:serializeJsonLd(graph(product,breadcrumbNode(market,[{name:detail!.title,suffix}])))}]:[],
  meta:[{title:m.title},{name:"description",content:m.description},{name:"robots",content:m.robots}],
 };
}
