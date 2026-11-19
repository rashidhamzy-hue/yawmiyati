import {markets,type MarketCode} from "./markets";
export type PublicListing={listing_id:string;slug:string;title:string;price_minor:string;currency:string};
export function parsePublicListings(data:unknown,market:MarketCode):PublicListing[]{
 if(!Array.isArray(data)||data.length>100)throw Error("Invalid catalog response");
 const seen=new Set<string>();
 return data.map(raw=>{
  if(!raw||typeof raw!=="object")throw Error("Invalid listing");
  const r=raw as Record<string,unknown>;
  if(typeof r.listing_id!=="string"||!r.listing_id||typeof r.slug!=="string"||!r.slug||r.slug.length>200||/[/?#\\]/.test(r.slug)||typeof r.title!=="string"||!r.title.trim()||r.title.length>500||typeof r.price_minor!=="string"||!/^\d+$/.test(r.price_minor)||!Number.isSafeInteger(Number(r.price_minor))||Number(r.price_minor)<=0||r.currency!==markets[market].currency||seen.has(r.slug))throw Error("Invalid listing");
  seen.add(r.slug);
  return {listing_id:r.listing_id,slug:r.slug,title:r.title,price_minor:r.price_minor,currency:r.currency};
 });
}
export const storefrontMode=(origin:unknown,key:unknown,demo:unknown)=>typeof origin==="string"&&origin&&typeof key==="string"&&key?"catalog":!origin&&!key&&demo==="true"?"demo":"unconfigured";
export function formatListingPrice(row:PublicListing,market:MarketCode){
 if(row.currency!==markets[market].currency)throw Error("Currency mismatch");
 return new Intl.NumberFormat(markets[market].locale,{style:"currency",currency:row.currency}).format(Number(row.price_minor)/10**markets[market].minorDigits);
}
export async function fetchPublicCatalog(origin:string,key:string,market:MarketCode,request:typeof fetch=fetch):Promise<PublicListing[]>{
 const url=new URL(origin);
 if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash||!key)throw Error("Invalid catalog configuration");
 const all:PublicListing[]=[];
 const seen=new Set<string>();
 for(let offset=0;offset<1000;offset+=100){
  const response=await request(new URL("/rest/v1/rpc/public_catalog",url),{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({p_store:market,p_limit:100,p_offset:offset}),redirect:"error",signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error("Catalog unavailable");
  const rows=parsePublicListings(await response.json(),market);
  for(const row of rows){if(seen.has(row.slug))throw Error("Catalog changed during pagination");seen.add(row.slug);all.push(row);}
  if(rows.length<100)return all;
 }
 throw Error("Catalog exceeds preview limit");
}
