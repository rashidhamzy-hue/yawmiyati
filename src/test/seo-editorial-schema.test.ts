import {describe,it,expect} from "vitest";
import {editorialSeoDraft,editorialSitemapDraft} from "../lib/store/seo-editorial-schema";
import {marketExperience} from "../lib/store/market-experience";
import {saudiHomeQuestions} from "../lib/store/saudi-commerce-content";
const origin="https://shop.example.com";
describe("editorial SEO payload preparation, never a release authorization",()=>{
 it.each(["sa","ae","om","eg","iq"] as const)("uses exact visible %s FAQ and reciprocal alternates",market=>{
  const d=editorialSeoDraft(origin,market);
  expect(d.releaseAuthorized).toBe(false);
  expect(d.proposedCanonical).toBe(origin+"/"+market);
  expect(d.proposedAlternates).toHaveLength(5);
  const faq=d.proposedSchema["@graph"].find(x=>x["@type"]==="FAQPage") as {mainEntity?:unknown[]}|undefined;
  const expected=market==="sa"?saudiHomeQuestions:marketExperience[market].questions;
  expect(faq?.mainEntity).toEqual(expected.map(q=>({"@type":"Question",name:q.question,acceptedAnswer:{"@type":"Answer",text:q.answer}})));
  const c=editorialSeoDraft(origin,market,"home");
  expect(c.proposedSchema["@graph"][0]["@type"]).toBe("BreadcrumbList");
  expect(c.proposedAlternates.every(a=>a.href.endsWith("/c/home"))).toBe(true);
 });
 it("limits sitemap draft to the 35 editorial routes",()=>{
  const d=editorialSitemapDraft(origin);
  expect(d.releaseAuthorized).toBe(false);
  expect(d.proposedUrls).toHaveLength(35);
  expect(new Set(d.proposedUrls).size).toBe(35);
  expect(d.proposedUrls.every(u=>!/(checkout|cart|search|\/p\/)/.test(u))).toBe(true);
 });
 it("rejects preview domains, invalid categories and non-HTTPS origins",()=>{
  for(const bad of ["http://shop.example.com","https://foo.lovable.app","https://shop.test","https://shop.example.com/path"])expect(()=>editorialSitemapDraft(bad)).toThrow();
  expect(()=>editorialSeoDraft(origin,"sa","../cart")).toThrow();
 });
});
