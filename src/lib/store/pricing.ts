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
