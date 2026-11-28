import {describe,expect,it} from "vitest";
import {readdirSync} from "node:fs";
// @ts-expect-error plain script module
import {plan} from "../../scripts/staging-sql.mjs";

describe("staging SQL runner",()=>{
 it("wraps a migration in one transaction and records it",()=>{
  const p=plan("migration","20261130160000_kids_section.sql");
  expect(p.sql.startsWith("begin;")).toBe(true);
  expect(p.sql.trimEnd().endsWith("commit;")).toBe(true);
  expect(p.sql).toContain("values ('20261130160000', 'kids_section')");
  expect(p.check).toContain("20261130160000");
 });
 it("refuses anything that is not a migration or a rollback-only test",()=>{
  expect(()=>plan("migration","../../etc/passwd")).toThrow();
  expect(()=>plan("migration","x.sql")).toThrow();
  expect(()=>plan("test","../supabase/migrations/20261130160000_kids_section.sql")).toThrow();
  expect(()=>plan("test","evil-test.sql",()=>"begin;\ndelete from x;\ncommit;\nrollback;")).toThrow();
  expect(()=>plan("test","no-rollback-test.sql",()=>"begin;\nselect 1;")).toThrow();
  expect(()=>plan("migration","20261130160000_x.sql",()=>"begin;\nselect 1;\ncommit;")).toThrow();
  expect(()=>plan("other","a")).toThrow();
 });
 it("accepts every session 3 test file in docs",()=>{
  for(const f of ["order-tracking-scorecards-test.sql","daily-loop-test.sql","blacklist-order-quality-test.sql","whatsapp-assistant-test.sql","kids-section-test.sql"]){
   expect(readdirSync("docs")).toContain(f);
   expect(plan("test",f).sql).toContain("rollback;");
  }
 });
});
