import type { MarketCode } from "./markets";
export type ReviewDecision="pending"|"shortlisted"|"rejected";
export interface CommercialReview {supplier_cost_minor:number|null;delivery_cost_minor:number|null;other_cost_minor:number|null;proposed_price_minor:number|null;decision:ReviewDecision;updated_at:string;}
export interface CandidateRow {woo_product_id:number;supplier_sku:string;title:string;observed_price_minor:string|null;source_stock_status:string|null;observed_at:string;images:unknown;categories:unknown;review:CommercialReview|null;}
export interface CandidateContentState {approval:{revision_id:string;title:string;description:string;source_observed_at:string;approved_at:string}|null;draft:{listing_id:string;revision_id:string;review_at:string}|null;}
export interface CatalogReadiness {woo_product_id:number;listing_id:string|null;listing_status:string|null;blockers:string[];}
export interface CatalogRow { listing_id:string; slug:string; title:string; listing_status:string; variant_count:number; available_count:number; }
export interface Recommendation {id:string;kind:string;rationale:string;state:string;proposal:unknown;created_at:string;}
export interface AiPolicy {enabled:boolean;daily_budget_microusd:number;auto_pricing_enabled:boolean;auto_publish_enabled:boolean;}
export interface MarketPerformance {
 store:MarketCode;currency:string;window_days:number;
 orders:{recorded:number;delivered:number;failed:number;cancelled:number;returned:number;unknown:number;booked_total_minor:string};
 ledger:{entries:number;recorded_net_minor:string};
 marketing_observations:{records:number;impressions:string;clicks:string;submitted_orders:string;delivered_orders:string;spend_minor:string};
 warnings:string[];
}
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
   async readiness(token:string,market:MarketCode):Promise<CatalogReadiness[]>{
     const result=await call("/rest/v1/rpc/dashboard_catalog_readiness",{p_store:market},token);
     if(!Array.isArray(result)||result.some(r=>!r||!Number.isSafeInteger(r.woo_product_id)||!Array.isArray(r.blockers)))throw Error("Invalid readiness response");
     return result;
   },
   async candidates(token:string,market:MarketCode):Promise<CandidateRow[]>{
     const rows=await call("/rest/v1/rpc/dashboard_candidate_review",{p_store:market,p_limit:100},token);
     if(!Array.isArray(rows))throw Error("Invalid candidate response");
     return rows;
   },
   async saveCandidate(token:string,market:MarketCode,product:number,x:{supplier:number|null;delivery:number|null;other:number|null;price:number|null;decision:ReviewDecision;expectedAt:string|null}):Promise<string>{
     if(!Number.isSafeInteger(product)||product<=0||![ "pending","shortlisted","rejected" ].includes(x.decision))throw Error("Invalid candidate");
     for(const amount of [x.supplier,x.delivery,x.other,x.price])if(amount!==null&&(!Number.isSafeInteger(amount)||amount<0||amount>1000000000))throw Error("Invalid commercial amount");
     if(x.price===0)throw Error("Invalid proposed price");
     if(x.expectedAt!==null&&!Number.isFinite(Date.parse(x.expectedAt)))throw Error("Invalid expected revision");
     const updated=await call("/rest/v1/rpc/dashboard_save_candidate_review_v2",{p_store:market,p_product:product,p_supplier:x.supplier,p_delivery:x.delivery,p_other:x.other,p_price:x.price,p_decision:x.decision,p_expected_at:x.expectedAt},token);
     if(typeof updated!=="string"||!Number.isFinite(Date.parse(updated)))throw Error("Invalid review revision");
     return updated;
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
   async publishDraft(token:string,market:MarketCode,product:number,listing:string):Promise<void>{
     if(!Number.isSafeInteger(product)||product<=0||!listing.trim())throw Error("Invalid publication target");
     await call("/rest/v1/rpc/publish_candidate_draft",{p_store:market,p_product:product,p_listing:listing},token);
   },
   async catalog(token:string,market:MarketCode,offset=0):Promise<CatalogRow[]> {
     return call("/rest/v1/rpc/dashboard_catalog",{p_store:market,p_limit:50,p_offset:offset},token);
   },
   async performance(token:string,market:MarketCode,days=30):Promise<MarketPerformance>{
     if(!Number.isSafeInteger(days)||days<1||days>365)throw Error("Invalid period");
     const result=await call("/rest/v1/rpc/dashboard_market_performance",{p_store:market,p_days:days},token);
     if(!result||result.store!==market||!Array.isArray(result.warnings))throw Error("Invalid report");
     return result;
   },
   async summary(token:string,market:MarketCode):Promise<DashboardSummary> {
     return call("/rest/v1/rpc/dashboard_summary",{p_store:market},token);
   },
 };
}
