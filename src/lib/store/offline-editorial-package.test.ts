import {describe,it,expect} from "vitest";
import {validateEditorialPackage} from "./offline-editorial-package";
const base={market:"eg" as const,sku:"SKU-1",revision:"rev1",proposals:[
 {field:"title" as const,segments:[{text:"منتج عملي للمنزل",factIds:["f1"]}]}
]};
describe("offline editorial package",()=>{
 it("requires human approval even for a valid localized draft",()=>{
  expect(validateEditorialPackage(base,["f1"])).toMatchObject({status:"needs_human_review",canPublish:false,canIndex:false,canAdvertise:false});
 });
 it("rejects upstream supplier language",()=>{
  const result=validateEditorialPackage({...base,proposals:[{field:"title" as const,segments:[{text:"بحسب المورد",factIds:["f1"]}]}]},["f1"]);
  expect(result.issues).toContain("unsafe_or_upstream_copy:title");
 });
 it("rejects unsupported claims and missing citations",()=>{
  expect(validateEditorialPackage({...base,proposals:[{field:"title" as const,segments:[{text:"Free shipping guaranteed",factIds:["f1"]}]}]},["f1"]).status).toBe("rejected");
  expect(validateEditorialPackage(base,["other"]).status).toBe("rejected");
 });
 it("rejects duplicate fields",()=>{
  expect(validateEditorialPackage({...base,proposals:[...base.proposals,...base.proposals]},["f1"]).issues).toContain("duplicate_or_unknown_field");
 });
});
