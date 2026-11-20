import {describe,it,expect} from "vitest";
import {img} from "../lib/store/images";

const editorial=["hero","cat-home","cat-kitchen","cat-beauty","cat-fashion","cat-wellness","cat-organize"] as const;
describe("portable licensed editorial media",()=>{
 it("uses a secure CDN for every editorial image without Lovable-only routes",()=>{
  for(const key of editorial){
   const source=new URL(img[key]);
   expect(source.protocol).toBe("https:");
   expect(source.hostname).toBe("images.unsplash.com");
   expect(source.pathname).toMatch(/^\/photo-\d+/);
   expect(source.searchParams.has("w")).toBe(true);
   expect(source.searchParams.has("q")).toBe(true);
  }
 });
 it("keeps editorial sources distinct and does not replace product identity with stock photos",()=>{
  expect(new Set(editorial.map(k=>img[k])).size).toBe(editorial.length);
  expect(img.p1).not.toContain("images.unsplash.com");
  expect(img.p1).toContain("/__l5e/");
 });
});
