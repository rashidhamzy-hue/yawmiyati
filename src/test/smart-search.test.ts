import {expect,it} from "vitest";
import {normalizeSearch,smartCatalogSearch,suggestEditorialCategories} from "../lib/store/smart-search";
const products=[
 {listing_id:"1",title:"دلة قهوة عربية",slug:"dallah",price_minor:"15000",currency:"SAR"},
 {listing_id:"2",title:"كريم العناية بالبشرة",slug:"cream",price_minor:"7900",currency:"SAR"},
 {listing_id:"3",title:"حقيبة نسائية",slug:"bag",price_minor:"9900",currency:"SAR"},
 {listing_id:"4",title:"منظم أدراج للمطبخ",slug:"drawer",price_minor:"4900",currency:"SAR"}
];
it("normalizes Saudi Arabic spelling and diacritics",()=>{
 expect(normalizeSearch("إِنْتِظَار القَهْوَة")).toBe("انتظار القهوه");
 expect(normalizeSearch("عِناية")).toBe("عنايه");
});
it("searches typo-tolerantly with synonyms and preserves approved-only input",()=>{
 expect(smartCatalogSearch("قهوه",products)[0].slug).toBe("dallah");
 expect(smartCatalogSearch("قهوة",products)[0].slug).toBe("dallah");
 expect(smartCatalogSearch("دله",products)[0].slug).toBe("dallah");
 expect(smartCatalogSearch("حقيبه",products)[0].slug).toBe("bag");
 expect(smartCatalogSearch("بشره",products)[0].slug).toBe("cream");
 expect(smartCatalogSearch("nonexistent-thing",products)).toEqual([]);
 expect(smartCatalogSearch("قهوة",[])).toEqual([]);
});
it("suggests editorial categories without claiming they contain products",()=>{
 expect(suggestEditorialCategories("قهوه").map(x=>x.slug)).toContain("kitchen");
 expect(suggestEditorialCategories("تخزين").map(x=>x.slug)).toContain("organize");
 expect(suggestEditorialCategories("")).toHaveLength(6);
});
it("is bounded and deterministic",()=>{
 expect(smartCatalogSearch("",products,2)).toHaveLength(2);
 expect(()=>smartCatalogSearch("coffee",products,101)).toThrow();
});
