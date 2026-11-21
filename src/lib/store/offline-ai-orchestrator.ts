/**
 * M5C: pure offline AI task planner. No timers, network calls, database writes,
 * provider invocation, spend, or autonomous execution.
 */
import type {MarketCode} from "./markets";
export type TaskKind="research"|"enrich"|"localize"|"commercial_review"|"owner_approval"|"release_review";
export type PlannedTask={id:string;market:MarketCode;sku:string;kind:TaskKind;dependsOn:readonly string[];maxAttempts:number};
export type TaskState="pending"|"ready"|"blocked"|"complete"|"failed";
export type TaskOutcome={id:string;state:TaskState;reason:string|null};
export const sequence:readonly TaskKind[]=["research","enrich","localize","commercial_review","owner_approval","release_review"];
export function planProductTasks(market:MarketCode,sku:string):readonly PlannedTask[]{
 if(!["sa","ae","om","eg","iq"].includes(market)||!sku?.trim()||sku.length>200)throw Error("Invalid task identity");
 return sequence.map((kind,i)=>({id:`${market}:${encodeURIComponent(sku)}:${kind}`,market,sku,kind,
  dependsOn:i?[`${market}:${encodeURIComponent(sku)}:${sequence[i-1]}`]:[],maxAttempts:kind==="research"||kind==="enrich"||kind==="localize"?2:1}));
}
export function evaluateTaskPlan(tasks:readonly PlannedTask[],completed:ReadonlySet<string>,failed:ReadonlySet<string>):readonly TaskOutcome[]{
 if(tasks.length>10000)throw Error("Too many tasks");
 const ids=new Set(tasks.map(t=>t.id));
 if(ids.size!==tasks.length)throw Error("Duplicate task IDs");
 const states=new Map<string,TaskOutcome>();
 const visiting=new Set<string>();
 function visit(id:string):TaskOutcome{
  const cached=states.get(id);if(cached)return cached;
  if(visiting.has(id))throw Error("Task dependency cycle");
  const task=tasks.find(t=>t.id===id);if(!task)throw Error("Missing task dependency");
  visiting.add(id);
  const deps=task.dependsOn.map(visit);
  visiting.delete(id);
  const result:TaskOutcome=completed.has(id)?{id,state:"complete",reason:null}:
   failed.has(id)?{id,state:"failed",reason:"task_failed"}:
   deps.some(d=>d.state==="failed"||d.state==="blocked")?{id,state:"blocked",reason:"dependency_blocked"}:
   deps.every(d=>d.state==="complete")?{id,state:"ready",reason:null}:
   {id,state:"pending",reason:"waiting_for_dependency"};
  states.set(id,result);return result;
 }
 return tasks.map(t=>visit(t.id));
}
export type ExecutionPermit={readonly enabled:boolean;readonly budgetMicrousd:bigint;readonly reservedMicrousd:bigint;readonly estimatedMicrousd:bigint;readonly ownerApproved:boolean};
export function mayExecutePaidTask(p:ExecutionPermit):boolean{
 return p.enabled&&p.ownerApproved&&p.budgetMicrousd>0n&&p.reservedMicrousd>=0n&&
 p.estimatedMicrousd>0n&&p.reservedMicrousd+p.estimatedMicrousd<=p.budgetMicrousd;
}
// This predicate is advisory. Live execution additionally requires a transactional
// database budget reservation and explicit server-side authorization.
