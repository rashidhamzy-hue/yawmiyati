import {it,expect,vi} from "vitest";
// @ts-ignore Standalone Worker module
import {handle} from "../../workers/owner-preview/worker.mjs";
const env={SUPABASE_PUBLISHABLE_KEY:"test"};
function req(path:string,auth?:string,origin="https://owner.example"){return new Request("https://owner.example"+path,{method:"POST",headers:{Origin:origin,...(auth?{Authorization:auth}:{})}});}
it("requires same origin and authenticated owner for synchronization",async()=>{
const send=vi.fn();expect((await handle(req("/api/sync",undefined,"https://other.example"),env,send)).status).toBe(403);
expect((await handle(req("/api/sync"),env,send)).status).toBe(401);expect(send).not.toHaveBeenCalled();
});
it("rejects nonmembers before invoking private binding",async()=>{
const sync=vi.fn();const send=vi.fn(async()=>new Response(null,{status:403}));expect((await handle(req("/api/sync","Bearer a.b.c"),{...env,SA_INTEGRATION:{fetch:sync}},send)).status).toBe(401);expect(sync).not.toHaveBeenCalled();
});
it("forwards authorized sync only to the private service",async()=>{
const sync=vi.fn(async(r:Request)=>{expect(r.headers.get("Authorization")).toBe("Bearer a.b.c");return Response.json({received:9,staged:9,skipped:0});});
const send=vi.fn(async()=>Response.json({store_code:"sa"}));const r=await handle(req("/api/sync","Bearer a.b.c"),{...env,SA_INTEGRATION:{fetch:sync}},send);expect(r.status).toBe(200);expect((await r.json()).staged).toBe(9);
});
