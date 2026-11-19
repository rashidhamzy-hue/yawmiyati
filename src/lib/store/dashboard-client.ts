import type { MarketCode } from "./markets";
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
   return response.json();
 }
 return {
   async signIn(email:string,password:string):Promise<string> {
     const data=await call("/auth/v1/token?grant_type=password",{email,password});
     if(typeof data.access_token!=="string") throw new Error("Authentication failed");
     return data.access_token;
   },
   async summary(token:string,market:MarketCode):Promise<DashboardSummary> {
     return call("/rest/v1/rpc/dashboard_summary",{p_store:market},token);
   },
 };
}
