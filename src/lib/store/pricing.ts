// Expected contribution per submitted COD order, in local minor units.
export function estimateContribution(input:{price:number;deliveredCost:number;failedCost:number;adCost:number;deliveryBps:number}) {
 for(const n of Object.values(input)) if(!Number.isSafeInteger(n)||n<0) throw new Error("Invalid pricing input");
 if(input.deliveryBps>10000) throw new Error("Invalid delivery probability");
 const b=BigInt(input.deliveryBps);
 const weighted=b*(BigInt(input.price)-BigInt(input.deliveredCost))-(10000n-b)*BigInt(input.failedCost)-10000n*BigInt(input.adCost);
 // Round down, conservatively, including losses.
 const net=weighted>=0n?weighted/10000n:(weighted-9999n)/10000n;
 return {expectedContributionMinor:net.toString(),positive:weighted>0n};
}

export type CodEvidence = {
 price: number | null; supplierCost: number | null; outboundDelivery: number | null;
 deliveredFees: number | null; returnCost: number | null; adCost: number | null;
 deliveryBps: number | null;
};
// Assumes failedCost includes all unrecovered failed-order costs;
// deliveredFees includes tax/COD/packaging as applicable. Null never means zero.
export function evaluateCodEvidence(input: CodEvidence) {
 const keys = ["price","supplierCost","outboundDelivery","deliveredFees","returnCost","adCost","deliveryBps"] as const;
 const missing = keys.filter(k => input[k] === null);
 for(const k of keys) {
  const n = input[k];
  if(n !== null && (!Number.isSafeInteger(n) || n < 0 || (k === "deliveryBps" && n > 10000))) throw new Error("Invalid commercial evidence");
 }
 if(input.price === 0) throw new Error("Price must be positive");
 if(missing.length) return {state:"incomplete" as const, missing};
 const {price,supplierCost,outboundDelivery,deliveredFees,returnCost,adCost,deliveryBps}=input as Record<keyof CodEvidence,number>;
 const deliveredCost=supplierCost+outboundDelivery+deliveredFees;
 const failedCost=outboundDelivery+returnCost;
 if(!Number.isSafeInteger(deliveredCost)||!Number.isSafeInteger(failedCost))throw new Error("Cost overflow");
 const scenarios=[Math.max(0,deliveryBps-1000),deliveryBps,Math.min(10000,deliveryBps+1000)].map(bps=>({deliveryBps:bps,...estimateContribution({price,deliveredCost,failedCost,adCost,deliveryBps:bps})}));
 const upside=BigInt(price)-BigInt(deliveredCost)+BigInt(failedCost);
 const hurdle=(BigInt(failedCost)+BigInt(adCost))*10000n;
 const threshold=upside>0n?(hurdle+upside-1n)/upside:null;
 return {state:"evaluated" as const, scenarios, breakEvenDeliveryBps:threshold!==null&&threshold<=10000n?Number(threshold):null};
}
