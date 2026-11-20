import {expect,it,vi} from "vitest";
import {dashboardClient} from "../lib/store/dashboard-client";
it("retrieves only authenticated market-scoped readiness",async()=>{
 const send=vi.fn(async()=>Response.json([{woo_product_id:1,listing_id:null,listing_status:null,blockers:["not_shortlisted","market_release_disabled"]}]));
 const result=await dashboardClient("https://db.example","public",send).readiness("token","sa");
 expect(result[0].blockers).toContain("not_shortlisted");
 expect(JSON.parse(String(send.mock.calls[0][1]?.body))).toEqual({p_store:"sa"});
 expect(send.mock.calls[0][1]?.headers).toMatchObject({Authorization:"Bearer token"});
});
it("does not accept a malformed readiness result",async()=>{
 const client=dashboardClient("https://db.example","public",async()=>Response.json([{woo_product_id:1,blockers:"none"}]));
 await expect(client.readiness("token","sa")).rejects.toThrow("Invalid readiness response");
});
