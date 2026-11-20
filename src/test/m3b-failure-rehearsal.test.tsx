import {describe,it,expect,vi} from "vitest";
import {fireEvent,render,screen} from "@testing-library/react";
import {FAILURE_SCENARIOS,runOfflineFailureMatrix} from "../lib/store/simulation/failure-rehearsal";
import {fiveMarketReadiness} from "../lib/store/simulation/offline-launch-readiness";
import {OfflineFailureRehearsalPanel} from "./m3b-failure-rehearsal-panel";

const all=["sa","ae","om","eg","iq"] as const;
describe("Milestone 3B controlled fault injection",()=>{
 it("detects all 7 offline failure modes in all 5 markets without release authorization",()=>{
  const report=runOfflineFailureMatrix();
  expect(report.mode).toBe("SIMULATION_ONLY");
  expect(report.synthetic).toBe(true);
  expect(report.scenariosPerMarket).toBe(7);
  expect(report.total).toBe(35);
  expect(report.detected).toBe(35);
  expect(report.allDetected).toBe(true);
  expect(report.productionReady).toBe(false);
  expect([report.mayPublish,report.mayDispatch,report.maySpend]).toEqual([false,false,false]);
  expect(report.outcomes.every(row=>row.caught&&row.synthetic&&row.networkCalls===0&&
   !row.paymentCollected&&!row.supplierAcknowledged&&!row.liveReleaseApproved)).toBe(true);
  for(const market of all){
   const outcomes=report.outcomes.filter(x=>x.market===market);
   expect(outcomes).toHaveLength(FAILURE_SCENARIOS.length);
   expect(outcomes.map(x=>x.scenario)).toEqual([...FAILURE_SCENARIOS]);
  }
  expect(fiveMarketReadiness().blockedGates).toBe(40);
 });
 it("reports identical stable outcomes when rerun and never grants real supplier proof",()=>{
  const first=runOfflineFailureMatrix(),second=runOfflineFailureMatrix();
  expect(second).toEqual(first);
  expect(JSON.stringify(first)).not.toMatch(/access_token|api_key|Bearer |@example\.|sk_live_/i);
  expect(first.outcomes.every(x=>x.evidence==="offline_injected_failure")).toBe(true);
 });
 it("runs all offline failure simulations without fetch or outbound communication",()=>{
  const spy=vi.spyOn(globalThis,"fetch");
  try {runOfflineFailureMatrix();expect(spy).not.toHaveBeenCalled();}
  finally{spy.mockRestore();}
 });
});
describe("Milestone 3B local owner fault panel",()=>{
 it("shows all scenarios for each country but never has an approval button",()=>{
  const {container}=render(<OfflineFailureRehearsalPanel/>);
  expect(screen.getByTestId("failure-count").textContent).toBe("35 / 35");
  expect(container.querySelectorAll("article")).toHaveLength(7);
  expect(screen.queryByRole("button",{name:/تفعيل|نشر|إطلاق|شراء/})).toBeNull();
  fireEvent.change(screen.getByRole("combobox",{name:"دولة اختبار الأعطال"}),{target:{value:"iq"}});
  expect(container.querySelectorAll("article")).toHaveLength(7);
  fireEvent.click(screen.getByRole("button",{name:"إظهار نتائج الأعطال للاختبارات فقط"}));
  const report=JSON.parse((screen.getByTestId("failure-matrix-export") as HTMLTextAreaElement).value);
  expect(report.total).toBe(35);
  expect(report.productionReady).toBe(false);
  expect(report.outcomes.some((x:{market:string})=>x.market==="iq")).toBe(true);
 });
});
