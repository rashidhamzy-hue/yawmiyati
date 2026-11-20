import {describe,it,expect} from "vitest";
import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";

const repo=resolve(process.cwd());
const manifest=JSON.parse(readFileSync(resolve(repo,"docs/handoff/ENGINEERING-MANIFEST.json"),"utf8"));
const read=(path:string)=>readFileSync(resolve(repo,path),"utf8");
describe("M3C source-only engineering handoff",()=>{
 it("identifies all five correct currency precisions and non-live release flags",()=>{
  expect(manifest.schemaVersion).toBe(1);
  expect(manifest.project).toBe("Yawmiyati");
  expect(manifest.repo).toBe("tarikhtube-stack/saudi-store-spark");
  expect(manifest.markets).toEqual([
   {code:"sa",currency:"SAR",minorDigits:2},
   {code:"ae",currency:"AED",minorDigits:2},
   {code:"om",currency:"OMR",minorDigits:3},
   {code:"eg",currency:"EGP",minorDigits:2},
   {code:"iq",currency:"IQD",minorDigits:3},
  ]);
  expect(Object.values(manifest.releaseFlags).every(x=>x===false)).toBe(true);
 });
 it("references existing checked-in source and explicitly quarantines fictional catalog",()=>{
  expect(manifest.verifiedPaths.length).toBeGreaterThan(25);
  for(const path of manifest.verifiedPaths)expect(existsSync(resolve(repo,path))).toBe(true);
  expect(manifest.verifiedPaths).toContain("src/lib/store/catalog.ts");
  expect(read("docs/handoff/ENGINEERING-HANDOFF.md")).toContain("do not use as live catalog truth");
  expect(read("docs/handoff/CLAUDE-START-HERE.md")).toContain("SIMULATION_ONLY");
 });
 it("records non-operational status and real evidence/owner approval gaps",()=>{
  expect(manifest.blockers).toHaveLength(8);
  expect(manifest.blockers.every(x=>x.requiresApproval===true)).toBe(true);
  expect(manifest.milestones).toHaveLength(7);
  const handoff=read("docs/handoff/ENGINEERING-HANDOFF.md");
  expect(handoff).toContain("Egypt’s 60 EGP shipping value");
  expect(handoff).toContain("No Taager/Woo/other supplier connection");
  expect(handoff).toContain("NOT a new live audit");
  expect(read("docs/handoff/OPERATIONS-RUNBOOKS.md")).toContain("dead_letter");
 });
 it("checks that the CI gate and verification command stay in handoff",()=>{
  const workflow=read(".github/workflows/commerce-checks.yml");
  expect(workflow).toContain("node scripts/check-handoff-manifest.mjs");
  expect(workflow).toContain("node scripts/check-simulation-boundary.mjs");
  expect(manifest.commands).toContain("bun run test");
  expect(manifest.commands).toContain("node scripts/check-handoff-manifest.mjs");
 });
});
