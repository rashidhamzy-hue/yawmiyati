import { describe,expect,it,vi } from "vitest";
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

describe("owner session renewal", () => {
  it("keeps the refresh token in memory and renews through the refresh grant only", async () => {
    const seen: { path: string; body: Record<string, unknown> }[] = [];
    const request = (async (url: URL | string, init?: RequestInit) => {
      const u = new URL(String(url));
      seen.push({ path: u.pathname + u.search, body: JSON.parse(String(init?.body)) });
      return Response.json({ access_token: "a" + seen.length, refresh_token: "r" + seen.length, expires_in: 3600 });
    }) as typeof fetch;
    const c = dashboardClient("https://x.supabase.co", "pk", request);
    const s = await c.signInSession("o@example.com", "pw");
    expect(s).toEqual({ access: "a1", refresh: "r1", expiresIn: 3600 });
    const n = await c.refreshSession(s.refresh!);
    expect(n.access).toBe("a2");
    expect(seen[1]).toEqual({ path: "/auth/v1/token?grant_type=refresh_token", body: { refresh_token: "r1" } });
    await expect(c.refreshSession("")).rejects.toThrow("Authentication failed");
  });
});
