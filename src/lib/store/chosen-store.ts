import {markets,type MarketCode} from "./markets";
/**
 * The store a visitor picked on the chooser, remembered in this browser only so the chooser can show it first next time.
 * A plain preference (one of five market codes): never sent to the server, never used to redirect, not a profile.
 */
const KEY="yawmiyati.store";
export function rememberStore(market:MarketCode):void{
 try{window.localStorage.setItem(KEY,market);}catch{/* private mode: nothing is remembered */}
}
export function rememberedStore():MarketCode|null{
 try{const v=window.localStorage.getItem(KEY);return v&&v in markets?v as MarketCode:null;}catch{return null;}
}
/** The remembered store first, the rest in their usual order. */
export function storesInOrder(order:readonly MarketCode[],first:MarketCode|null):readonly MarketCode[]{
 return first&&order.includes(first)?[first,...order.filter(m=>m!==first)]:order;
}
