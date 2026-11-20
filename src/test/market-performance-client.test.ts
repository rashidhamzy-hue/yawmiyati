import {it,expect,vi} from "vitest";
import {dashboardClient} from "../lib/store/dashboard-client";
it("requests verified market reports with owner credentials",async()=>{
 const report={store:"sa",currency:"SAR",window_days:30,orders:{},ledger:{},marketing_observations:{},warnings:[]};
 const send=vi.fn(async()=>Response.json(report));
 const client=dashboardClient("https://db.example","public",send);
 expect((await client.performance("owner-token","sa")).store).toBe("sa");
 expect(JSON.parse(String(send.mock.calls[0][1]?.body))).toEqual({p_store:"sa",p_days:30});
 expect(send.mock.calls[0][1]?.headers).toMatchObject({Authorization:"Bearer owner-token"});
});
it("rejects bad windows before making any requests",async()=>{
 const send=vi.fn();
 const client=dashboardClient("https://db.example","public",send);
 await expect(client.performance("token","sa",366)).rejects.toThrow();
 expect(send).not.toHaveBeenCalled();
});
