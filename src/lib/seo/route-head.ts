/** Route head helpers shared by the five market storefronts. */
import type {MarketCode} from "@/lib/store/markets";
import {fetchPublicDetail,fetchPublicProductPage,type PublicDetail,type PublicProductPage} from "@/lib/store/public-catalog";
import {productMediaPath} from "@/lib/store/product-media";
import {publicBrowserConfig} from "@/lib/store/staging-public-config";
import {productPageMetadata} from "@/lib/store/store-page-metadata";
import {SHARED_INFO_TOPICS,SITE_ORIGIN,canonicalLink,productSuffix,sharedPageLinks} from "./site";
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
export type ProductSeo=PublicDetail&{page?:PublicProductPage|null};
export async function loadProductSeo(market:MarketCode,slug:string):Promise<ProductSeo|null>{
 if(typeof window!=="undefined"||!productSuffix(slug))return null;
 const {origin,key}=publicBrowserConfig(import.meta.env["VITE_YAWMIYATI_SUPABASE_URL"],import.meta.env["VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY"]);
 const request:typeof fetch=(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(SSR_CATALOG_TIMEOUT_MS)});
 try{
  const detail=await fetchPublicDetail(origin,key,market,slug,request);
  if(!detail)return null;
  // The approved page adds the SEO title/description and pictures; a failure keeps the plain detail.
  const page=await fetchPublicProductPage(origin,key,market,slug,detail.listing_id,request).catch(()=>null);
  return {...detail,page};
 }
 catch{return null;}
}

export function productHead(market:MarketCode,loaded:ProductSeo|PublicDetail|null|undefined){
 const {page,...rest}=(loaded??{}) as ProductSeo;
 const detail=loaded?rest as PublicDetail:null;
 const base=productPageMetadata(market,detail);
 const m=page?.seo.title?{...base,title:page.seo.title,description:page.seo.description||base.description}:base;
 const image=page?.images[0]?{url:SITE_ORIGIN+productMediaPath(page.images[0].id),alt:page.images[0].alt}:null;
 const suffix=detail?productSuffix(detail.slug):null;
 const product=detail&&suffix?productNode(market,detail,image):null;
 return {
  links:suffix?canonicalLink(market,suffix):[],
  scripts:product&&suffix?[{type:"application/ld+json",children:serializeJsonLd(graph(product,breadcrumbNode(market,[{name:detail!.title,suffix}])))}]:[],
  meta:[{title:m.title},{name:"description",content:m.description},{name:"robots",content:m.robots},
   ...(page?[{property:"og:type",content:"product"},{property:"og:title",content:m.title},{property:"og:description",content:m.description}]:[]),
   ...(image?[{property:"og:image",content:image.url},{property:"og:image:alt",content:image.alt}]:[])],
 };
}
