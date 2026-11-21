import { markets, type MarketCode } from "./markets";
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
   const rpc=path.startsWith("/rest/v1/rpc/");
   if(rpc){
     const payload=body as {p_store?:unknown}|null;
     if(!payload||!Object.hasOwn(markets,payload.p_store as string))throw Error("Invalid owner market");
     if(typeof token!=="string"||!token.trim()||token.length>8192||/[\x00-\x20\x7f]/.test(token))
       throw Error("Owner authentication required");
   } else if(path!=="/auth/v1/token?grant_type=password"){
     throw Error("Invalid owner endpoint");
   }
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
     if(typeof id!=="string"||!id.trim()||id.length>200||!["approved","rejected"].includes(decision))throw Error("Invalid decision target");
     await call("/rest/v1/rpc/review_recommendation",{p_store:market,p_id:id,p_decision:decision},token);
   },
   async readiness(token:string,market:MarketCode,offset=0):Promise<CatalogReadiness[]>{
     if(!Number.isSafeInteger(offset)||offset<0||offset>100000)throw Error("Invalid readiness offset");
     const nextPage=offset>0;
     const result=await call(nextPage?"/rest/v1/rpc/dashboard_catalog_readiness_page":"/rest/v1/rpc/dashboard_catalog_readiness",
       nextPage?{p_store:market,p_limit:100,p_offset:offset}:{p_store:market},token);
     if(!Array.isArray(result)||result.length>100||result.some(r=>!r||!Number.isSafeInteger(r.woo_product_id)||!Array.isArray(r.blockers)))throw Error("Invalid readiness response");
     return result;
   },
   async candidates(token:string,market:MarketCode,offset=0):Promise<CandidateRow[]>{
     if(!Number.isSafeInteger(offset)||offset<0||offset>100000)throw Error("Invalid candidate offset");
     // Keep first-page access compatible with staging before the M6C migration.
     const nextPage=offset>0;
     const rows=await call(nextPage?"/rest/v1/rpc/dashboard_candidate_review_page":"/rest/v1/rpc/dashboard_candidate_review",
       nextPage?{p_store:market,p_limit:100,p_offset:offset}:{p_store:market,p_limit:100},token);
     if(!Array.isArray(rows)||rows.length>100||rows.some((row:unknown)=>{
       if(!row||typeof row!=="object")return true;
       const x=row as Partial<CandidateRow>;
       return !Number.isSafeInteger(x.woo_product_id)||x.woo_product_id! <= 0||
        typeof x.supplier_sku!=="string"||typeof x.title!=="string";
     }))throw Error("Invalid candidate response");
     return rows as CandidateRow[];
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
     if(!Number.isSafeInteger(product)||product<=0)throw Error("Invalid product");
     return call("/rest/v1/rpc/dashboard_candidate_content",{p_store:market,p_product:product},token);
   },
   async approveContent(token:string,market:MarketCode,product:number,observedAt:string,title:string,description:string):Promise<string>{
     if(!Number.isSafeInteger(product)||product<=0||!title.trim()||title.trim().length>500||!description.trim()||description.trim().length>10000||!Number.isFinite(Date.parse(observedAt)))throw Error("Invalid content");
     const result=await call("/rest/v1/rpc/approve_candidate_content",{p_store:market,p_product:product,p_observed_at:observedAt,p_title:title.trim(),p_description:description.trim()},token);
     if(typeof result!=="string"||!result)throw Error("Invalid approval response");return result;
   },
   async createDraft(token:string,market:MarketCode,product:number,reviewAt:string,revision:string):Promise<string>{
     if(!Number.isSafeInteger(product)||product<=0||!Number.isFinite(Date.parse(reviewAt))||typeof revision!=="string"||!revision.trim()||revision.length>500)throw Error("Invalid review revision");
     const result=await call("/rest/v1/rpc/create_candidate_draft",{p_store:market,p_product:product,p_review_at:reviewAt,p_revision:revision},token);
     if(typeof result!=="string"||!result)throw Error("Invalid draft response");return result;
   },
   async publishDraft(token:string,market:MarketCode,product:number,listing:string):Promise<void>{
     if(!Number.isSafeInteger(product)||product<=0||!listing.trim())throw Error("Invalid publication target");
     await call("/rest/v1/rpc/publish_candidate_draft",{p_store:market,p_product:product,p_listing:listing},token);
   },
   async catalog(token:string,market:MarketCode,offset=0):Promise<CatalogRow[]> {
     if(!Number.isSafeInteger(offset)||offset<0||offset>100000)throw Error("Invalid catalog offset");
     const result=await call("/rest/v1/rpc/dashboard_catalog",{p_store:market,p_limit:50,p_offset:offset},token);
     if(!Array.isArray(result)||result.length>50||result.some((row:unknown)=>{
       if(!row||typeof row!=="object")return true;
       const item=row as Partial<CatalogRow>;
       return typeof item.listing_id!=="string"||!item.listing_id.trim()||
        typeof item.title!=="string"||typeof item.slug!=="string"||
        typeof item.listing_status!=="string"||
        !Number.isSafeInteger(item.variant_count)||item.variant_count! < 0||
        !Number.isSafeInteger(item.available_count)||item.available_count! < 0;
     }))throw Error("Invalid catalog response");
     return result as CatalogRow[];
   },
   async performance(token:string,market:MarketCode,days=30):Promise<MarketPerformance>{
     if(!Number.isSafeInteger(days)||days<1||days>365)throw Error("Invalid period");
     const result=await call("/rest/v1/rpc/dashboard_market_performance",{p_store:market,p_days:days},token);
     if(!result||result.store!==market||result.currency!==markets[market].currency||!Array.isArray(result.warnings))throw Error("Invalid report");
     return result;
   },
   async summary(token:string,market:MarketCode):Promise<DashboardSummary> {
     const result=await call("/rest/v1/rpc/dashboard_summary",{p_store:market},token);
     if(!result||result.store!==market||result.currency!==markets[market].currency||!Number.isSafeInteger(result.orders)||result.orders<0||!Number.isSafeInteger(result.customers)||result.customers<0||typeof result.recorded_net_minor!=="string"||! /^-?\d+$/.test(result.recorded_net_minor))throw Error("Invalid market summary");
     return result;
   },
 };
}
