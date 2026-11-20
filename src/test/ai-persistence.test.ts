import {expect,it,vi} from "vitest";
import {aiContentPersistence} from "../lib/store/ai-persistence.server";
const job="e2c54db1-c527-47d4-b729-27b6d564b2e0";
const listing="bead1a6b-d20b-4cbc-bd82-abd7e404f85c";
it("reserves amount as bigint-safe decimal string and claims job",async()=>{
 const rpc=vi.fn(async(name:string)=>name==="reserve_ai_job"?job:true);
 const p=aiContentPersistence(rpc);
 expect(await p.reserve({market:"sa",task:"localized_content",dedupeKey:"fixture",estimateMicrousd:100n})).toMatchObject({id:job,reservedMicrousd:100n});
 expect(rpc).toHaveBeenCalledWith("reserve_ai_job",{p_store:"sa",p_task:"localized_content",p_key:"fixture",p_estimate:"100"});
 expect(await p.claim(job,"sa")).toBe(true);
});
it("records approved IDs and never selects a provider or browser key",async()=>{
 const rpc=vi.fn(async()=>job);
 const p=aiContentPersistence(rpc);
 await p.complete({market:"sa",jobId:job,listingId:listing,actualMicrousd:50n,draft:{segments:[{text:"verified",factIds:["f"]}]},brief:{locale:"ar-SA",channel:"storefront",sourceRegistry:[{id:"f",source:"spec sheet"}]}});
 expect(rpc).toHaveBeenCalledWith("complete_localized_content_job",expect.objectContaining({p_store:"sa",p_actual:"50",p_listing:listing}));
});
it("rejects forged IDs and negative costs",async()=>{
 const rpc=vi.fn();
 const p=aiContentPersistence(rpc);
 await expect(p.claim("invalid","sa")).rejects.toThrow();
 await expect(p.fail({market:"sa",jobId:job,reason:"budget_overrun",actualMicrousd:-1n})).rejects.toThrow();
 expect(rpc).not.toHaveBeenCalled();
});
