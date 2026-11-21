import {describe,it,expect,vi} from "vitest";
import {readFileSync} from "node:fs";
import {dashboardClient} from "../lib/store/dashboard-client";
const candidate={woo_product_id:321,supplier_sku:"SKU-321",title:"Imported candidate",observed_price_minor:null,
 source_stock_status:"unknown",observed_at:"2026-11-21T08:00:00Z",images:[],categories:[],review:null};
describe("M6C candidate and readiness pagination",()=>{
 it("retains first-page RPC compatibility, then pages in selected market",async()=>{
  const requests:{url:string;payload:unknown;authorization:string}[]=[];
  const send=vi.fn(async (url:URL|RequestInfo,init?:RequestInit)=>{
   requests.push({url:String(url),payload:JSON.parse(String(init?.body)),authorization:(init?.headers as Record<string,string>).Authorization});
   return Response.json(String(url).includes("readiness")?
    [{woo_product_id:321,listing_id:null,listing_status:null,blockers:["market_release_disabled"]}]:[candidate]);
  });
  const client=dashboardClient("https://db.example","public",send);
  await client.candidates("owner-jwt","eg");
  const paged=await client.candidates("owner-jwt","eg",100);
  const gates=await client.readiness("owner-jwt","eg",100);
  expect(paged[0].woo_product_id).toBe(321);
  expect(gates[0].blockers).toContain("market_release_disabled");
  expect(requests.map(r=>new URL(r.url).pathname)).toEqual([
   "/rest/v1/rpc/dashboard_candidate_review",
   "/rest/v1/rpc/dashboard_candidate_review_page",
   "/rest/v1/rpc/dashboard_catalog_readiness_page"
  ]);
  expect(requests[0].payload).toEqual({p_store:"eg",p_limit:100});
  expect(requests[1].payload).toEqual({p_store:"eg",p_limit:100,p_offset:100});
  expect(requests[2].payload).toEqual({p_store:"eg",p_limit:100,p_offset:100});
  expect(requests.every(r=>r.authorization==="Bearer owner-jwt")).toBe(true);
 });
 it("refuses invalid page offsets and malformed candidate replies",async()=>{
  const send=vi.fn(async()=>Response.json([candidate]));
  const client=dashboardClient("https://db.example","public",send);
  await expect(client.candidates("jwt","sa",-1)).rejects.toThrow("Invalid candidate offset");
  await expect(client.readiness("jwt","sa",100001)).rejects.toThrow("Invalid readiness offset");
  expect(send).not.toHaveBeenCalled();
  const invalid=dashboardClient("https://db.example","public",async()=>Response.json([{...candidate,woo_product_id:0}]));
  await expect(invalid.candidates("jwt","sa")).rejects.toThrow("Invalid candidate response");
 });
 it("migration declares isolated authenticated access and bounded offset",()=>{
  const sql=readFileSync("supabase/migrations/20261121090000_candidate_review_page.sql","utf8");
  for(const name of ["dashboard_candidate_review_page","dashboard_catalog_readiness_page"]){
   expect(sql).toContain("public."+name);
   expect(sql).toContain("revoke all on function public."+name+"(text,integer,integer)");
   expect(sql).toContain("grant execute on function public."+name+"(text,integer,integer)");
  }
  expect(sql).toContain("m.user_id=auth.uid() and m.store_code=p_store");
  expect(sql).toContain("p_offset not between 0 and 100000");
  expect(sql).toContain("limit p_limit offset p_offset");
 });
});