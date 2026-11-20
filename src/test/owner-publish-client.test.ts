import {it,expect,vi} from "vitest";
import {dashboardClient} from "../lib/store/dashboard-client";
it("calls guarded publication RPC with exact market and listing",async()=>{
 const send=vi.fn(async()=>new Response(null,{status:204}));
 const c=dashboardClient("https://db.example","publishable",send);
 await c.publishDraft("owner-token","sa",8,"fixture-listing");
 expect(String(send.mock.calls[0][0])).toContain("/rpc/publish_candidate_draft");
 expect(JSON.parse(String(send.mock.calls[0][1]?.body))).toEqual({p_store:"sa",p_product:8,p_listing:"fixture-listing"});
 expect(send.mock.calls[0][1]?.headers).toMatchObject({Authorization:"Bearer owner-token",apikey:"publishable"});
});
it("never calls publication for invalid target",async()=>{
 const send=vi.fn();
 const c=dashboardClient("https://db.example","key",send);
 await expect(c.publishDraft("token","sa",0,"listing")).rejects.toThrow();
 expect(send).not.toHaveBeenCalled();
});
