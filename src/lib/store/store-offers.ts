import {useEffect,useState} from "react";
import type {MarketCode} from "./markets";
import {catalogConfig} from "./store-catalog";

/**
 * Owner-approved store offers from the release-gated `public_store_offers` RPC: a free-delivery threshold and
 * our own sets. The database returns only what the owner approved and re-checks each one against the supplier's
 * current cost and stock on every read. Fail closed: anything malformed means "no offers".
 */
export type StoreBundle={id:string;slug:string;title:string;price_minor:number;items:{listing_id:string;quantity:number}[];
 /** Themed sets carry a short line under the name; free_delivery = the set counts toward the free-delivery basket. */
 tagline?:string;theme?:string;free_delivery?:boolean};
export type StoreOffers={free_delivery:{threshold_minor:number;ends_at?:string}|null;bundles:StoreBundle[];
 /** Listings whose price already includes delivery. */
 delivery_included:string[]};
export const NO_OFFERS:StoreOffers={free_delivery:null,bundles:[],delivery_included:[]};
const rec=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const money=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>0;
const slugOk=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.length<=200&&!/[/?#\\]/.test(v);
export function parseStoreOffers(data:unknown,market:MarketCode):StoreOffers{
 if(!rec(data)||data["release"]!=="owner_approved"||data["market"]!==market)return NO_OFFERS;
 const fd=data["free_delivery"],ends=rec(fd)&&typeof fd["ends_at"]==="string"&&Number.isFinite(Date.parse(fd["ends_at"]))?fd["ends_at"]:null;
 const free=rec(fd)&&money(fd["threshold_minor"])&&(!ends||Date.parse(ends)>Date.now())?{threshold_minor:fd["threshold_minor"] as number,...(ends?{ends_at:ends}:{})}:null;
 const included=(Array.isArray(data["delivery_included"])?data["delivery_included"].slice(0,200):[]).filter((v):v is string=>typeof v==="string"&&v.length>0&&v.length<=80);
 const seen=new Set<string>(),bundles:StoreBundle[]=[];
 for(const b of Array.isArray(data["bundles"])?data["bundles"].slice(0,40):[]){
  if(!rec(b)||typeof b["id"]!=="string"||!b["id"]||b["id"].length>80||!slugOk(b["slug"])||typeof b["title"]!=="string"||!b["title"].trim()||b["title"].length>300||!money(b["price_minor"])||!Array.isArray(b["items"])||seen.has(b["slug"]))continue;
  const items=b["items"].filter(rec).filter(i=>typeof i["listing_id"]==="string"&&Number.isInteger(i["quantity"])&&(i["quantity"] as number)>=1&&(i["quantity"] as number)<=5)
   .map(i=>({listing_id:i["listing_id"] as string,quantity:i["quantity"] as number}));
  if(items.length<2||items.length!==b["items"].length||items.length>5)continue;
  seen.add(b["slug"]);bundles.push({id:b["id"],slug:b["slug"],title:b["title"].trim(),price_minor:b["price_minor"] as number,items,
   ...(typeof b["tagline"]==="string"&&b["tagline"].trim()&&b["tagline"].length<=200?{tagline:b["tagline"].trim()}:{}),
   ...(typeof b["theme"]==="string"&&/^[a-z][a-z-]{1,39}$/.test(b["theme"])?{theme:b["theme"]}:{}),...(b["free_delivery"]===true?{free_delivery:true}:{})});
 }
 return {free_delivery:free,bundles,delivery_included:included};
}
const memory=new Map<MarketCode,{at:number;offers:StoreOffers}>();
export async function fetchStoreOffers(market:MarketCode,request:typeof fetch=fetch):Promise<StoreOffers>{
 const {origin,key}=catalogConfig;
 if(!origin||!key)return NO_OFFERS;
 const hit=memory.get(market);
 if(request===fetch&&hit&&Date.now()-hit.at<60_000)return hit.offers;
 try{
  const response=await request(new URL("/rest/v1/rpc/public_store_offers",origin),{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({p_store:market}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
  const offers=response.ok?parseStoreOffers(await response.json(),market):NO_OFFERS;
  if(request===fetch)memory.set(market,{at:Date.now(),offers});
  return offers;
 }catch{return NO_OFFERS;}
}
export function useStoreOffers(market:MarketCode,enabled=true):StoreOffers{
 const [offers,setOffers]=useState<StoreOffers>(NO_OFFERS);
 useEffect(()=>{if(!enabled)return;let live=true;void fetchStoreOffers(market).then(o=>{if(live)setOffers(o);});return()=>{live=false;};},[market,enabled]);
 return offers;
}
