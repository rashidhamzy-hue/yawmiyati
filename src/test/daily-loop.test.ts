import {describe,expect,it} from "vitest";
import type {Db} from "../../supabase/functions/_shared/brain/db.ts";
import {MARKETS} from "../../supabase/functions/_shared/brain/markets.ts";
import {runDaily} from "../../supabase/functions/_shared/learn/daily.ts";
import {FIXTURE_WOO_ORDERS} from "../../supabase/functions/_shared/learn/fixtures/woo-orders.ts";
import {EMPTY_COUNTS} from "../../supabase/functions/_shared/learn/scorecard.ts";
import {buildBrief} from "../../supabase/functions/_shared/learn/brief.ts";
import {SEASONS,seasonalPlans,seasonCalendar} from "../../supabase/functions/_shared/learn/seasonal.ts";
import {fixturesAllowed} from "../../supabase/functions/_shared/learn/fixtures/flag.ts";
import {audienceDefinitions} from "../../supabase/functions/_shared/learn/audiences.ts";

const NOW=Date.parse("2026-11-28T03:20:00Z");
const listing=(id:string,sku:string,over:Record<string,unknown>={})=>({listing_id:id,sku,slug:sku.toLowerCase(),title:"منتج "+sku,category:"kitchen",image:null,price_minor:7900,hidden_reason:null,cost_minor:4500,floor_minor:7900,pricing:{},has_video:false,synced_at:"2026-11-27T20:00:00Z",...over});
const win=(l:ReturnType<typeof listing>,counts:Partial<typeof EMPTY_COUNTS>={},over:Record<string,unknown>={})=>({listing_id:l.listing_id,slug:l.slug,title:l.title,visible:l.hidden_reason===null,hidden_reason:l.hidden_reason,price_minor:l.price_minor,cost_minor:l.cost_minor,floor_minor:l.floor_minor,cheapest_minor:11900,median_minor:12900,counts:{...EMPTY_COUNTS,...counts},...over});
function fakeDb(state:{listings:ReturnType<typeof listing>[];windows:ReturnType<typeof win>[];evidence?:Record<string,unknown>[];candidates?:unknown[];lastSync?:string|null}){
 const calls:{fn:string;args:any}[]=[];const saved:{brief?:any;proposals?:any[];reprice:any[];orders:any[];paused:string[];syncState?:any}={reprice:[],orders:[],paused:[]};
 const db={
  select:async(table:string,_q:string)=>{
   if(table==="brain_settings")return [{daily_budget_microusd:10_000_000,delivery_rate_bps:null,stock_max_age_hours:72}];
   if(table==="brain_runs")return [{summary:{prefilter:{taager_success_median_bps:3200}}}];
   if(table==="taager_catalog")return state.lastSync===null?[]:[{synced_at:state.lastSync??"2026-11-27T20:00:00Z"}];
   if(table==="order_sync_state")return [{synced_through:"2026-11-01T00:00:00Z"}];
   if(table==="market_price_evidence")return state.evidence??[];
   if(table==="store_offers")return [{id:"o1"},{id:"o2"}];
   if(table==="source_scorecard_daily")return [{source:"facebook",medium:"paid",campaign:"launch",visits:300,product_views:200,add_to_cart:20,checkout_starts:6,orders:6,delivered:2,profit_delivered_minor:6000},{source:"facebook",medium:"paid",campaign:"launch",visits:200,product_views:100,add_to_cart:8,checkout_starts:3,orders:2,delivered:1,profit_delivered_minor:3000}];
   if(table==="order_tracking")return saved.orders.map(o=>({status:o.status,profit_minor:o.status==="delivered"?11400:null}));
   throw Error("unexpected table "+table);},
  patch:async(table:string,_q:string,body:unknown)=>{if(table==="order_sync_state")saved.syncState=body;return [];},
  insert:async()=>[],upsert:async()=>null,
  rpc:async(fn:string,args:any)=>{calls.push({fn,args});
   if(fn==="order_tracking_upsert"){saved.orders.push(...args.p_rows);return {new:args.p_rows.length,status_changed:0};}
   if(fn==="scorecard_write_funnel"||fn==="scorecard_rollup_orders")return {};
   if(fn==="brain_daily_listings")return state.listings;
   if(fn==="scorecard_window")return args.p_days===1?state.windows.map(w=>({...w,counts:{...w.counts,orders:Math.min(w.counts.orders,2)}})):state.windows;
   if(fn==="brain_reprice_save"){saved.reprice.push(...args.p_rows);return args.p_rows.length;}
   if(fn==="brain_pause_listing"){saved.paused.push(args.p_listing);return true;}
   if(fn==="brain_daily_candidates")return state.candidates??[];
   if(fn==="brain_spent_today")return 120000;
   if(fn==="brain_daily_save"){saved.brief=args.p_brief;saved.proposals=args.p_proposals;return {proposals:args.p_proposals.length};}
   throw Error("unexpected rpc "+fn);},
 } as unknown as Db;
 return {db,calls,saved};
}
const deps=(db:Db,over:Record<string,unknown>={})=>({db,market:"sa" as const,now:()=>NOW,woo:null,posthog:null,phoneHashKey:"k".repeat(32),dialingCode:"+966",...over});

describe("the brain's daily loop",()=>{
 it("reads orders, re-prices, pauses a refused product, proposes additions and retirements, and writes one brief",async()=>{
  const A=listing("a","SKU-A"),B=listing("b","SKU-B",{price_minor:5300}),C=listing("c","SKU-C"),D=listing("d","SKU-D"),E=listing("e","SKU-E",{hidden_reason:"missing_from_catalogue"});
  const shop=(sku:string,price:number)=>({sku,retailer:"noon",url:"https://noon.com/"+sku,price_minor:price,delivery_minor:null,match:"exact",confidence:0.9,credible:true});
  const {db,calls,saved}=fakeDb({listings:[A,B,C,D,E],
   windows:[win(A,{views:500,add_to_cart:40,list_impressions:3000,list_clicks:120,orders:9,delivered:3,profit_delivered_minor:9000}),
    win(B,{views:60}),win(C,{views:900,add_to_cart:80,orders:12,delivered:1,refused:6,unreachable:3,refusal_reasons:{refused_at_door:6,unreachable:3}}),win(D,{views:400,add_to_cart:2}),win(E)],
   evidence:[shop("SKU-A",11900),shop("SKU-B",11900),shop("SKU-C",11900),shop("SKU-D",11900)]});
  const r=await runDaily(deps(db,{fixtureOrders:FIXTURE_WOO_ORDERS}));
  expect(r.day).toBe("2026-11-28");expect(r.steps.orders).toBe("fixture");expect(r.steps.analytics).toBe("not connected");
  // Orders: 7 Saudi fixture orders stored without anything personal; the sync cursor moves to the newest change.
  expect(saved.orders).toHaveLength(7);expect(JSON.stringify(saved.orders)).not.toMatch(/Fixture|street|example\.invalid/);
  expect(saved.syncState.synced_through).toBe("2026-12-01T02:00:00.000Z");
  // Re-pricing: B sells at 53 against Taager's cost of 45 (79 fits now): a change is proposed; A is left alone.
  expect(saved.reprice.map(x=>x.listing_id)).toEqual(["b"]);expect(saved.reprice[0]).toMatchObject({action:"change",new_price_minor:7900});
  // C: 1 delivered of 10 finished orders at a 32% planning rate → hidden now, with the reason.
  expect(saved.paused).toEqual(["c"]);
  const b=saved.brief;
  expect(b.paused[0].reason).toMatch(/10% of 10 finished orders/);
  expect(b.push_in_ads.map((x:any)=>x.listing_id)).toEqual(["a"]);
  expect(b.push_in_ads[0]).toMatchObject({target_country:"Saudi Arabia",show_price_usd:21.07});expect(b.push_in_ads[0].angle).toMatch(/cheaper at the door/);
  expect(b.retire.map((x:any)=>x.listing_id).sort()).toEqual(["d","e"]);
  expect(b.sources[0]).toMatchObject({source:"facebook / paid / launch",visits:500,orders:8,delivered:3,delivered_profit_usd:24});
  expect(b.to_approve).toEqual({products_to_add:0,products_to_retire:2,price_changes:1,offers:2});
  expect(b.health).toMatchObject({sync_ok:true,orders_connected:true,analytics_connected:false,spend_today_usd:0.12,daily_cap_usd:10});
  expect(b.health.notes.join(" ")).toMatch(/status name the brain does not know/);
  expect(b.audiences).toHaveLength(5);expect(b.headline).toMatch(/Last 14 days: 7 orders, 1 delivered/);
  expect(saved.proposals!.map(p=>p.kind+":"+p.ref).sort()).toEqual(["retire_product:d","retire_product:e"]);
  // It never publishes, approves or flips a switch.
  expect(calls.map(c=>c.fn).filter(f=>/publish|decide|release|autopilot|approve/.test(f))).toEqual([]);
 });
 it("keeps going when a step fails, and says so in the brief",async()=>{
  const {db,saved}=fakeDb({listings:[listing("a","SKU-A")],windows:[],lastSync:"2026-11-20T00:00:00Z"});
  const broken={...db,rpc:async(fn:string,args:unknown)=>{if(fn==="brain_daily_listings")throw Error("db down");return (db.rpc as any)(fn,args);}} as unknown as Db;
  const r=await runDaily(deps(broken));
  expect(r.steps.listings).toMatch(/^failed/);expect(r.steps.orders).toBe("not connected");
  expect(saved.brief.health.notes.join(" ")).toMatch(/listings failed/);
  expect(saved.brief.health.notes.join(" ")).toMatch(/older than 72 hours/);expect(saved.brief.health.sync_ok).toBe(false);
  expect(saved.brief.headline).toMatch(/WooCommerce connection for this market is not set up/);
 });
});

describe("seasonal calendar",()=>{
 it("holds the checked 2027 dates with how sure each one is",()=>{
  const by=Object.fromEntries(SEASONS.map(s=>[s.key,s]));
  expect(by["ramadan-2027"]).toMatchObject({date:"2027-02-08",confidence:"astronomical forecast"});
  expect(by["eid-al-fitr-2027"].date).toBe("2027-03-09");expect(by["mothers-day-2027"]).toMatchObject({date:"2027-03-21",confidence:"fixed"});
  expect(by["eid-al-adha-2027"].date).toBe("2027-05-16");expect(by["white-friday-2027"].date).toBe("2027-11-26");
  expect(new Date("2027-11-26T00:00:00Z").getUTCDay()).toBe(5);expect(by["back-to-school-2027"].confidence).toBe("planning estimate");
  expect(by["mothers-day-2027"].sections[0]).toBe("kids");
 });
 it("starts planning five weeks ahead and wants the assortment approved three weeks ahead",()=>{
  expect(seasonalPlans(NOW,"sa",{})).toEqual([]);
  const jan=seasonalPlans(Date.parse("2027-01-10T06:00:00Z"),"sa",{kitchen:4,home:9,organize:8});
  expect(jan).toHaveLength(1);
  expect(jan[0]).toMatchObject({key:"ramadan-2027",stage:"plan_now",days_until:29,act_by:"2027-01-18"});
  expect(jan[0].sections[0]).toEqual({section:"kitchen",on_store:4,target:12,gap:8});expect(jan[0].next_step).toMatch(/Add about 8 products in kitchen/);
  const feb=seasonalPlans(Date.parse("2027-02-20T06:00:00Z"),"eg",{});
  expect(feb.map(p=>[p.key,p.stage])).toEqual([["ramadan-2027","live_window"],["eid-al-fitr-2027","live_window"],["mothers-day-2027","plan_now"]]);
  expect(seasonCalendar(NOW).map(s=>s.key)[0]).toBe("ramadan-2027");
  expect(JSON.stringify(SEASONS)).not.toMatch(/countdown|hurry|last chance/i);
 });
});

describe("morning brief and audiences",()=>{
 it("is plain data in dollars with nothing invented",()=>{
  const b=buildBrief({market:"iq",m:MARKETS.iq,day:"2026-11-28",window_days:14,planningDeliveryBps:3300,products:[],yesterday:[],sources:[],
   orders:{placed:0,delivered:0,refused:0,returned:0,unreachable:0,cancelled:0,open:0,unknown_status:0,profit_delivered_minor:0},
   sync:{last_sync_at:null,max_age_hours:72,orders_connected:true,analytics_connected:true},reprice:{changes:0,pauses:0,examples:[]},paused_today:[],add:[],search_gaps:[],offers_waiting:0,seasonal:[],spend_today_usd:0,daily_cap_usd:10,notes:[]});
  expect(b.headline).toBe("Last 14 days: 0 orders, 0 delivered, $0 profit from delivered orders.");expect(b.currency_note).toMatch(/1310 IQD per dollar/);
  expect(b.push_in_ads).toEqual([]);expect(b.health.sync_ok).toBe(false);
 });
 it("defines retargeting audiences per market on the Pixel's standard events",()=>{
  const a=audienceDefinitions("eg");
  expect(a.map(x=>x.event)).toEqual(["ViewContent","AddToCart","InitiateCheckout","Purchase","PageView"]);
  expect(a.every(x=>x.url_contains==="/eg/"&&x.name.includes("YM EG"))).toBe(true);
  expect(a.find(x=>x.key==="added_to_cart")!.exclude).toEqual(["purchased_30d"]);
 });
});

describe("local fixture flag",()=>{
 it("lets fixtures in only on a developer's machine with the flag on, never on a deployed function",()=>{
  expect(fixturesAllowed("true","http://localhost:54321/functions/v1/yawmiyati-daily",undefined)).toBe(true);
  expect(fixturesAllowed("true","http://127.0.0.1:54321/x",undefined)).toBe(true);
  expect(fixturesAllowed(undefined,"http://localhost:54321/x",undefined)).toBe(false);
  expect(fixturesAllowed("1","http://localhost:54321/x",undefined)).toBe(false);
  expect(fixturesAllowed("true","https://skhtunkknshvolturqlm.supabase.co/functions/v1/yawmiyati-daily",undefined)).toBe(false);
  expect(fixturesAllowed("true","http://localhost:54321/x","dpl_abc")).toBe(false);
  expect(fixturesAllowed("true","not a url",undefined)).toBe(false);
 });
});
