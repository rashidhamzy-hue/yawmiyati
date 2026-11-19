import {it,expect,vi} from "vitest";
import {importProductPage,candidateSink} from "../lib/store/import-worker.server";
import {fetchPublicCatalog} from "../lib/store/public-catalog";
it("stages supplier page without publishing",async()=>{
 const read=vi.fn(async()=>new Response(JSON.stringify([{id:2,type:"simple",sku:"A",name:"Sample",price:"20"}])));
 const write=vi.fn(async()=>new Response(null,{status:204}));
 const result=await importProductPage({market:"sa",origin:"https://woo.example",consumerKey:"test",consumerSecret:"test"},1,candidateSink("https://db.example","test",write),read);
 expect(result.staged).toBe(1);expect(write).toHaveBeenCalledTimes(1);
});
it("reads only public catalog RPC",async()=>{
 const read=vi.fn(async()=>new Response("[]"));
 expect(await fetchPublicCatalog("https://db.example","public","sa",read)).toEqual([]);
 expect(read).toHaveBeenCalledTimes(1);
});
