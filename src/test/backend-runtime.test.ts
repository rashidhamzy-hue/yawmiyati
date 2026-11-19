import {it,expect,vi} from "vitest";
// @ts-ignore Standalone Worker
import {handle} from "../../workers/owner-preview/worker.mjs";
// @ts-ignore Standalone Worker
import {handle as supplier} from "../../workers/sa-integration/worker.mjs";
it("identifies failing owner membership transport",async()=>{
 const req=new Request("https://owner.example/api/candidates",{method:"POST",headers:{Origin:"https://owner.example",Authorization:"Bearer a.b.c"}});
 const res=await handle(req,{SUPABASE_PUBLISHABLE_KEY:"test"},vi.fn(async()=>{throw new TypeError("sensitive upstream detail")}));
 expect(res.status).toBe(502);expect(await res.json()).toEqual({error:"Staging request failed: owner-membership (network-or-runtime)"});
});
it("identifies supplier transport failure without leaking secrets",async()=>{
 const req=new Request("https://private.example/sync",{method:"POST",headers:{Authorization:"Bearer a.b.c"}});
 const send=vi.fn().mockResolvedValueOnce(Response.json({store_code:"sa"})).mockRejectedValueOnce(new TypeError("sensitive"));
 const res=await supplier(req,{SUPABASE_PUBLISHABLE_KEY:"test",WOO_SA_CONSUMER_KEY:"test",WOO_SA_CONSUMER_SECRET:"test",WOO_SA_ORIGIN:"https://logwave.s6-tastewp.com"},send);
 expect(await res.json()).toEqual({error:"Supplier integration failed: woo-read (network-or-runtime)"});
});
