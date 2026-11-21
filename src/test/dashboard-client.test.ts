import { expect,it,vi } from "vitest";
import { dashboardClient } from "../lib/store/dashboard-client";
it("uses only a publishable key and signed user token for dashboard calls",async()=>{
 const request=vi.fn(async (_url:URL|RequestInfo,_init?:RequestInit)=>Response.json(request.mock.calls.length===1?{access_token:"test-token"}:{store:"sa",currency:"SAR",orders:0,customers:0,recorded_net_minor:"0",order_statuses:{}}));
 const client=dashboardClient("https://example.supabase.co","public-test",request);
 expect(await client.signIn("owner@example.com","test-password")).toBe("test-token");
 await client.summary("test-token","sa");
 expect(request.mock.calls[1][1]?.headers).toMatchObject({apikey:"public-test",Authorization:"Bearer test-token"});
});
it("rejects unauthorized requests",async()=>{
 const client=dashboardClient("https://example.supabase.co","public-test",async()=>new Response("{}",{status:403}));
 await expect(client.summary("invalid","sa")).rejects.toThrow("Access denied");
});
