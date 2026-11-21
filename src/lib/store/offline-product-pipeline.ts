/**
 * M5E: composition-only offline pipeline. No external effects.
 * Requires real authenticated evidence before any production use.
 */
import type {MarketCode} from "./markets";
import {shortlistCandidates,type ShortlistCandidate} from "./offline-catalog-shortlist";
import {validateEditorialPackage,type EditorialPackage} from "./offline-editorial-package";
import {planProductTasks,evaluateTaskPlan} from "./offline-ai-orchestrator";
import {assessRelease,type ReleaseEvidence} from "./offline-release-readiness";
export type PipelineInput={
 market:MarketCode;asOf:string;candidate:ShortlistCandidate;
 editorial:EditorialPackage;verifiedFactIds:readonly string[];
 release:ReleaseEvidence;
};
export function evaluateOfflineProductPipeline(input:PipelineInput){
 const {market,candidate,editorial,release,asOf}=input;
 if(candidate.market!==market||editorial.market!==market||release.market!==market||
  candidate.sku!==editorial.sku||candidate.sku!==release.sku||
  editorial.revision!==release.revision)throw Error("Pipeline market, SKU or revision mismatch");
 const ranking=shortlistCandidates(market,[candidate],asOf,1)[0];
 const content=validateEditorialPackage(editorial,input.verifiedFactIds);
 const tasks=planProductTasks(market,candidate.sku);
 const taskStates=evaluateTaskPlan(tasks,new Set<string>(),new Set<string>());
 const readiness=assessRelease(release);
 const blockers=[
  ...ranking.blockers.map(x=>"research:"+x),
  ...content.issues.map(x=>"editorial:"+x),
  ...readiness.blockers.map(x=>"release:"+x),
 ];
 return {market,sku:candidate.sku,revision:release.revision,ranking,content,taskStates,readiness,
  blockers,readyForOwnerReview:blockers.length===0,
  requiresOwnerReview:true as const,canExecute:false as const,canPublish:false as const,
  canIndex:false as const,canOrder:false as const,canSpend:false as const};
}
