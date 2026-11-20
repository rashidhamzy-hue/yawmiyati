import {it,expect,vi} from "vitest";
// @ts-ignore Standalone Worker
import {handle} from "../../workers/owner-preview/worker.mjs";
it("identifies failing owner membership transport",async()=>{
 const req=new Request("https://owner.example/api/candidates",{method:"POST",headers:{Origin:"https://owner.example",Authorization:"Bearer a.b.c"}});
 const res=await handle(req,{SUPABASE_PUBLISHABLE_KEY:"test"},vi.fn(async()=>{throw new TypeError("sensitive upstream detail")}));
 expect(res.status).toBe(502);expect(await res.json()).toEqual({error:"Staging request failed: owner-membership (network-or-runtime)"});
});
