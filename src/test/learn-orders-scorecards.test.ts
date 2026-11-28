import {describe,expect,it} from "vitest";
import {MARKETS} from "../../supabase/functions/_shared/brain/markets.ts";
import {fetchWooOrders,lifecycleOf,normalizePhone,normalizeWooOrder,phoneHash,reasonBucket} from "../../supabase/functions/_shared/learn/woo-orders.ts";
import {FIXTURE_WOO_ORDERS} from "../../supabase/functions/_shared/learn/fixtures/woo-orders.ts";
import {EMPTY_COUNTS,productRates,productVerdict,sourceRates} from "../../supabase/functions/_shared/learn/scorecard.ts";
import {fetchDayFunnel,impressionsQuery,productFunnelQuery,sourceFunnelQuery} from "../../supabase/functions/_shared/learn/posthog.ts";

const sa=MARKETS.sa,KEY="test-key-not-a-secret";

describe("order lifecycle from WooCommerce",()=>{
 it("maps Woo's own statuses exactly and the plugin's custom ones by keyword, keeping unknown as unknown",()=>{
  expect(["pending","on-hold","processing"].map(lifecycleOf)).toEqual(["placed","placed","placed"]);
  expect(lifecycleOf("completed")).toBe("delivered");expect(lifecycleOf("refunded")).toBe("returned");
  expect(lifecycleOf("wc-confirmed")).toBe("confirmed");expect(lifecycleOf("out-for-delivery")).toBe("shipped");expect(lifecycleOf("wc-refused")).toBe("refused");
  expect(lifecycleOf("customer-no-answer")).toBe("unreachable");expect(lifecycleOf("تم التوصيل")).toBe("delivered");expect(lifecycleOf("مرتجع")).toBe("returned");
  expect(lifecycleOf("delivery-failed")).not.toBe("delivered");
  expect(lifecycleOf("wc-mystery-state")).toBe("unknown");
  expect(reasonBucket("السعر غالي")).toBe("price");expect(reasonBucket("Customer not answering")).toBe("other");expect(reasonBucket("no answer after 3 calls")).toBe("unreachable");
  expect(reasonBucket("العميل لا يريد المنتج")).toBe("changed_mind");expect(reasonBucket("")).toBeNull();
 });
 it("normalises phones per market and hashes them with a key, one way",async()=>{
  expect(normalizePhone("0501234567","+966")).toBe("966501234567");expect(normalizePhone("+966 50 123 4567","+966")).toBe("966501234567");
  expect(normalizePhone("00966501234567","+966")).toBe("966501234567");expect(normalizePhone("٠٥٠١٢٣٤٥٦٧","+966")).toBe("966501234567");
  expect(normalizePhone("123","+966")).toBeNull();expect(normalizePhone("","+966")).toBeNull();
  const a=await phoneHash("966501234567",KEY),b=await phoneHash("966501234567","another-key");
  expect(a).toMatch(/^[0-9a-f]{64}$/);expect(a).not.toBe(b);expect(a).toBe(await phoneHash("966501234567",KEY));expect(a).not.toContain("501234567");
 });
 it("keeps the order, never the person",async()=>{
  const rows=(await Promise.all(FIXTURE_WOO_ORDERS.map(o=>normalizeWooOrder(o,sa,"+966",KEY)))).filter(Boolean);
  expect(rows).toHaveLength(7); // the AED order is not a Saudi order
  expect(rows.map(r=>r!.status)).toEqual(["placed","confirmed","delivered","refused","cancelled","returned","unknown"]);
  const delivered=rows[2]!;
  expect(delivered).toMatchObject({woo_order_id:3,order_number:"1003",total_minor:29600,delivery_minor:2800,items:[{sku:"FIX-SKU-1",quantity:2,total_minor:26800}],
   source:{source:"facebook",medium:"paid",campaign:"fixture"},placed_at:"2026-11-27T08:00:00.000Z"});
  expect(rows[3]).toMatchObject({reason:"السعر غالي",reason_bucket:"price"});
  expect(rows[4]).toMatchObject({reason:"Customer not answering",status:"cancelled"});
  // Same customer on three orders: one stable hash; a different number: a different hash.
  expect(rows[3]!.phone_hash).toBe(rows[5]!.phone_hash);expect(rows[3]!.phone_hash).not.toBe(rows[0]!.phone_hash);
  const text=JSON.stringify(rows);
  expect(text).not.toMatch(/Fixture|street|example\.invalid|0501234567|966501234567/);
  expect((await normalizeWooOrder(FIXTURE_WOO_ORDERS[0],sa,"+966",null))!.phone_hash).toBeNull();
 });
 it("reads orders changed since a date, page by page, over https only",async()=>{
  const seen:string[]=[];
  const f=(async(u:URL|string,init?:RequestInit)=>{const url=new URL(String(u));seen.push(url.search);expect(String((init?.headers as Record<string,string>).authorization)).toMatch(/^Basic /);
   const page=Number(url.searchParams.get("page"));return Response.json(page===1?Array.from({length:100},(_,i)=>({id:i+1})):[{id:101}],{headers:{"x-wp-totalpages":"2"}});}) as unknown as typeof fetch;
  const r=await fetchWooOrders({origin:"https://sa-ops.yawmiyati.shop",key:"ck",secret:"cs"},"2026-11-27T00:00:00Z",f);
  expect(r.orders).toHaveLength(101);expect(r.complete).toBe(true);
  expect(seen[0]).toContain("modified_after=2026-11-27T00%3A00%3A00Z");expect(seen[0]).toContain("orderby=modified");
  await expect(fetchWooOrders({origin:"http://sa-ops.yawmiyati.shop",key:"ck",secret:"cs"},"2026-11-27T00:00:00Z",f)).rejects.toThrow("woo_origin_must_be_https");
  const one=(async()=>Response.json(Array.from({length:100},(_,i)=>({id:i})),{headers:{"x-wp-totalpages":"9"}})) as unknown as typeof fetch;
  expect((await fetchWooOrders({origin:"https://x.shop",key:"k",secret:"s"},"2026-11-27T00:00:00Z",one,2)).complete).toBe(false);
 });
});

describe("scorecards",()=>{
 const c=(over:Partial<typeof EMPTY_COUNTS>)=>({...EMPTY_COUNTS,...over});
 const ctx={planningDeliveryBps:3200,marginPct:30,doorTotalMinor:10700,cheapestMinor:11900,medianMinor:12900};
 it("turns counts into rates, with delivery judged on finished orders only",()=>{
  const r=productRates(c({list_impressions:2000,list_clicks:90,views:400,add_to_cart:30,orders:10,confirmed:1,shipped:2,delivered:3,refused:2,unreachable:2,profit_delivered_minor:9000,refusal_reasons:{price:2,unreachable:2,other:1}}),sa);
  expect(r).toMatchObject({ctr_pct:4.5,add_to_cart_pct:7.5,order_pct:2.5,confirmation_pct:80,delivery_pct:42.9,closed_orders:7,profit_per_delivered_usd:8,top_refusal_reason:"price"});
  expect(productRates(EMPTY_COUNTS,sa)).toMatchObject({ctr_pct:null,delivery_pct:null,profit_per_delivered_usd:null});
 });
 it("says what to do with a product and why",()=>{
  expect(productVerdict(c({views:40}),sa,ctx).verdict).toBe("not_enough_data");
  expect(productVerdict(c({views:400,add_to_cart:24,list_impressions:1000,list_clicks:40,orders:6,delivered:2}),sa,ctx)).toMatchObject({verdict:"push_in_ads"});
  expect(productVerdict(c({views:400,add_to_cart:24,list_impressions:1000,list_clicks:40}),sa,{...ctx,marginPct:16}).verdict).toBe("watch");
  expect(productVerdict(c({views:400,add_to_cart:2}),sa,ctx).verdict).toBe("retire");
  expect(productVerdict(c({views:400,add_to_cart:2}),sa,{...ctx,doorTotalMinor:13900}).verdict).toBe("price_blocks_sales");
  expect(productVerdict(c({views:600,add_to_cart:40,orders:1}),sa,{...ctx,doorTotalMinor:13900})).toMatchObject({verdict:"price_blocks_sales"});
  const bad=productVerdict(c({views:900,add_to_cart:80,orders:12,delivered:1,refused:6,unreachable:3,refusal_reasons:{refused_at_door:6}}),sa,ctx);
  expect(bad.verdict).toBe("pause_high_refusal");expect(bad.why).toMatch(/10% of 10 finished orders/);expect(bad.why).toMatch(/refused at door/);
 });
 it("judges a traffic source by delivered profit",()=>{
  expect(sourceRates({visits:500,product_views:380,add_to_cart:28,checkout_starts:9,orders:10,delivered:3,profit_delivered_minor:9000},sa)).toEqual({order_pct:2,delivered_pct:30,delivered_profit_usd:24,profit_per_visit_usd:0.048});
 });
});

describe("PostHog aggregates",()=>{
 it("asks for counts per product and per source only, for one market and one day",()=>{
  const q=[productFunnelQuery("sa","2026-11-27"),impressionsQuery("sa","2026-11-27"),sourceFunnelQuery("sa","2026-11-27")].join("\n");
  expect(q).toMatch(/properties\.market = 'sa'/);expect(q).toMatch(/toDateTime\('2026-11-27 00:00:00'\)/);expect(q).toMatch(/toDateTime\('2026-11-28 00:00:00'\)/);
  expect(q).not.toMatch(/distinct_id|person_id|\$ip|email|phone/);
  expect(()=>productFunnelQuery("sa","2026-11-27'; drop")).toThrow("invalid_day");
 });
 it("merges the answers and drops anything malformed",async()=>{
  const f=(async(_u:URL|string,init?:RequestInit)=>{const q=JSON.parse(String(init?.body)).query.query as string;
   expect(String((init?.headers as Record<string,string>).authorization)).toBe("Bearer phx_test");
   if(q.includes("products_seen"))return Response.json({columns:["slug","list_impressions"],results:[["milk-frother-1",2000],["<script>",5]]});
   if(q.includes("search_no_results"))return Response.json({columns:["query","searches"],results:[["مكواة بخار",7],["x",3]]});
   if(q.includes("ym_last_source"))return Response.json({columns:["source","medium","campaign","visits","product_views","add_to_cart","checkout_starts"],results:[["facebook","paid","launch",500,380,28,9],["direct","","",0,0,0,0]]});
   return Response.json({columns:["slug","views","add_to_cart","list_clicks","scroll_75"],results:[["milk-frother-1",400,30,90,120],[null,3,0,0,0],["Bad Slug",1,0,0,0]]});}) as unknown as typeof fetch;
  const d=await fetchDayFunnel({host:"https://us.posthog.com",projectId:"769490",apiKey:"phx_test"},"sa","2026-11-27",f);
  expect(d.products).toEqual([{slug:"milk-frother-1",views:400,add_to_cart:30,list_clicks:90,scroll_75:120,list_impressions:2000}]);
  expect(d.sources).toEqual([{source:"facebook",medium:"paid",campaign:"launch",visits:500,product_views:380,add_to_cart:28,checkout_starts:9}]);
  expect(d.empty_searches).toEqual([{query:"مكواة بخار",searches:7}]);
  await expect(fetchDayFunnel({host:"http://us.posthog.com",projectId:"1",apiKey:"k"},"sa","2026-11-27",f)).rejects.toThrow("posthog_not_configured");
 });
});
