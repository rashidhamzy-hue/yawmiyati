import {it,expect} from "vitest";
import {normalizeImportCandidate} from "../lib/store/import-candidates";
import {estimateContribution} from "../lib/store/pricing";
it("stages supplier observations without assuming supplier stock or cost",()=>{
 const row=normalizeImportCandidate("sa",{id:1,type:"simple",sku:"A",name:"Demo",price:"59.90",stock_status:"instock"},"2026-11-19T00:00:00Z");
 expect(row.observed_price_minor).toBe(5990);
 expect(row.observed_stock).toBe("unknown");
 expect(()=>normalizeImportCandidate("sa",{id:1,type:"variable",sku:"A"},"2026-11-19T00:00:00Z")).toThrow();
});
it("accounts for delivered and failed order economics",()=>{
 expect(estimateContribution({price:3000,deliveredCost:2000,failedCost:200,adCost:100,deliveryBps:7500})).toEqual({expectedContributionMinor:"600",positive:true});
 expect(estimateContribution({price:0,deliveredCost:1,failedCost:0,adCost:0,deliveryBps:1}).expectedContributionMinor).toBe("-1");
});
