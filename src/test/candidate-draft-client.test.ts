import {it,expect,vi} from "vitest";
import {dashboardClient} from "../lib/store/dashboard-client";
it("uses separate owner approval and draft creation endpoints",async()=>{
 const send=vi.fn(async (_url:URL|RequestInfo,_init?:RequestInit)=>Response.json("fixture-id"));
 const client=dashboardClient("https://db.example","public",send);
 const at="2026-11-19T12:00:00Z";
 await client.approveContent("token","sa",10,at,"Title","Description");
 await client.createDraft("token","sa",10,at,"fixture-id");
 expect(String(send.mock.calls[0][0])).toContain("/approve_candidate_content");
 expect(JSON.parse(String(send.mock.calls[1][1]?.body))).toEqual({p_store:"sa",p_product:10,p_review_at:at,p_revision:"fixture-id"});
});
