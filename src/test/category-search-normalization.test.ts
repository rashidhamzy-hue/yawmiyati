import {describe,it,expect} from "vitest";
import {normalizeSearch} from "../lib/store/smart-search";

describe("Arabic category search normalization",()=>{
 it.each([
  ["عناية","عِنَايَة"],
  ["إكسسوارات","اكسسوارات"],
  ["قهوة","قهوه"],
  ["المنزل والديكور","المنزل   والديكور"],
  ["شنطة","شنطه"],
 ])("normalizes equivalent Arabic input: %s", (expected,input)=>{
  expect(normalizeSearch(input)).toBe(normalizeSearch(expected));
 });
 it("keeps normalized matching insensitive to Arabic diacritics and tatweel",()=>{
  expect(normalizeSearch("مُنتَجــــات")).toBe(normalizeSearch("منتجات"));
 });
});
