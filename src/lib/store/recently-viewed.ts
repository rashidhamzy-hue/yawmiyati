import {useEffect,useState} from "react";
import type {MarketCode} from "./markets";
import {readConsent} from "@/lib/analytics/analytics";

/**
 * "Viewed before" for this browser only. Nothing is written unless she accepted the consent prompt, and
 * nothing is ever sent anywhere: the list is a few product addresses in this browser's own storage.
 */
const KEY=(m:MarketCode)=>"yawmiyati.viewed.v1."+m,LIMIT=12;
const valid=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.length<=200&&!/[/?#\\]/.test(v);
export function readViewed(market:MarketCode):string[]{
 if(typeof window==="undefined"||readConsent()!=="granted")return [];
 try{const raw:unknown=JSON.parse(window.localStorage.getItem(KEY(market))??"[]");return Array.isArray(raw)?raw.filter(valid).slice(0,LIMIT):[];}catch{return [];}
}
export function rememberViewed(market:MarketCode,slug:string):void{
 if(typeof window==="undefined"||!valid(slug))return;
 try{
  if(readConsent()!=="granted"){window.localStorage.removeItem(KEY(market));return;}
  window.localStorage.setItem(KEY(market),JSON.stringify([slug,...readViewed(market).filter(s=>s!==slug)].slice(0,LIMIT)));
 }catch{/* storage unavailable: nothing to remember */}
}
/** Slugs viewed before, newest first, without the product on screen. Empty on the server and before consent. */
export function useViewed(market:MarketCode,exclude?:string):string[]{
 const [slugs,setSlugs]=useState<string[]>([]);
 useEffect(()=>{setSlugs(readViewed(market).filter(s=>s!==exclude));},[market,exclude]);
 return slugs;
}
