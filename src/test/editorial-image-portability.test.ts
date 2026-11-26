import {describe,it,expect} from "vitest";
import {img,editorialRemote} from "../lib/store/images";
import {editorialSrcSet} from "../lib/store/editorial-srcset";

const editorial=["hero","cat-home","cat-kitchen","cat-beauty","cat-fashion","cat-wellness","cat-organize"] as const;
describe("portable licensed editorial media",()=>{
 it("serves every editorial image from our own origin, with absolute originals for social previews",()=>{
  for(const key of editorial){
   expect(img[key]).toMatch(/^\/editorial\/[a-z-]+-\d+\.webp$/);
   const remote=new URL(editorialRemote[key]);
   expect(remote.hostname).toBe("images.unsplash.com");
  }
 });
 it("provides responsive srcsets with mobile and desktop renditions",()=>{
  const variants=editorialSrcSet(img.hero)!;
  expect(variants).toContain("360w");
  expect(variants).toContain("1600w");
  expect(variants).toContain("/editorial/hero-480.webp 480w");
  expect(variants).not.toContain("/__l5e/");
  expect(editorialSrcSet(img.p1)).toBeUndefined();
 });
 it("keeps editorial sources distinct and does not replace product identity with stock photos",()=>{
  expect(new Set(editorial.map(k=>img[k])).size).toBe(editorial.length);
  expect(img.p1).not.toContain("images.unsplash.com");
  expect(img.p1).not.toContain("/__l5e/");
  expect(img.p1).toMatch(/p1[^/]*\.jpg/);
 });
});
