import {it,expect} from "vitest";
import {scoreProduct,aiPreflight,marketingMetrics,contentBrief} from "../lib/store/intelligence";
it("does not score missing evidence as known",()=>{
 expect(scoreProduct({profit:90}).score).toBeNull();
 expect(scoreProduct({profit:80,demand:80,viral:80,pricing:80,stock:80,cod:80,audience:80}).score).toBe(80);
});
it("blocks disabled and over-budget work",()=>{
 expect(aiPreflight({enabled:false,dailyBudgetMicrousd:100n},0n,1n)).toBe(false);
 expect(aiPreflight({enabled:true,dailyBudgetMicrousd:100n},90n,11n)).toBe(false);
 expect(aiPreflight({enabled:true,dailyBudgetMicrousd:100n},90n,10n)).toBe(true);
});
it("uses delivered orders and handles empty denominators",()=>{
 expect(marketingMetrics({impressions:100,clicks:10,submitted:4,delivered:2,spendMinor:100}).costPerDeliveredMinor).toBe(50);
 expect(marketingMetrics({impressions:0,clicks:0,submitted:0,delivered:0,spendMinor:0}).deliveryRate).toBeNull();
});
it("requires evidence and localizes briefs",()=>{
 expect(()=>contentBrief("iq",[],"ad")).toThrow();
 expect(contentBrief("iq",[{id:"1",statement:"Verified size"}],"ad").locale).toBe("ar-IQ");
});
