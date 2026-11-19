import {it,expect,vi} from "vitest";
// @ts-ignore Standalone JavaScript Worker is deployed without a bundler.
import {handle,normalize} from "../../workers/sa-integration/worker.mjs";
const env={SUPABASE_PUBLISHABLE_KEY:"public-test",WOO_SA_CONSUMER_KEY:"test",WOO_SA_CONSUMER_SECRET:"test",WOO_SA_ORIGIN:"https://logwave.s6-tastewp.com"};
const sample={id:42,sku:"QA",name:"Sample",type:"simple",price:"188.00",stock_status:"instock",images:[{src:"https://example.com/item.jpg"}]};
const request=()=>new Request("https://private.example/sync",{method:"POST",headers:{Authorization:"Bearer test.test.test"}});
it("rejects unauthenticated invocation without upstream traffic",async()=>{
 const send=vi.fn();expect((await handle(new Request("https://private.example/sync",{method:"POST"}),env,send)).status).toBe(401);expect(send).not.toHaveBeenCalled();
});
it("does not call supplier when membership fails",async()=>{
 const send=vi.fn(async()=>new Response(null,{status:403}));expect((await handle(request(),env,send)).status).toBe(403);expect(send).toHaveBeenCalledTimes(1);
});
it("persists simple product observations without marking them sellable",async()=>{
 const send=vi.fn().mockResolvedValueOnce(Response.json({store_code:"sa"})).mockResolvedValueOnce(Response.json([sample])).mockResolvedValueOnce(Response.json(1));
 const res=await handle(request(),env,send);expect(res.status).toBe(200);expect(await res.json()).toEqual({received:1,staged:1,skipped:0,page:1});
 const saved=JSON.parse(send.mock.calls[2][1].body).p_rows[0];expect(saved.observed_price_minor).toBe(18800);expect(saved.observed_stock).toBe("unknown");expect(saved.supplier_snapshot.stock_status).toBe("instock");
 expect(saved.supplier_snapshot.images).toEqual(["https://example.com/item.jpg"]);expect(normalize({...sample,type:"variable"},new Date().toISOString())).toBeNull();
});
it("does not persist unsuccessful supplier responses",async()=>{
 const send=vi.fn().mockResolvedValueOnce(Response.json({store_code:"sa"})).mockResolvedValueOnce(new Response(null,{status:401}));
 expect((await handle(request(),env,send)).status).toBe(502);expect(send).toHaveBeenCalledTimes(2);
});
