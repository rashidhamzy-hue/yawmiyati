/**
 * Offline deterministic outbox emulator, explicitly not a persistent production
 * queue. Export/import snapshots test crash/replay recovery without real I/O.
 */
import {markets,type MarketCode} from "../markets";
import {SIMULATION_MODE} from "./fixtures";
type JobStatus="queued"|"leased"|"completed"|"dead_letter";
export type SimJob={
 readonly mode:typeof SIMULATION_MODE;readonly market:MarketCode;
 readonly id:string;readonly dedupeKey:string;readonly jobType:"catalog_sync"|"order_submit"|"status_poll"|"notify_owner";
 readonly status:JobStatus;readonly attempts:number;readonly dueAtMs:number;
 readonly leaseUntilMs:number|null;readonly payload:Readonly<Record<string,string|number|boolean>>;
};
export type SimOutboxSnapshot={readonly mode:typeof SIMULATION_MODE;readonly jobs:readonly SimJob[]};
const clone=(v:SimJob):SimJob=>({...v,payload:{...v.payload}});
export function createSimulatedOutbox(initial?:SimOutboxSnapshot){
 if(initial&&initial.mode!==SIMULATION_MODE)throw Error("invalid_simulation_snapshot");
 const jobs=new Map<string,SimJob>();
 const dedupe=new Map<string,string>();
 let seq=0;
 if(initial)for(const job of initial.jobs){
  if(job.mode!==SIMULATION_MODE||!Object.hasOwn(markets,job.market)||!job.id.startsWith("SIM-JOB-")||jobs.has(job.id))throw Error("invalid_simulation_snapshot");
  const k=job.market+":"+job.dedupeKey;
  if(dedupe.has(k))throw Error("duplicate_simulation_snapshot");
  jobs.set(job.id,clone(job));dedupe.set(k,job.id);
  const number=Number(job.id.slice(8));if(Number.isSafeInteger(number))seq=Math.max(seq,number);
 }
 function enqueue(input:{mode:typeof SIMULATION_MODE;market:MarketCode;jobType:SimJob["jobType"];dedupeKey:string;dueAtMs:number;payload:Readonly<Record<string,string|number|boolean>>}):SimJob{
  if(input.mode!==SIMULATION_MODE||!Object.hasOwn(markets,input.market))throw Error("simulation_only");
  if(!/^[a-zA-Z0-9_-]{5,100}$/.test(input.dedupeKey)||!Number.isSafeInteger(input.dueAtMs)||input.dueAtMs<0)throw Error("invalid_job");
  if(Object.entries(input.payload).some(([key,value])=>key.toLowerCase().includes("secret")||key.toLowerCase().includes("phone")||key.toLowerCase().includes("token")||typeof value==="string"&&value.length>300))throw Error("unsafe_simulation_payload");
  const id=dedupe.get(input.market+":"+input.dedupeKey);
  if(id){
   const existing=jobs.get(id)!;
   if(existing.jobType!==input.jobType||JSON.stringify(existing.payload)!==JSON.stringify(input.payload))throw Error("job_dedupe_conflict");
   return clone(existing);
  }
  const job:SimJob={mode:SIMULATION_MODE,market:input.market,id:"SIM-JOB-"+String(++seq).padStart(6,"0"),dedupeKey:input.dedupeKey,jobType:input.jobType,status:"queued",attempts:0,dueAtMs:input.dueAtMs,leaseUntilMs:null,payload:{...input.payload}};
  jobs.set(job.id,job);dedupe.set(input.market+":"+input.dedupeKey,job.id);return clone(job);
 }
 function lease(input:{mode:typeof SIMULATION_MODE;market:MarketCode;nowMs:number;leaseMs:number}):SimJob|null{
  if(input.mode!==SIMULATION_MODE||!Object.hasOwn(markets,input.market)||!Number.isSafeInteger(input.nowMs)||input.nowMs<0||!Number.isSafeInteger(input.leaseMs)||input.leaseMs<1)throw Error("invalid_lease");
  const job=[...jobs.values()].find(j=>j.market===input.market&&(j.status==="queued"&&j.dueAtMs<=input.nowMs||j.status==="leased"&&(j.leaseUntilMs??Infinity)<=input.nowMs));
  if(!job)return null;
  const next:SimJob={...job,status:"leased",attempts:job.attempts+1,leaseUntilMs:input.nowMs+input.leaseMs};
  if(!Number.isSafeInteger(next.leaseUntilMs))throw Error("lease_overflow");
  jobs.set(job.id,next);return clone(next);
 }
 function complete(input:{mode:typeof SIMULATION_MODE;market:MarketCode;id:string;expectedAttempt:number;success:boolean;nowMs:number}):SimJob{
  if(input.mode!==SIMULATION_MODE||!Number.isSafeInteger(input.nowMs)||input.nowMs<0)throw Error("simulation_only");
  const job=jobs.get(input.id);
  if(!job||job.market!==input.market)throw Error("job_not_found_or_cross_market");
  if(job.status==="completed"&&job.attempts===input.expectedAttempt&&input.success)return clone(job);
  if(job.status!=="leased"||job.attempts!==input.expectedAttempt||job.leaseUntilMs===null||input.nowMs>job.leaseUntilMs)throw Error("stale_lease");
  const status:JobStatus=input.success?"completed":job.attempts>=3?"dead_letter":"queued";
  const next:SimJob={...job,status,leaseUntilMs:null,dueAtMs:input.success?job.dueAtMs:input.nowMs+Math.min(60_000,1000*2**job.attempts)};
  jobs.set(job.id,next);return clone(next);
 }
 function snapshot():SimOutboxSnapshot{return {mode:SIMULATION_MODE,jobs:[...jobs.values()].map(clone)}}
 return Object.freeze({mode:SIMULATION_MODE,enqueue,lease,complete,snapshot});
}
