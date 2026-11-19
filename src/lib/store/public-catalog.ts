import type {MarketCode} from "./markets";
export type PublicListing={listing_id:string;slug:string;title:string;price_minor:string;currency:string};
export async function fetchPublicCatalog(origin:string,key:string,market:MarketCode,request:typeof fetch=fetch):Promise<PublicListing[]>{
 const url=new URL(origin);
 if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash||!key)throw new Error("Invalid catalog configuration");
 const response=await request(new URL("/rest/v1/rpc/public_catalog",url),{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({p_store:market,p_limit:50,p_offset:0}),redirect:"error",signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error("Catalog unavailable");
 const data=await response.json();if(!Array.isArray(data))throw new Error("Invalid catalog response");return data;
}
