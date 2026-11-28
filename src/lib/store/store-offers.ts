import {useEffect,useState} from "react";
import type {MarketCode} from "./markets";
import {catalogConfig} from "./store-catalog";

/**
 * Owner-approved store offers from the release-gated `public_store_offers` RPC: a free-delivery threshold and
 * our own sets. The database returns only what the owner approved and re-checks each one against the supplier's
 * current cost and stock on every read. Fail closed: anything malformed means "no offers".
 */
export type StoreBundle={id:string;slug:string;title:string;price_minor:number;items:{listing_id:string;quantity:number}[]};
export type StoreOffers={free_delivery:{threshold_minor:number}|null;bundles:StoreBundle[]};
export const NO_OFFERS:StoreOffers={free_delivery:null,bundles:[]};
const rec=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const money=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>0;
const slugOk=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.length<=200&&!/[/?#\\]/.test(v);
export function parseStoreOffers(data:unknown,market:MarketCode):StoreOffers{
 if(!rec(data)||data["release"]!=="owner_approved"||data["market"]!==market)return NO_OFFERS;
 const fd=data["free_delivery"],free=rec(fd)&&money(fd["threshold_minor"])?{threshold_minor:fd["threshold_minor"] as number}:null;
 const seen=new Set<string>(),bundles:StoreBundle[]=[];
 for(const b of Array.isArray(data["bundles"])?data["bundles"].slice(0,40):[]){
  if(!rec(b)||typeof b["id"]!=="string"||!b["id"]||b["id"].length>80||!slugOk(b["slug"])||typeof b["title"]!=="string"||!b["title"].trim()||b["title"].length>300||!money(b["price_minor"])||!Array.isArray(b["items"])||seen.has(b["slug"]))continue;
  const items=b["items"].filter(rec).filter(i=>typeof i["listing_id"]==="string"&&Number.isInteger(i["quantity"])&&(i["quantity"] as number)>=1&&(i["quantity"] as number)<=5)
   .map(i=>({listing_id:i["listing_id"] as string,quantity:i["quantity"] as number}));
  if(items.length<2||items.length!==b["items"].length||items.length>5)continue;
  seen.add(b["slug"]);bundles.push({id:b["id"],slug:b["slug"],title:b["title"].trim(),price_minor:b["price_minor"] as number,items});
 }
 return {free_delivery:free,bundles};
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
export function useStoreOffers(market:MarketCode):StoreOffers{
 const [offers,setOffers]=useState<StoreOffers>(NO_OFFERS);
 useEffect(()=>{let live=true;void fetchStoreOffers(market).then(o=>{if(live)setOffers(o);});return()=>{live=false;};},[market]);
 return offers;
}
