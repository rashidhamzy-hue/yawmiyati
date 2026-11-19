import {it,expect,vi} from "vitest";
import {importMarket} from "../lib/store/market-import.server";
const config={market:"om" as const,origin:"https://woo.example",consumerKey:"fixture",consumerSecret:"fixture"};
const options={maxPages:2,asOf:"2026-11-19T00:00:00Z"};
const product={id:1,type:"simple",sku:"fixture",name:"Fixture",price:"1.234"};
it("isolates market and preserves OMR precision",async()=>{
 const read=vi.fn(async()=>Response.json([product,product]));
 const save=vi.fn(async()=>1);
 expect(await importMarket(config,options,save,read)).toEqual({market:"om",pages:1,received:2,staged:1,skipped:1,complete:true});
 expect(save).toHaveBeenCalledWith("om",[expect.objectContaining({store_code:"om",observed_price_minor:1234,observed_stock:"unknown"})]);
});
it("does not claim completion when page limit is reached",async()=>{
 const read=vi.fn(async()=>Response.json(Array.from({length:50},(_,i)=>({...product,id:i+1}))));
 const save=vi.fn(async()=>50);
 expect((await importMarket(config,{...options,maxPages:1},save,read)).complete).toBe(false);
});
it("rejects invalid persistence counts",async()=>{
 await expect(importMarket(config,options,async()=>2,async()=>Response.json([product]))).rejects.toThrow("Persistence count invalid");
});
