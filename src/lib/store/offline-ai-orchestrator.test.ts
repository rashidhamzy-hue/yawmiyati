import {describe,it,expect} from "vitest";
import {planProductTasks,evaluateTaskPlan,mayExecutePaidTask} from "./offline-ai-orchestrator";
describe("offline AI orchestration",()=>{
 it("builds ordered owner-gated tasks",()=>{
  const tasks=planProductTasks("iq","SKU/123");
  expect(tasks).toHaveLength(6);
  expect(tasks[0].dependsOn).toHaveLength(0);
  expect(tasks[5].kind).toBe("release_review");
  expect(evaluateTaskPlan(tasks,new Set(),new Set())[0].state).toBe("ready");
  expect(evaluateTaskPlan(tasks,new Set(),new Set())[1].state).toBe("pending");
 });
 it("unblocks only completed dependencies",()=>{
  const tasks=planProductTasks("sa","A");
  const outcomes=evaluateTaskPlan(tasks,new Set([tasks[0].id]),new Set());
  expect(outcomes[1].state).toBe("ready");
  expect(outcomes[2].state).toBe("pending");
 });
 it("propagates failure without running downstream",()=>{
  const tasks=planProductTasks("eg","A");
  const outcomes=evaluateTaskPlan(tasks,new Set(),new Set([tasks[0].id]));
  expect(outcomes[1].state).toBe("blocked");
  expect(outcomes[5].state).toBe("blocked");
 });
 it("rejects cycles and duplicate IDs",()=>{
  const tasks=planProductTasks("sa","A");
  expect(()=>evaluateTaskPlan([tasks[0],tasks[0]],new Set(),new Set())).toThrow();
  expect(()=>evaluateTaskPlan([{...tasks[0],dependsOn:[tasks[0].id]}],new Set(),new Set())).toThrow();
 });
 it("paid work needs approval, enabled policy and sufficient budget",()=>{
  const p={enabled:true,ownerApproved:true,budgetMicrousd:100n,reservedMicrousd:50n,estimatedMicrousd:40n};
  expect(mayExecutePaidTask(p)).toBe(true);
  expect(mayExecutePaidTask({...p,ownerApproved:false})).toBe(false);
  expect(mayExecutePaidTask({...p,estimatedMicrousd:60n})).toBe(false);
 });
});
