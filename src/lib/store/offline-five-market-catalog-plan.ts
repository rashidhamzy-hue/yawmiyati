/**
 * M5H: evidence-first five-market shortlist planner.
 * Source inputs are never authenticated here and are not live supplier data.
 * No import, AI execution, spending, publishing, checkout or deployment.
 */
import {markets,type MarketCode} from "./markets";
import {shortlistCandidates,type ShortlistCandidate,type ShortlistResult} from "./offline-catalog-shortlist";
import {planProductTasks,type PlannedTask} from "./offline-ai-orchestrator";
export type MarketCatalogPlan={
 readonly market:MarketCode;readonly submittedCandidates:number;
 readonly proposed:readonly ShortlistResult[];
 readonly heldWithinTopN:readonly ShortlistResult[];
 readonly notProposed:number;readonly minimumTarget:number;readonly maximumTarget:number;
 readonly selectionShortfall:number;readonly meetsQuantityTarget:boolean;
 readonly offlineTaskPreviews:readonly PlannedTask[];
 readonly canImport:false;readonly canPublish:false;readonly canOrder:false;
};
export type FiveMarketCatalogPlan={
 readonly markets:readonly MarketCatalogPlan[];
 readonly totalProposed:number;readonly totalSubmitted:number;
 readonly allQuantityTargetsMet:boolean;
 readonly verifiedLiveSupplierData:false;
 readonly canLaunch:false;readonly canImport:false;readonly canSpend:false;
};
export function planFiveMarketCatalog(
 intake:Readonly<Record<MarketCode,readonly ShortlistCandidate[]>>,
 asOf:string,minimumTarget=100,maximumTarget=150,
):FiveMarketCatalogPlan{
 if(!Number.isInteger(minimumTarget)||!Number.isInteger(maximumTarget)||
   minimumTarget<1||maximumTarget>150||minimumTarget>maximumTarget)
  throw Error("Invalid selection targets");
 const codes=Object.keys(markets) as MarketCode[];
 const plans=codes.map(market=>{
  const candidates=intake?.[market];
  if(!Array.isArray(candidates))throw Error("Missing market input");
  const ranked=shortlistCandidates(market,candidates,asOf,maximumTarget);
  const proposed=ranked.filter(x=>x.eligibleForOwnerReview);
  const heldWithinTopN=ranked.filter(x=>!x.eligibleForOwnerReview);
  const shortfall=Math.max(0,minimumTarget-proposed.length);
  return {market,submittedCandidates:candidates.length,proposed,heldWithinTopN,
   notProposed:candidates.length-proposed.length,minimumTarget,maximumTarget,
   selectionShortfall:shortfall,meetsQuantityTarget:shortfall===0,
   offlineTaskPreviews:proposed.flatMap(x=>planProductTasks(market,x.sku)),
   canImport:false as const,canPublish:false as const,canOrder:false as const};
 });
 return {markets:plans,totalProposed:plans.reduce((n,p)=>n+p.proposed.length,0),
  totalSubmitted:plans.reduce((n,p)=>n+p.submittedCandidates,0),
  allQuantityTargetsMet:plans.every(p=>p.meetsQuantityTarget),
  verifiedLiveSupplierData:false,canLaunch:false,canImport:false,canSpend:false};
}
