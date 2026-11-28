/**
 * Meta (Facebook/Instagram) events for ads, sent twice with ONE shared event id so Meta counts each once:
 * from the browser (Pixel) and from our server (Conversions API, /api/meta-events).
 * - Nothing loads and nothing is sent unless a Pixel id is configured AND the visitor accepted analytics.
 * - content_ids are product slugs: the same ids as the per-market catalogue feed (/feeds/meta-<market>.xml), so
 *   dynamic and retargeting ads can show the exact product.
 * - No name, phone, email or address is ever sent from here.
 * The brain never spends: this only measures. Campaigns and budgets stay with the owner in Ads Manager.
 */
import {markets,type MarketCode} from "@/lib/store/markets";

export type MetaEventName="PageView"|"ViewContent"|"AddToCart"|"InitiateCheckout"|"Purchase"|"Search";
export type MetaEvent={name:MetaEventName;event_id:string;market:MarketCode;params:{content_ids?:string[];content_type?:"product";value?:number;currency?:string;num_items?:number;search_string?:string}};
const MAP:Record<string,MetaEventName>={"$pageview":"PageView",product_viewed:"ViewContent",add_to_cart:"AddToCart",checkout_started:"InitiateCheckout",order_submitted:"Purchase",search_submitted:"Search"};
const SLUG=/^[a-z0-9][a-z0-9-]{1,159}$/;
const isMarket=(v:unknown):v is MarketCode=>typeof v==="string"&&Object.hasOwn(markets,v);

/** Our analytics event → the Meta standard event, or null when it has no Meta equivalent or lacks a market. */
export function metaEventFor(event:string,props:Record<string,unknown>,eventId:string):MetaEvent|null{
 const name=MAP[event],market=props.market;
 if(!name||!isMarket(market))return null;
 const digits=markets[market].minorDigits,currency=markets[market].currency;
 const slugs=(Array.isArray(props.slugs)?props.slugs:[props.slug]).filter((s):s is string=>typeof s==="string"&&SLUG.test(s)).slice(0,20);
 const minor=typeof props.value_minor==="string"&&/^\d{1,15}$/.test(props.value_minor)?Number(props.value_minor):typeof props.value_minor==="number"&&Number.isSafeInteger(props.value_minor)&&props.value_minor>=0?props.value_minor:null;
 const params:MetaEvent["params"]={};
 if(slugs.length){params.content_ids=slugs;params.content_type="product";}
 if(minor!==null&&name!=="PageView"&&name!=="Search"){params.value=Math.round(minor/10**digits*100)/100;params.currency=currency;}
 if(typeof props.quantity==="number"&&Number.isInteger(props.quantity)&&props.quantity>0)params.num_items=props.quantity;
 if(name==="Search"&&typeof props.query==="string")params.search_string=props.query.slice(0,80);
 if((name==="ViewContent"||name==="AddToCart")&&!params.content_ids)return null; // a product event without a product id is useless to the catalogue
 return {name,event_id:eventId,market,params};
}

export const META_PIXEL_ID:string|undefined=(import.meta.env?.["VITE_META_PIXEL_ID"] as string|undefined)||undefined;
export const pixelConfigured=(id:string|undefined=META_PIXEL_ID):id is string=>typeof id==="string"&&/^\d{8,20}$/.test(id);

type Fbq=((...args:unknown[])=>void)&{queue?:unknown[];loaded?:boolean;callMethod?:(...a:unknown[])=>void;push?:unknown;version?:string};
let started=false;
/** Loads the Pixel once (after consent) and returns fbq. */
function pixel(id:string):Fbq{
 const w=window as unknown as {fbq?:Fbq;_fbq?:Fbq};
 if(!w.fbq){
  const f:Fbq=function(...args:unknown[]){f.callMethod?f.callMethod(...args):f.queue!.push(args);} as Fbq;
  f.queue=[];f.loaded=true;f.version="2.0";f.push=f;w.fbq=f;w._fbq=f;
  const s=document.createElement("script");s.async=true;s.src="https://connect.facebook.net/en_US/fbevents.js";document.head.appendChild(s);
 }
 if(!started){started=true;w.fbq!("init",id);}
 return w.fbq!;
}
/**
 * Called for every analytics event. Sends the Meta twin to the Pixel and to our server with the same event id.
 * `consent` must be "granted": Meta's Pixel sets cookies, so it never runs for a visitor who has not accepted.
 */
export function forwardToMeta(event:string,props:Record<string,unknown>,consent:string,opts:{pixelId?:string;send?:(body:string)=>void;newId?:()=>string}={}):MetaEvent|null{
 const id=opts.pixelId??META_PIXEL_ID;
 if(consent!=="granted"||!pixelConfigured(id)||typeof window==="undefined")return null;
 const e=metaEventFor(event,props,(opts.newId??(()=>crypto.randomUUID()))());
 if(!e)return null;
 pixel(id)("track",e.name,{...e.params,market:e.market},{eventID:e.event_id});
 const body=JSON.stringify({...e,url:window.location.href.slice(0,500)});
 (opts.send??((b:string)=>{try{navigator.sendBeacon?.("/api/meta-events",new Blob([b],{type:"application/json"}))||void fetch("/api/meta-events",{method:"POST",body:b,headers:{"content-type":"application/json"},keepalive:true});}catch{/* measuring never breaks the page */}}))(body);
 return e;
}
