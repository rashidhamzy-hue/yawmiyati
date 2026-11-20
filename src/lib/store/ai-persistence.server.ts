import type {MarketCode} from "./markets";
import type {VerifiedFact} from "./research-evidence";
type Rpc=(name:string,args:Record<string,unknown>)=>Promise<unknown>;
function id(x:unknown):string{if(typeof x!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x))throw Error("Invalid job identifier");return x;}
const minor=(amount:bigint)=>{if(amount<0n||amount>9223372036854775807n)throw Error("Invalid cost");return amount.toString();};
export function aiContentPersistence(rpc:Rpc){
 return {
  async reserve(x:{market:MarketCode;task:"localized_content";dedupeKey:string;estimateMicrousd:bigint}){
   if(x.task!=="localized_content"||!x.dedupeKey.trim()||x.dedupeKey.length>128||x.estimateMicrousd<=0n)throw Error("Invalid reservation");
   const jobId=id(await rpc("reserve_ai_job",{p_store:x.market,p_task:x.task,p_key:x.dedupeKey,p_estimate:minor(x.estimateMicrousd)}));
   return {id:jobId,market:x.market,task:x.task,dedupeKey:x.dedupeKey,reservedMicrousd:x.estimateMicrousd};
  },
  async claim(jobId:string,market:MarketCode){const v=await rpc("claim_localized_content_job",{p_store:market,p_job:id(jobId)});if(typeof v!=="boolean")throw Error("Invalid claim response");return v;},
  async complete(x:{jobId:string;market:MarketCode;listingId:string;actualMicrousd:bigint;draft:{segments:unknown[]};brief:{locale:string;channel:string;sourceRegistry:{id:string;source:string}[]}}){
   await rpc("complete_localized_content_job",{p_store:x.market,p_job:id(x.jobId),p_listing:id(x.listingId),p_locale:x.brief.locale,p_channel:x.brief.channel,p_body:{segments:x.draft.segments},p_sources:x.brief.sourceRegistry,p_actual:minor(x.actualMicrousd)});
  },
  async fail(x:{jobId:string;market:MarketCode;reason:string;actualMicrousd:bigint|null}){
   await rpc("fail_localized_content_job",{p_store:x.market,p_job:id(x.jobId),p_actual:x.actualMicrousd===null?null:minor(x.actualMicrousd)});
  },
 };
}
export function verifiedFacts(input:readonly {id:string;statement:string;source:string;verified:boolean}[]):VerifiedFact[]{
 if(input.length>50)throw Error("Too many facts");
 return input.map(f=>({...f}));
}
// Inject the authenticated server-side service-role transport. Never put this adapter in a browser bundle.
