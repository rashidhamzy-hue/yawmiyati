import {useCallback,useEffect,useState} from "react";
import {publicBrowserConfig} from "./staging-public-config";
import type {MarketCode} from "./markets";
import {fetchPublicCatalog,type PublicListing} from "./public-catalog";

const {origin,key}=publicBrowserConfig(import.meta.env["VITE_YAWMIYATI_SUPABASE_URL"],import.meta.env["VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY"]);
export const catalogConfig={origin,key};
export type CatalogState={state:"loading"}|{state:"error";retry:()=>void}|{state:"ready";rows:PublicListing[]};

/** Brain order first (rank 1 = strongest pick); listings without a rank keep their place after them. */
export function byRank(rows:readonly PublicListing[]):PublicListing[]{
 return rows.map((row,i)=>({row,i})).sort((a,b)=>(a.row.rank??1e9)-(b.row.rank??1e9)||a.i-b.i).map(x=>x.row);
}
// Short page-lifetime memory so several components on one page share a single read. Released stock is
// re-checked by the database on every read; 60 seconds keeps navigation snappy without showing stale shelves.
const memory=new Map<MarketCode,{at:number;rows:PublicListing[]}>();
export async function loadStoreCatalog(market:MarketCode,request:typeof fetch=fetch):Promise<PublicListing[]>{
 const hit=memory.get(market);
 if(request===fetch&&hit&&Date.now()-hit.at<60_000)return hit.rows;
 const rows=byRank(await fetchPublicCatalog(origin,key,market,request));
 if(request===fetch)memory.set(market,{at:Date.now(),rows});
 return rows;
}
export function useStoreCatalog(market:MarketCode,enabled=true):CatalogState{
 const [attempt,setAttempt]=useState(0);
 const [state,setState]=useState<CatalogState>({state:"loading"});
 const retry=useCallback(()=>setAttempt(n=>n+1),[]);
 useEffect(()=>{
  if(!enabled||!origin||!key){setState({state:"ready",rows:[]});return;}
  let live=true;setState({state:"loading"});
  loadStoreCatalog(market).then(rows=>{if(live)setState({state:"ready",rows});}).catch(()=>{if(live)setState({state:"error",retry});});
  return()=>{live=false;};
 },[market,enabled,attempt,retry]);
 return state;
}
