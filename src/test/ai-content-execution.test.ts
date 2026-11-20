import {it,expect,vi} from "vitest";
import {executeContentDraft} from "../lib/store/ai-content.server";
const input={market:"sa" as const,listingId:"fixture",dedupeKey:"fixture-v1",facts:[{id:"f",statement:"500 ml",source:"verified fixture",verified:true}],channel:"storefront" as const,estimateMicrousd:1000n};
function setup(){
 const reserve=vi.fn(async()=>({id:"j",market:"sa" as const,task:"localized_content" as const,dedupeKey:input.dedupeKey,reservedMicrousd:1000n}));
 const claim=vi.fn(async()=>true);
 const generate=vi.fn(async()=>({draft:{segments:[{text:"٥٠٠ مل",factIds:["f"]}]},actualMicrousd:500n}));
 const complete=vi.fn(async()=>{}),fail=vi.fn(async()=>{});
 return {reserve,claim,generate,complete,fail};
}
it("never invokes a provider without reservation and claim",async()=>{
 const deps=setup();deps.claim.mockResolvedValueOnce(false);
 await expect(executeContentDraft(input,deps)).rejects.toThrow("Job not claimable");
 expect(deps.generate).not.toHaveBeenCalled();
});
it("stores only a human-review draft",async()=>{
 const deps=setup();expect(await executeContentDraft(input,deps)).toEqual({jobId:"j",state:"needs_human_review"});
 expect(deps.complete).toHaveBeenCalledTimes(1);
});
it("records usage and rejects unsupported fact IDs or overrun",async()=>{
 const deps=setup();deps.generate.mockResolvedValueOnce({draft:{segments:[{text:"x",factIds:["unknown"]}]},actualMicrousd:500n});
 await expect(executeContentDraft(input,deps)).rejects.toThrow();expect(deps.fail).toHaveBeenCalledWith(expect.objectContaining({actualMicrousd:500n}));
 const other=setup();other.generate.mockResolvedValueOnce({draft:{segments:[]},actualMicrousd:1001n});
 await expect(executeContentDraft(input,other)).rejects.toThrow("Provider exceeded reservation");expect(other.complete).not.toHaveBeenCalled();
});
