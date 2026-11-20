import {describe,it,expect,vi} from "vitest";
import {fireEvent,render,screen} from "@testing-library/react";
import {READINESS_GATES,offlineReadiness,fiveMarketReadiness,parseLocalNotes,exportLocalReadinessNotes} from "../lib/store/simulation/offline-launch-readiness";
import {OfflineLaunchReadinessPanel} from "./m3a-readiness-panel";

const markets=["sa","ae","om","eg","iq"] as const;
describe("Milestone 3A: release gates fail closed",()=>{
 it("blocks every market and every launch-sensitive operation without external verification",()=>{
  const status=fiveMarketReadiness();
  expect(status.mode).toBe("OFFLINE_REVIEW_ONLY");
  expect(status.blockedGates).toBe(5*READINESS_GATES.length);
  expect(status.allFiveReady).toBe(false);
  expect(status.releaseAuthorization).toBe(false);
  for(const market of markets){
   const result=offlineReadiness(market);
   expect(result.blocked).toBe(true);
   expect(result.currency).toBe(status.countries.find(c=>c.market===market)?.currency);
   expect(result.blockedCount).toBe(READINESS_GATES.length);
   expect([result.canPublish,result.canCheckout,result.canDispatch,result.canSpend]).toEqual([false,false,false,false]);
   expect(result.gates.every(g=>g.verified===false)).toBe(true);
  }
 });
 it("owner notes can never be treated as evidence, even when all gates are reviewed",()=>{
  const notes=markets.flatMap(market=>READINESS_GATES.map(g=>({market,gate:g.id,note:"reviewed_offline" as const})));
  const report=fiveMarketReadiness(notes);
  expect(report.blockedGates).toBe(40);
  expect(report.verifiedEvidenceSources).toBe(0);
  expect(report.allFiveReady).toBe(false);
  expect(report.countries.every(c=>c.verifiedCount===0&&c.blocked)).toBe(true);
  expect(report.countries.every(c=>c.gates.every(g=>g.review==="reviewed_offline"&&!g.verified))).toBe(true);
 });
 it("rejects unknown countries, gates, statuses, duplicates and extraneous evidence/provenance",()=>{
  expect(()=>offlineReadiness("us" as "sa")).toThrow("invalid_market");
  expect(()=>parseLocalNotes([{market:"sa",gate:"supplier_contract",note:"approved"}])).toThrow();
  expect(()=>parseLocalNotes([{market:"sa",gate:"launch_now",note:"not_reviewed"}])).toThrow();
  expect(()=>parseLocalNotes([{market:"us",gate:"supplier_contract",note:"not_reviewed"}])).toThrow();
  expect(()=>parseLocalNotes([{market:"sa",gate:"supplier_contract",note:"reviewed_offline",verified:true}])).toThrow();
  const note={market:"sa",gate:"supplier_contract",note:"reviewed_offline"};
  expect(()=>parseLocalNotes([note,note])).toThrow("duplicate_local_review_note");
  expect(()=>parseLocalNotes("false")).toThrow();
  expect(()=>parseLocalNotes(Array(41).fill(note))).toThrow();
 });
 it("exports only country/gate/review enums, with no fake approval or real evidence",()=>{
  const exported=JSON.parse(exportLocalReadinessNotes([{market:"sa",gate:"supplier_contract",note:"reviewed_offline"}]));
  expect(exported.changesProduction).toBe(false);
  expect(exported.evidenceVerified).toBe(false);
  expect(exported.readiness.releaseAuthorization).toBe(false);
  expect(exported.readiness.blockedGates).toBe(40);
  expect(JSON.stringify(exported)).not.toContain("http");
 });
});
describe("Milestone 3A local-only readiness panel",()=>{
 it("keeps all gates red when changing review status or country",()=>{
  const {container}=render(<OfflineLaunchReadinessPanel/>);
  expect(screen.getByTestId("blocked-gates").textContent).toBe("40");
  expect(container.querySelectorAll("button")).toHaveLength(1);
  fireEvent.change(screen.getByRole("combobox",{name:"مراجعة supplier_contract"}),{target:{value:"reviewed_offline"}});
  expect(screen.getByText("بوابات هذا البلد غير المثبتة: 8 / 8")).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox",{name:"بلد فحص الجاهزية"}),{target:{value:"eg"}});
  expect(screen.getByRole("combobox",{name:"مراجعة supplier_contract"})).toHaveProperty("value","not_reviewed");
  fireEvent.change(screen.getByRole("combobox",{name:"بلد فحص الجاهزية"}),{target:{value:"sa"}});
  expect(screen.getByRole("combobox",{name:"مراجعة supplier_contract"})).toHaveProperty("value","reviewed_offline");
  fireEvent.click(screen.getByRole("button",{name:"تصدير تقرير محلي بدون معلومات شخصية"}));
  const report=JSON.parse((screen.getByTestId("readiness-export") as HTMLTextAreaElement).value);
  expect(report.notes).toHaveLength(1);
  expect(report.readiness.blocked).toBe(true);
  expect(report.readiness.countries).toHaveLength(5);
 });
 it("never performs a network request",()=>{
  const spy=vi.spyOn(globalThis,"fetch");
  try{
   render(<OfflineLaunchReadinessPanel/>);
   fireEvent.change(screen.getByRole("combobox",{name:"بلد فحص الجاهزية"}),{target:{value:"iq"}});
   fireEvent.click(screen.getByRole("button",{name:"تصدير تقرير محلي بدون معلومات شخصية"}));
   expect(spy).not.toHaveBeenCalled();
  }finally{spy.mockRestore();}
 });
});
