/**
 * M4C: source-only owner dashboard presentation.
 * Data is NOT validated here as authenticated or live; only the owner RPC
 * may provide market-specific observations after its server-side RLS checks.
 * No synthetic records, assumptions, financial "profit" or release action.
 */
import {markets,type MarketCode} from "./markets";
import type {DashboardSummary,MarketPerformance,CatalogRow,Recommendation,AiPolicy} from "./dashboard-client";

export type OwnerAlert={code:string;level:"info"|"attention";title:string;detail:string};
export type OwnerOverview={
 market:MarketCode;marketCurrency:string;observedOrders:number|null;
 customers:number|null;recordedNet:string|null;
 catalogCount:number|null;pendingRecommendations:number|null;
 activeAutomation:boolean|null;releaseStatus:"not_verified";
 alerts:readonly OwnerAlert[];
};
/** Render recorded minor-unit totals exactly (no floating point, no guessed amounts). */
export function formatRecordedMinor(market:MarketCode,value:string):string {
 if(!Object.hasOwn(markets,market)||typeof value!=="string"||! /^-?\d+$/.test(value)||value.length>100)
  throw Error("invalid_minor_units");
 const amount=BigInt(value),precision=markets[market].minorDigits;
 const negative=amount<0n?"-":"",abs=amount<0n?-amount:amount;
 const unit=10n**BigInt(precision);
 const whole=(abs/unit).toLocaleString("en-US");
 const fraction=(abs%unit).toString().padStart(precision,"0");
 return negative+whole+"."+fraction+" "+markets[market].currency;
}
/**
 * Always return "not_verified": even an RPC reporting zero blockers cannot
 * authorize live publication or checkout. Missing data is UNKNOWN, not zero.
 */
export function summarizeOwnerMarket(
 market:MarketCode,
 summary:DashboardSummary|null,
 performance:MarketPerformance|null,
 catalog:readonly CatalogRow[]|null,
 recommendations:readonly Recommendation[]|null,
 policy:AiPolicy|null,
):OwnerOverview{
 if(!Object.hasOwn(markets,market))throw Error("invalid_market");
 const currency=markets[market].currency;
 const alert:OwnerAlert[]=[];
 const add=(code:string,level:OwnerAlert["level"],title:string,detail:string)=>alert.push({code,level,title,detail});
 if(summary&& (summary.store!==market||summary.currency!==currency))
  throw Error("dashboard_summary_market_mismatch");
 if(performance&&(performance.store!==market||performance.currency!==currency))
  throw Error("dashboard_performance_market_mismatch");
 const recordedNet=summary?formatRecordedMinor(market,summary.recorded_net_minor):null;
 if(!summary)add("summary_missing","attention","Totals unavailable","Owner summary has not loaded or could not be verified.");
 if(!performance)add("performance_missing","attention","Performance unavailable","Recorded performance cannot be interpreted until the selected market response loads.");
 if(catalog===null)add("catalog_unknown","info","Catalog not loaded","Product listing counts have not been confirmed.");
 else if(catalog.length===0)add("empty_catalog","info","No listings in this response","This is an empty owner catalog response, not proof a supplier has no products.");
 else if(catalog.some(x=>x.available_count>0))add("inventory_advisory","attention","Availability is observational","An available count does not prove current supplier stock or authorize order intake.");
 if(recommendations===null)add("recommendations_unknown","info","Approval queue unavailable","No approval decisions can be inferred until the owner response loads.");
 else if(recommendations.some(r=>r.state==="pending"))
  add("pending_recommendations","attention","Review items pending","Recommendations are owner decisions, not automatic product publication.");
 if(policy===null)add("policy_unknown","attention","Automation policy unavailable","Do not assume disabled or enabled automation without an authenticated response.");
 else if(policy.enabled||policy.auto_pricing_enabled||policy.auto_publish_enabled)
  add("policy_active","attention","Automation policy requires review","Check the live owner policy and authorized spending limits. This dashboard cannot approve launch.");
 if(performance){
  for(const warning of performance.warnings.slice(0,12)){
   if(typeof warning==="string"&&warning.trim())add("report_warning","attention","Reporting limitation",warning.slice(0,350));
  }
  if(performance.warnings.length>12)add("more_warnings","attention","Additional reporting warnings",String(performance.warnings.length-12)+" further warnings were not expanded.");
 }
 add("launch_blocked","attention","Launch not verified","Catalog publication, checkout, supplier dispatch and real settlement require separate market-specific server evidence and explicit approval.");
 return {
  market,marketCurrency:currency,
  observedOrders:summary?.orders??null,customers:summary?.customers??null,
  recordedNet,
  catalogCount:catalog?.length??null,
  pendingRecommendations:recommendations?.filter(r=>r.state==="pending").length??null,
  activeAutomation:policy===null?null:policy.enabled||policy.auto_pricing_enabled||policy.auto_publish_enabled,
  releaseStatus:"not_verified",alerts:alert,
 };
}
