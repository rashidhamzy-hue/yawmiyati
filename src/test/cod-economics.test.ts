import {expect,it} from "vitest";
import {evaluateCodEvidence} from "../lib/store/pricing";
const sample={price:10000,supplierCost:4000,outboundDelivery:1000,deliveredFees:500,returnCost:500,adCost:1000,deliveryBps:8000};
it("does not invent acquisition cost",()=>expect(evaluateCodEvidence({...sample,supplierCost:null})).toEqual({state:"incomplete",missing:["supplierCost"]}));
it("calculates downside, base and upside plus break-even",()=>{
 const r=evaluateCodEvidence(sample);
 expect(r.state).toBe("evaluated");
 if(r.state==="evaluated"){
 expect(r.scenarios.map(s=>s.expectedContributionMinor)).toEqual(["1700","2300","2900"]);
 expect(r.breakEvenDeliveryBps).toBe(4167);
 }
});
it("rejects invalid amounts and impossible probability",()=>{
 expect(()=>evaluateCodEvidence({...sample,price:0})).toThrow();
 expect(()=>evaluateCodEvidence({...sample,deliveryBps:10001})).toThrow();
 expect(()=>evaluateCodEvidence({...sample,adCost:-1})).toThrow();
});
it("identifies an unreachable break-even",()=>{
 const r=evaluateCodEvidence({...sample,price:5000});
 if(r.state==="evaluated")expect(r.breakEvenDeliveryBps).toBeNull();
});
