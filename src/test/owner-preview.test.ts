import {it,expect,vi} from "vitest";
// @ts-ignore Standalone Worker module
import {handle} from "../../workers/owner-preview/worker.mjs";
const env={SUPABASE_PUBLISHABLE_KEY:"test"};
function req(path:string,auth?:string,origin="https://owner.example"){return new Request("https://owner.example"+path,{method:"POST",headers:{Origin:origin,...(auth?{Authorization:auth}:{})}});}
it("requires same origin and authenticated owner for candidate reads",async()=>{
const send=vi.fn();expect((await handle(req("/api/candidates",undefined,"https://other.example"),env,send)).status).toBe(403);
expect((await handle(req("/api/candidates"),env,send)).status).toBe(401);expect(send).not.toHaveBeenCalled();
});
it("rejects nonmembers before invoking private binding",async()=>{
const sync=vi.fn();const send=vi.fn(async()=>new Response(null,{status:403}));expect((await handle(req("/api/candidates","Bearer a.b.c"),{...env,SA_INTEGRATION:{fetch:sync}},send)).status).toBe(401);expect(sync).not.toHaveBeenCalled();
});
it("retired supplier sync cannot invoke private Worker",async()=>{
const sync=vi.fn(),send=vi.fn();
const r=await handle(req("/api/sync","Bearer a.b.c"),{...env,SA_INTEGRATION:{fetch:sync}},send);
expect(r.status).toBe(410);
expect(sync).not.toHaveBeenCalled();
expect(send).not.toHaveBeenCalled();
});

it("restricts remote image origins and serves syntactically valid browser script",async()=>{
 const html=await handle(new Request("https://owner.example/"),env);
 expect(html.headers.get("Content-Security-Policy")).toContain("img-src 'none';");
 const script=await handle(new Request("https://owner.example/app.js"),env);
 const source=await script.text();
 expect(()=>new Function(source)).not.toThrow();
 expect(source).toContain('$("search").oninput=applyFilter');
});
