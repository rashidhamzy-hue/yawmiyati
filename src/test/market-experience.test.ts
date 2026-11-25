import {describe,expect,it} from "vitest";
import {marketExperience} from "../lib/store/market-experience";
import {markets} from "../lib/store/markets";
describe("country-specific editorial experience",()=>{
 it("defines precisely five distinct market narratives and valid local category slugs",()=>{
  const codes=Object.keys(markets);
  expect(Object.keys(marketExperience).sort()).toEqual(codes.sort());
  expect(new Set(codes.map(code=>marketExperience[code as keyof typeof marketExperience].heroStart))).toHaveProperty("size",5);
  expect(new Set(codes.map(code=>marketExperience[code as keyof typeof marketExperience].heroImage)).size).toBe(5);
  for(const market of codes){
   const cfg=marketExperience[market as keyof typeof marketExperience];
   expect(cfg.categoryOrder).toHaveLength(6);
   expect(new Set(cfg.categoryOrder).size).toBe(6);
   expect(cfg.categoryOrder.every(slug=>Object.hasOwn(cfg.categoryCaptions,slug))).toBe(true);
   expect(cfg.questions.every(q=>Boolean(q.question.trim())&&Boolean(q.answer.trim()))).toBe(true);
   for(const field of ["discoveryNote","beautyLinkLabel","homeLinkLabel","faqEyebrow","storyLinkLabel","storyBrowseLabel"] as const){expect(cfg[field].trim().length).toBeGreaterThan(3);}
  }
 });
 it("preserves established Saudi hero and localized other-market CTAs",()=>{
  expect(marketExperience.sa.heroStart).toBe("كل يوم يستحق");
  expect(marketExperience.sa.searchCta).toBe("دوّري على اللي يعجبك");
  expect(marketExperience.eg.searchCta).toContain("إيه");
  expect(marketExperience.iq.searchCta).toContain("شنو");
  expect(marketExperience.ae.discoverDescription).not.toBe(marketExperience.om.discoverDescription);
  expect(marketExperience.eg.beautyLinkLabel).toContain("اتفرّجي");
  expect(marketExperience.iq.storyBrowseLabel).toContain("چ");
  expect(marketExperience.ae.faqEyebrow).toContain("ج");
 });
 it("contains no invented shipping guarantees or payment brand promises",()=>{
  const text=JSON.stringify(marketExperience);
  for(const banned of ["تابي","تمارا","Apple Pay","مدى","توصيل مجاني","تاچر","تاجر"]){
   expect(text).not.toContain(banned);
  }
 });
});
