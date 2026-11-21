/**
 * M5F: replayable, OFFLINE job lifecycle reducer.
 *
 * A server may persist the returned snapshot/event record in a future milestone.
 * This file makes no network/DB/model calls and does not authenticate callers.
 * No action here authorizes paid execution, product publication or orders.
 */
import type {MarketCode} from "./markets";
import type {TaskKind} from "./offline-ai-orchestrator";

export type OfflineJobStatus="queued"|"leased"|"needs_review"|"review_accepted"|"rejected"|"dead_letter";
export type OfflineEvent=
 |{id:string;jobId:string;type:"lease";token:string;until:string}
 |{id:string;jobId:string;type:"complete";token:string}
 |{id:string;jobId:string;type:"fail";token:string;reason:string}
 |{id:string;jobId:string;type:"expire"}
 |{id:string;jobId:string;type:"review_accept";revision:string;decisionRef:string}
 |{id:string;jobId:string;type:"review_reject";revision:string;decisionRef:string};
export type OfflineJob={
 readonly id:string;readonly market:MarketCode;readonly sku:string;readonly revision:string;readonly kind:TaskKind;
 readonly status:OfflineJobStatus;readonly attempts:number;readonly maxAttempts:number;
 readonly leaseToken:string|null;readonly leaseUntil:string|null;
 readonly updatedAt:string;readonly appliedEvents:Readonly<Record<string,string>>;
 readonly lastFailure:string|null;readonly reviewDecisionRef:string|null;
 readonly canCallModel:false;readonly canPublish:false;readonly canSpend:false;
};
const marketCodes=["sa","ae","om","eg","iq"] as const;
const kinds=["research","enrich","localize","commercial_review","owner_approval","release_review"] as const;
const safeId=(v:string,max=200)=>typeof v==="string"&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u001f<>]/.test(v);
function timestamp(value:string):number{
 const t=Date.parse(value);
 if(!Number.isFinite(t))throw Error("Invalid event timestamp");
 return t;
}
function signature(e:OfflineEvent):string{
 switch(e.type){
  case "lease":return JSON.stringify([e.type,e.jobId,e.token,e.until]);
  case "complete":return JSON.stringify([e.type,e.jobId,e.token]);
  case "fail":return JSON.stringify([e.type,e.jobId,e.token,e.reason]);
  case "expire":return JSON.stringify([e.type,e.jobId]);
  case "review_accept":
  case "review_reject":return JSON.stringify([e.type,e.jobId,e.revision,e.decisionRef]);
 }
}
export function createOfflineJob(market:MarketCode,sku:string,revision:string,kind:TaskKind,createdAt:string,maxAttempts=2):OfflineJob{
 if(!marketCodes.includes(market)||!safeId(sku)||!safeId(revision)||!kinds.includes(kind)||
 !Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3)throw Error("Invalid offline job identity");
 timestamp(createdAt);
 return {id:[market,encodeURIComponent(sku),encodeURIComponent(revision),kind].join(":"),
  market,sku,revision,kind,status:"queued",attempts:0,maxAttempts,leaseToken:null,leaseUntil:null,
  updatedAt:createdAt,appliedEvents:{},lastFailure:null,reviewDecisionRef:null,
  canCallModel:false,canPublish:false,canSpend:false};
}
/** Pure transition: persistence must atomically guard snapshot version and event ID. */
export function applyOfflineJobEvent(job:OfflineJob,event:OfflineEvent,at:string):OfflineJob{
 const now=timestamp(at);
 if(!safeId(event.id,120)||event.jobId!==job.id)throw Error("Invalid event identity");
 const sig=signature(event);
 if(Object.hasOwn(job.appliedEvents,event.id)){
  if(job.appliedEvents[event.id]!==sig)throw Error("Event ID reused for different payload");
  return job;
 }
 if(now<timestamp(job.updatedAt))throw Error("Out of order event timestamp");
 if(Object.keys(job.appliedEvents).length>=1000)throw Error("Offline event journal limit reached");
 let next:OfflineJob;
 if(event.type==="lease"){
  const end=timestamp(event.until);
  if(job.status!=="queued"||job.attempts>=job.maxAttempts||!safeId(event.token,180)||
   end<=now||end-now>10*60*1000)throw Error("Lease denied");
  next={...job,status:"leased",attempts:job.attempts+1,leaseToken:event.token,leaseUntil:event.until,lastFailure:null};
 }else if(event.type==="complete"||event.type==="fail"){
  if(job.status!=="leased"||!safeId(event.token,180)||event.token!==job.leaseToken||
  job.leaseUntil===null||now>timestamp(job.leaseUntil))throw Error("Invalid or expired lease");
  if(event.type==="complete"){
   next={...job,status:"needs_review",leaseToken:null,leaseUntil:null};
  }else{
   if(!safeId(event.reason,280))throw Error("Invalid failure code");
   next={...job,status:job.attempts<job.maxAttempts?"queued":"dead_letter",
    lastFailure:event.reason,leaseToken:null,leaseUntil:null};
  }
 }else if(event.type==="expire"){
  if(job.status!=="leased"||!job.leaseUntil||now<timestamp(job.leaseUntil))throw Error("Lease has not expired");
  next={...job,status:job.attempts<job.maxAttempts?"queued":"dead_letter",
   lastFailure:"lease_expired",leaseToken:null,leaseUntil:null};
 }else{
  if(job.status!=="needs_review"||event.revision!==job.revision||!safeId(event.decisionRef,180))
   throw Error("Invalid review decision");
  // Review acceptance is a local simulation, never an authenticated release approval.
  next={...job,status:event.type==="review_accept"?"review_accepted":"rejected",
   reviewDecisionRef:event.decisionRef};
 }
 return {...next,updatedAt:at,appliedEvents:{...job.appliedEvents,[event.id]:sig}};
}
export function replayOfflineJob(initial:OfflineJob,entries:readonly {event:OfflineEvent;at:string}[]):OfflineJob{
 if(entries.length>1000)throw Error("Event replay too large");
 return entries.reduce((state,item)=>applyOfflineJobEvent(state,item.event,item.at),initial);
}
