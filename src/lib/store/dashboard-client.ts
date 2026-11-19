import type { MarketCode } from "./markets";
export type ReviewDecision="pending"|"shortlisted"|"rejected";
export interface CommercialReview {supplier_cost_minor:number|null;delivery_cost_minor:number|null;other_cost_minor:number|null;proposed_price_minor:number|null;decision:ReviewDecision;updated_at:string;}
export interface CandidateRow {woo_product_id:number;supplier_sku:string;title:string;observed_price_minor:string|null;source_stock_status:string|null;observed_at:string;images:unknown;categories:unknown;review:CommercialReview|null;}
export interface CandidateContentState {approval:{revision_id:string;title:string;description:string;source_observed_at:string;approved_at:string}|null;draft:{listing_id:string;revision_id:string;review_at:string}|null;}
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
   async policy(token:string,market:MarketCode):Promise<AiPolicy>{return call("/rest/v1/rpc/dashboard_ai_policy",{p_store:market},token);},
   async pauseAi(token:string,market:MarketCode):Promise<void>{await call("/rest/v1/rpc/pause_market_ai",{p_store:market},token);},
   async recommendations(token:string,market:MarketCode):Promise<Recommendation[]> {
     return call("/rest/v1/rpc/dashboard_recommendations",{p_store:market},token);
   },
   async review(token:string,market:MarketCode,id:string,decision:"approved"|"rejected"):Promise<void> {
     await call("/rest/v1/rpc/review_recommendation",{p_store:market,p_id:id,p_decision:decision},token);
   },
   async candidates(token:string,market:MarketCode):Promise<CandidateRow[]>{
     const rows=await call("/rest/v1/rpc/dashboard_candidate_review",{p_store:market,p_limit:100},token);
     if(!Array.isArray(rows))throw Error("Invalid candidate response");
     return rows;
   },
   async saveCandidate(token:string,market:MarketCode,product:number,x:{supplier:number|null;delivery:number|null;other:number|null;price:number|null;decision:ReviewDecision}):Promise<void>{
     if(!Number.isSafeInteger(product)||product<=0||![ "pending","shortlisted","rejected" ].includes(x.decision))throw Error("Invalid candidate");
     for(const amount of [x.supplier,x.delivery,x.other,x.price])if(amount!==null&&(!Number.isSafeInteger(amount)||amount<0||amount>1000000000))throw Error("Invalid commercial amount");
     if(x.price===0)throw Error("Invalid proposed price");
     await call("/rest/v1/rpc/dashboard_save_candidate_review",{p_store:market,p_product:product,p_supplier:x.supplier,p_delivery:x.delivery,p_other:x.other,p_price:x.price,p_decision:x.decision},token);
   },
   async candidateContent(token:string,market:MarketCode,product:number):Promise<CandidateContentState>{
     return call("/rest/v1/rpc/dashboard_candidate_content",{p_store:market,p_product:product},token);
   },
   async approveContent(token:string,market:MarketCode,product:number,observedAt:string,title:string,description:string):Promise<string>{
     if(!title.trim()||title.trim().length>500||!description.trim()||description.trim().length>10000||!Number.isFinite(Date.parse(observedAt)))throw Error("Invalid content");
     const result=await call("/rest/v1/rpc/approve_candidate_content",{p_store:market,p_product:product,p_observed_at:observedAt,p_title:title.trim(),p_description:description.trim()},token);
     if(typeof result!=="string"||!result)throw Error("Invalid approval response");return result;
   },
   async createDraft(token:string,market:MarketCode,product:number,reviewAt:string,revision:string):Promise<string>{
     if(!Number.isFinite(Date.parse(reviewAt))||!revision)throw Error("Invalid review revision");
     const result=await call("/rest/v1/rpc/create_candidate_draft",{p_store:market,p_product:product,p_review_at:reviewAt,p_revision:revision},token);
     if(typeof result!=="string"||!result)throw Error("Invalid draft response");return result;
   },
   async catalog(token:string,market:MarketCode,offset=0):Promise<CatalogRow[]> {
     return call("/rest/v1/rpc/dashboard_catalog",{p_store:market,p_limit:50,p_offset:offset},token);
   },
   async summary(token:string,market:MarketCode):Promise<DashboardSummary> {
     return call("/rest/v1/rpc/dashboard_summary",{p_store:market},token);
   },
 };
}
