import {describe,it,expect} from "vitest";
import {editorialSchema,serializeEditorialSchema} from "../lib/store/editorial-schema";
import {marketExperience} from "../lib/store/market-experience";
import {saudiHomeQuestions} from "../lib/store/saudi-commerce-content";
import {SEO_EDITORIAL_SLUGS} from "../lib/store/seo-planning";
describe("editorial schema rendered on prelaunch pages",()=>{
 it.each(["sa","ae","om","eg","iq"] as const)("uses visible FAQ copy and excludes offers in %s",market=>{
  const schema=editorialSchema(market)!;
  const graph=(schema as {"@graph"?:Array<Record<string,unknown>>})["@graph"]!;
  expect(graph.map(x=>x["@type"])).toEqual(["Organization","WebSite","FAQPage"]);
  const expected=market==="sa"?saudiHomeQuestions:marketExperience[market].questions;
  expect(graph[2].mainEntity).toEqual(expected.map(q=>({"@type":"Question",name:q.question,acceptedAnswer:{"@type":"Answer",text:q.answer}})));
  expect(JSON.parse(serializeEditorialSchema(schema))).toEqual(schema);
  for(const slug of SEO_EDITORIAL_SLUGS){
   const c=editorialSchema(market,slug)!;
   expect(c["@type"]).toBe("BreadcrumbList");
   expect(JSON.stringify(c)).toContain("/"+market+"/c/"+slug);
  }
  expect(editorialSchema(market,"preview-product")).toBeNull();
 });
});
