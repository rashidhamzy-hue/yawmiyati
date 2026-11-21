/**
 * M4F: purely local preparation for AI-assisted research, localized copy and
 * recommendations. No model, search, provider, storage or production calls.
 * Input "verified" flags are untrusted mock data, not authenticated evidence.
 */
import {markets,type MarketCode} from "./markets";
import {assessResearch,prepareContent,validateContentDraft,type Observation,type VerifiedFact} from "./research-evidence";
import {scoringWeights} from "./intelligence";
import {marketExperience} from "./market-experience";

export type AiOfflineChannel="storefront"|"seo"|"social"|"ad";
export type AiOfflineTask="product_research"|"product_copy"|"localization"|"recommendations";
export type AiOfflineCase={
 readonly market:MarketCode;
 readonly sku:string;
 readonly contentRevision:string;
 readonly task:AiOfflineTask;
 readonly channel:AiOfflineChannel;
 readonly facts:readonly VerifiedFact[];
 readonly observations:readonly Observation[];
 /** A proposed assistant draft, not model output or proof of correctness. */
 readonly proposedDraft?:unknown;
 readonly sourceMarket?:MarketCode;
 readonly candidateSkus?:readonly string[];
};
export type AiOfflineIssue=
 |"invalid_market"|"invalid_identity"|"missing_revision"|"untrusted_facts"|"untrusted_observation"
 |"research_incomplete"|"research_invalid"|"invalid_draft"|"draft_claim_review"
 |"unsafe_claim"|"localization_source_missing"|"recommendation_evidence_missing"
 |"candidate_market_unverified"|"candidate_list_invalid"|"unsupported_task";
export type AiOfflineReport={
 readonly mode:"OFFLINE_ONLY_NO_SPEND";
 readonly market:MarketCode;
 readonly locale:string|null;
 readonly task:AiOfflineTask;
 readonly issues:readonly AiOfflineIssue[];
 readonly draftSegments:readonly {readonly text:string;readonly factIds:readonly string[]}[];
 readonly verifiedResearchScore:number|null;
 readonly researchMissing:readonly string[];
 readonly requiresHumanReview:true;
 readonly canCallModel:false;
 readonly canPublish:false;
 readonly canLaunchAds:false;
 readonly canSpend:false;
 readonly canRecommendPublicly:false;
};
const tasks=["product_research","product_copy","localization","recommendations"] as const;
const channels=["storefront","seo","social","ad"] as const;
const safeId=(v:unknown,max=140)=>typeof v==="string"&&v.trim().length>0&&v.length<=max&&!/[\x00-\x1f<>]/.test(v);
const suspicious=/(guaranteed|100%|miracle|cure|clinically proven|limited stock|only [0-9]+ left|best seller|شحن مجاني|مضمون ١٠٠|مضمون 100|يعالج|يشفي|الأفضل في العالم|خصم حصري|تبقى فقط|توصيل مضمون|فوري|معتمد طبياً)/i;
function factValidation(facts:readonly VerifiedFact[]):boolean {
 return Array.isArray(facts)&&facts.length>0&&facts.length<=50&&facts.every(f=>
  f&&f.verified===true&&safeId(f.id,100)&&safeId(f.source,500)&&
  typeof f.statement==="string"&&f.statement.trim().length>0&&f.statement.length<=1500
 )&&new Set(facts.map(f=>f.id)).size===facts.length;
}
function observationsValid(input:AiOfflineCase):boolean{
 return Array.isArray(input.observations)&&input.observations.length<=70&&input.observations.every(o=>
  !!o&&o.market===input.market&&o.sku===input.sku&&o.verified===true&&
  Object.hasOwn(scoringWeights,o.factor)&&Number.isFinite(o.score)&&o.score>=0&&o.score<=100&&
  safeId(o.source,500)&&typeof o.observedAt==="string"&&Number.isFinite(Date.parse(o.observedAt))
 );
}
function unique(values:readonly AiOfflineIssue[]):AiOfflineIssue[]{return [...new Set(values)];}
export function prepareOfflineAiReview(input:AiOfflineCase,asOf:string):AiOfflineReport{
 const issues:AiOfflineIssue[]=[];
 const add=(issue:AiOfflineIssue)=>issues.push(issue);
 const marketValid=Object.hasOwn(markets,input.market);
 if(!marketValid)add("invalid_market");
 if(!safeId(input.sku,200)||/^(?:sim|fixture|demo)[-_:]/i.test(input.sku))add("invalid_identity");
 if(!safeId(input.contentRevision,160))add("missing_revision");
 if(!tasks.includes(input.task))add("unsupported_task");
 if(!channels.includes(input.channel))add("unsupported_task");
 if(!factValidation(input.facts))add("untrusted_facts");
 if(!observationsValid(input))add("untrusted_observation");
 let score:number|null=null;
 let missing:string[]=[];
 if(marketValid&&safeId(input.sku)&&observationsValid(input)&&Number.isFinite(Date.parse(asOf))){
  try{
   const result=assessResearch(input.market,input.sku,input.observations,asOf);
   score=result.score;missing=result.missing;
  }catch{add("research_invalid");}
 }
 if(input.task==="product_research"||input.task==="recommendations"){
  if(score===null)add("research_incomplete");
 }
 if(input.task==="localization"&&(!input.sourceMarket||!Object.hasOwn(markets,input.sourceMarket)||input.sourceMarket===input.market))
  add("localization_source_missing");
 if(input.task==="recommendations"){
  if(!Array.isArray(input.candidateSkus)||input.candidateSkus.length<1||input.candidateSkus.length>12||
    input.candidateSkus.some(s=>!safeId(s,200)||s===input.sku)||
    new Set(input.candidateSkus).size!==input.candidateSkus.length)add("candidate_list_invalid");
  // Other products must have their own source and market evidence; none is accepted here.
  add("recommendation_evidence_missing");
 }
 let segments:{text:string;factIds:string[]}[]=[];
 if(input.task==="product_copy"||input.task==="localization"){
  if(input.proposedDraft===undefined)add("invalid_draft");
  else if(factValidation(input.facts)&&marketValid){
   try{
    const brief=prepareContent(input.market,input.facts,input.channel);
    const parsed=validateContentDraft(input.proposedDraft,brief.facts.map(f=>f.id));
    segments=parsed.segments.map(s=>({text:(s as {text:string}).text,factIds:[...(s as {factIds:string[]}).factIds]}));
    if(segments.some(s=>suspicious.test(s.text)))add("unsafe_claim");
    // Cited fact IDs are NOT semantic entailment, legal review or localization quality.
    add("draft_claim_review");
   }catch{add("invalid_draft");}
  }
 }
 return {
  mode:"OFFLINE_ONLY_NO_SPEND",market:input.market,
  locale:marketValid?markets[input.market].locale:null,task:input.task,
  issues:unique(issues),draftSegments:segments,verifiedResearchScore:score,
  researchMissing:missing,requiresHumanReview:true,
  canCallModel:false,canPublish:false,canLaunchAds:false,canSpend:false,
  canRecommendPublicly:false,
 };
}
export type AiOfflinePlan={
 readonly mode:"OFFLINE_ONLY_NO_SPEND";
 readonly market:MarketCode;
 readonly locale:string;
 readonly suggestedTasks:readonly AiOfflineTask[];
 readonly ownerSteps:readonly string[];
 readonly activeProvider:false;
 readonly aiDailyBudgetMicrousd:0;
 readonly autoPublish:false;
 readonly autoAds:false;
};
/** Local description of a future workflow; no jobs scheduled or enqueued. */
export function planOfflineAiMarket(market:MarketCode):AiOfflinePlan{
 if(!Object.hasOwn(markets,market))throw Error("invalid_market");
 return {mode:"OFFLINE_ONLY_NO_SPEND",market,locale:markets[market].locale,
  suggestedTasks:["product_research","product_copy","localization","recommendations"],
  ownerSteps:[
   "Verify source rights, product identity, localized content and independent research evidence",
   "Review commercial price, inventory and legal claims for "+marketExperience[market].regionName,
   "Approve each specific revision through an authenticated owner workflow",
   "Separately authorize model budget and provider credentials only after launch review",
  ],
  activeProvider:false,aiDailyBudgetMicrousd:0,autoPublish:false,autoAds:false};
}
export function planAllOfflineAiMarkets():readonly AiOfflinePlan[]{
 return (Object.keys(markets) as MarketCode[]).map(planOfflineAiMarket);
}
