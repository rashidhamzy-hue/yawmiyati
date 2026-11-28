import {useEffect,useState} from "react";
import type {MarketCode} from "./markets";

/**
 * The shopper's cart for released products. It lives only in this browser (one per market) and holds
 * what she chose, never prices: prices and offers are read fresh from the released catalogue whenever
 * the cart is shown, so an out-of-date price can never be charged. No customer details are kept here.
 */
export type CartItemLine={kind:"item";listing_id:string;slug:string;title:string;image:string|null;quantity:number};
export type CartBundleLine={kind:"bundle";bundle_id:string;slug:string;title:string;image:string|null;quantity:number};
export type CartLine=CartItemLine|CartBundleLine;
export type ShopCart={market:MarketCode;lines:CartLine[]};
export const MAX_LINE_QUANTITY=6,MAX_LINES=12;
const KEY=(m:MarketCode)=>"yawmiyati.cart.v1."+m,EVENT="yawmiyati:cart";
export const lineId=(l:CartLine)=>l.kind==="item"?"i:"+l.listing_id:"b:"+l.bundle_id;
const text=(v:unknown,max:number)=>typeof v==="string"&&v.length<=max?v:null;

export function parseCart(raw:unknown,market:MarketCode):ShopCart{
 const lines:CartLine[]=[];
 if(raw&&typeof raw==="object"&&Array.isArray((raw as {lines?:unknown}).lines)){
  for(const x of (raw as {lines:unknown[]}).lines.slice(0,MAX_LINES)){
   if(!x||typeof x!=="object")continue;
   const r=x as Record<string,unknown>;
   const slug=text(r["slug"],200),title=text(r["title"],500),q=r["quantity"];
   if(!slug||!title||/[/?#\\]/.test(slug)||!Number.isInteger(q)||(q as number)<1||(q as number)>MAX_LINE_QUANTITY)continue;
   const common={slug,title,image:text(r["image"],80),quantity:q as number};
   if(r["kind"]==="item"&&text(r["listing_id"],80))lines.push({kind:"item",listing_id:r["listing_id"] as string,...common});
   else if(r["kind"]==="bundle"&&text(r["bundle_id"],80))lines.push({kind:"bundle",bundle_id:r["bundle_id"] as string,...common});
  }
 }
 const seen=new Set<string>();
 return {market,lines:lines.filter(l=>!seen.has(lineId(l))&&!!seen.add(lineId(l)))};
}
export function readCart(market:MarketCode):ShopCart{
 if(typeof window==="undefined")return {market,lines:[]};
 try{return parseCart(JSON.parse(window.localStorage.getItem(KEY(market))??"null"),market);}catch{return {market,lines:[]};}
}
function writeCart(cart:ShopCart){
 try{window.localStorage.setItem(KEY(cart.market),JSON.stringify({lines:cart.lines}));}catch{/* private mode: the cart lasts for this page only */}
 window.dispatchEvent(new CustomEvent(EVENT,{detail:cart}));
}
export function addToCart(market:MarketCode,line:CartLine):ShopCart{
 const cart=readCart(market),id=lineId(line),existing=cart.lines.find(l=>lineId(l)===id);
 const lines=existing?cart.lines.map(l=>lineId(l)===id?{...l,title:line.title,image:line.image,quantity:Math.min(MAX_LINE_QUANTITY,l.quantity+line.quantity)}:l)
  :[...cart.lines,{...line,quantity:Math.min(MAX_LINE_QUANTITY,Math.max(1,line.quantity))}].slice(0,MAX_LINES);
 const next={market,lines};writeCart(next);return next;
}
export function setLineQuantity(market:MarketCode,id:string,quantity:number):ShopCart{
 const cart=readCart(market);
 const lines=quantity<1?cart.lines.filter(l=>lineId(l)!==id):cart.lines.map(l=>lineId(l)===id?{...l,quantity:Math.min(MAX_LINE_QUANTITY,Math.floor(quantity))}:l);
 const next={market,lines};writeCart(next);return next;
}
export function clearCart(market:MarketCode){writeCart({market,lines:[]});}
export const cartCount=(cart:ShopCart)=>cart.lines.reduce((n,l)=>n+l.quantity,0);

/** Server render and first paint show an empty cart; the stored cart appears after hydration (no mismatch). */
export function useShopCart(market:MarketCode):ShopCart{
 const [cart,setCart]=useState<ShopCart>({market,lines:[]});
 useEffect(()=>{
  setCart(readCart(market));
  const sync=()=>setCart(readCart(market));
  window.addEventListener(EVENT,sync);window.addEventListener("storage",sync);
  return()=>{window.removeEventListener(EVENT,sync);window.removeEventListener("storage",sync);};
 },[market]);
 return cart;
}

export type QuantityOffer={quantity:number;price_minor:number};
/**
 * Cheapest way to buy `quantity` pieces from the single price and the approved "N for X" offers.
 * Every offer already earns its keep at full unit cost, so any mix of them does too.
 */
export function priceForQuantity(unitMinor:bigint,offers:readonly QuantityOffer[],quantity:number):{total:bigint;saving:bigint}{
 if(!Number.isInteger(quantity)||quantity<1||quantity>MAX_LINE_QUANTITY*4)throw Error("Invalid quantity");
 const packs=offers.filter(o=>Number.isInteger(o.quantity)&&o.quantity>=2&&Number.isSafeInteger(o.price_minor)&&o.price_minor>0&&BigInt(o.price_minor)<unitMinor*BigInt(o.quantity));
 const best:bigint[]=[0n];
 for(let n=1;n<=quantity;n++){
  let v=best[n-1]!+unitMinor;
  for(const p of packs)if(p.quantity<=n){const c=best[n-p.quantity]!+BigInt(p.price_minor);if(c<v)v=c;}
  best.push(v);
 }
 const total=best[quantity]!;
 return {total,saving:unitMinor*BigInt(quantity)-total};
}
