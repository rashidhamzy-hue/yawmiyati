import type { MarketCode } from "./markets";
export interface CatalogRow { listing_id:string; slug:string; title:string; listing_status:string; variant_count:number; available_count:number; }
export interface Recommendation {id:string;kind:string;rationale:string;state:string;proposal:unknown;created_at:string;}
export interface AiPolicy {enabled:boolean;daily_budget_microusd:number;auto_pricing_enabled:boolean;auto_publish_enabled:boolean;}
export interface DashboardSummary {
 store: MarketCode; currency: string; orders: number; customers: number;
 order_statuses: Record<string,number>; recorded_net_minor: string;
}
export function dashboardClient(origin: string, publicKey: string, request: typeof fetch = fetch) {
 const url = new URL(origin);
 if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || !publicKey) throw new Error("Dashboard configuration unavailable");
 async function call(path: string, body: unknown, token?: string) {
   const response = await request(new URL(path,url), {
     method:"POST", headers:{"Content-Type":"application/json",apikey:publicKey,...(token?{Authorization:"Bearer "+token}:{})},
     body:JSON.stringify(body),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000),
   });
   if (!response.ok) throw new Error(response.status===401||response.status===403?"Access denied":"Dashboard request failed");
   if (response.status===204) return undefined;
   return response.json();
 }
 return {
   async signIn(email:string,password:string):Promise<string> {
     const data=await call("/auth/v1/token?grant_type=password",{email,password});
     if(typeof data.access_token!=="string") throw new Error("Authentication failed");
     return data.access_token;
   },
   async policy(token:string,market:MarketCode):Promise<AiPolicy>{return call("/rest/v1/rpc/dashboard_ai_policy",{p_store:market},token);}
   async pauseAi(token:string,market:MarketCode):Promise<void>{await call("/rest/v1/rpc/pause_market_ai",{p_store:market},token);}
   async recommendations(token:string,market:MarketCode):Promise<Recommendation[]> {
     return call("/rest/v1/rpc/dashboard_recommendations",{p_store:market},token);
   },
   async review(token:string,market:MarketCode,id:string,decision:"approved"|"rejected"):Promise<void> {
     await call("/rest/v1/rpc/review_recommendation",{p_store:market,p_id:id,p_decision:decision},token);
   },
   async catalog(token:string,market:MarketCode,offset=0):Promise<CatalogRow[]> {
     return call("/rest/v1/rpc/dashboard_catalog",{p_store:market,p_limit:50,p_offset:offset},token);
   },
   async summary(token:string,market:MarketCode):Promise<DashboardSummary> {
     return call("/rest/v1/rpc/dashboard_summary",{p_store:market},token);
   },
 };
}
