import {it,expect,vi} from "vitest";
import {dashboardClient} from "../lib/store/dashboard-client";
it("loads candidates in selected market and preserves unknown prices",async()=>{
 const request=vi.fn(async (_url:URL|RequestInfo,_init?:RequestInit)=>request.mock.calls.length===1?Response.json([]):Response.json("2026-11-20T07:00:00Z"));
 const client=dashboardClient("https://db.example","public",request);
 await client.candidates("token","eg");
 expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({p_store:"eg",p_limit:100});
 await client.saveCandidate("token","eg",15,{supplier:null,delivery:0,other:null,price:1000,decision:"pending",expectedAt:null});
 expect(JSON.parse(String(request.mock.calls[1][1]?.body))).toEqual({p_store:"eg",p_product:15,p_supplier:null,p_delivery:0,p_other:null,p_price:1000,p_decision:"pending",p_expected_at:null});
 expect(request.mock.calls[1][1]?.headers).toMatchObject({apikey:"public",Authorization:"Bearer token"});
});
it("rejects invalid commercial updates before network call",async()=>{
 const request=vi.fn();
 const client=dashboardClient("https://db.example","public",request);
 await expect(client.saveCandidate("token","sa",1,{supplier:-1,delivery:null,other:null,price:null,decision:"pending"})).rejects.toThrow();
 expect(request).not.toHaveBeenCalled();
});
