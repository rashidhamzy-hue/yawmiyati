import {describe,it,expect,vi} from "vitest";
import {dashboardClient} from "../lib/store/dashboard-client";
function item(id:number){return {listing_id:"uuid-"+id,slug:"product-"+id,title:"Product "+id,listing_status:"draft",variant_count:2,available_count:0};}
describe("M6A owner catalog RPC paging",()=>{
 it("loads successive 50-record pages with authenticated market and offset",async()=>{
  const send=vi.fn(async (_url:URL|RequestInfo,init?:RequestInit)=>{
   const payload=JSON.parse(String(init?.body)) as {p_store:string;p_limit:number;p_offset:number};
   return Response.json(Array.from({length:payload.p_offset===100?5:50},(_,i)=>item(payload.p_offset+i)));
  });
  const c=dashboardClient("https://db.example","public",send);
  const p1=await c.catalog("owner-jwt","iq",0);
  const p2=await c.catalog("owner-jwt","iq",50);
  const p3=await c.catalog("owner-jwt","iq",100);
  expect([p1.length,p2.length,p3.length]).toEqual([50,50,5]);
  expect(send.mock.calls.map(call=>JSON.parse(String(call[1]?.body)))).toEqual([
   {p_store:"iq",p_limit:50,p_offset:0},
   {p_store:"iq",p_limit:50,p_offset:50},
   {p_store:"iq",p_limit:50,p_offset:100}
  ]);
  expect(send.mock.calls.every(call=>(call[1]?.headers as Record<string,string>).Authorization==="Bearer owner-jwt")).toBe(true);
 });
 it("rejects invalid offset and malformed response without using it",async()=>{
  const send=vi.fn(async()=>Response.json([item(1)]));
  const c=dashboardClient("https://db.example","public",send);
  await expect(c.catalog("token","sa",-1)).rejects.toThrow("Invalid catalog offset");
  await expect(c.catalog("token","sa",100001)).rejects.toThrow("Invalid catalog offset");
  expect(send).not.toHaveBeenCalled();
  const bad=dashboardClient("https://db.example","public",async()=>Response.json([{...item(1),available_count:-1}]));
  await expect(bad.catalog("token","sa")).rejects.toThrow("Invalid catalog response");
  const many=dashboardClient("https://db.example","public",async()=>Response.json(Array.from({length:51},(_,i)=>item(i))));
  await expect(many.catalog("token","sa")).rejects.toThrow("Invalid catalog response");
 });
});