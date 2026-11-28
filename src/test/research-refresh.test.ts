import {describe,expect,it} from "vitest";
import type {Db} from "../../supabase/functions/_shared/brain/db.ts";
import {MARKETS} from "../../supabase/functions/_shared/brain/markets.ts";
import {refreshStaleResearch,REFRESH_MAX_PER_DAY} from "../../supabase/functions/_shared/learn/research-refresh.ts";
import {runDaily} from "../../supabase/functions/_shared/learn/daily.ts";

const NOW=Date.parse("2026-12-20T03:20:00Z");
const days=(n:number)=>new Date(NOW-n*86_400_000).toISOString();
const fin={price:140,originalPrice:77,profit:63};
function setup(over:{cache?:Record<string,string>;spent?:number;cap?:number;key?:string|null;skus?:string[]}={}){
 const skus=over.skus??["OLD","FRESH","NEVER"],writes:{table:string;rows:any}[]=[],ledger:any[]=[];let asked=0;
 const db={
  select:async(table:string,q:string)=>{
   if(table==="market_research_cache")return Object.entries(over.cache??{OLD:days(20),FRESH:days(3)}).map(([sku,researched_at])=>({sku,researched_at}));
   if(table==="taager_catalog"){const sku=decodeURIComponent(/sku=eq\.([^&]+)/.exec(q)![1]!);return [{market:"sa",sku,product_id:1,variant_id:0,item_type:"product",name:"خفاقة حليب "+sku,listing:{financials:fin,name:"خفاقة حليب "+sku},detail:null,financials:fin,synced_at:days(0)}];}
   throw Error("unexpected table "+table);},
  insert:async(_t:string,row:any)=>{ledger.push(row);return null;},upsert:async(table:string,rows:any)=>{writes.push({table,rows});return null;},patch:async()=>[],
  rpc:async(fn:string)=>{if(fn==="brain_spent_today")return over.spent??0;throw Error("unexpected rpc "+fn);},
 } as unknown as Db;
 const fetchImpl=(async()=>{asked++;return Response.json({content:[{type:"server_tool_use",name:"web_search",input:{query:"x"}},{type:"web_search_tool_result",content:[{type:"web_search_result",url:"https://www.amazon.sa/dp/1"}]},
   {type:"text",text:JSON.stringify({listings:[{retailer:"amazon.sa",url:"https://www.amazon.sa/dp/1",price:"129",delivery:"0",match:"exact",confidence:0.9}],demand_signals:[],facts:[],buyer_questions:[]})}],
   usage:{input_tokens:8000,output_tokens:600,server_tool_use:{web_search_requests:2}},stop_reason:"end_turn"});}) as unknown as typeof fetch;
 const run=()=>refreshStaleResearch({db,market:"sa",m:MARKETS.sa,anthropicKey:over.key===undefined?"test-key":over.key,fetchImpl,now:NOW,deadline:Date.now()+60_000,
  settings:{daily_budget_microusd:over.cap??10_000_000,research_model:"claude-haiku-5-5",max_searches_per_product:3},listings:skus.map(sku=>({sku,hidden_reason:null}))});
 return {run,writes,ledger,asked:()=>asked};
}
describe("the daily loop refreshes stale shop prices by itself (fake model replies)",()=>{
 it("researches what was never researched and what is older than 14 days, oldest first, and leaves fresh products alone",async()=>{
  const s=setup(),r=await s.run();
  expect(r).toMatchObject({stale:2,refreshed:2,failed:0,stopped:"done"});expect(s.asked()).toBe(2);
  expect(s.writes.filter(w=>w.table==="market_research_cache").map(w=>w.rows[0].sku)).toEqual(["NEVER","OLD"]);
  expect(s.ledger).toHaveLength(2);expect(s.ledger[0]).toMatchObject({run_id:null,store_code:"sa",step:"research",item_ref:"daily:NEVER"});
  expect(r.cost_microusd).toBe(s.ledger[0].cost_microusd+s.ledger[1].cost_microusd);expect(r.note).toMatch(/^Shop prices refreshed for 2 products \(\$0\.\d\d\)\.$/);
 });
 it("spends nothing without a key, when today's cap is used, or beyond its quarter of the cap",async()=>{
  const noKey=setup({key:null}),a=await noKey.run();
  expect(a).toMatchObject({refreshed:0,stopped:"no_key"});expect(noKey.asked()).toBe(0);expect(a.note).toContain("AI key is not set");
  const used=setup({spent:10_000_000}),b=await used.run();
  expect(b).toMatchObject({refreshed:0,stopped:"budget"});expect(used.asked()).toBe(0);expect(b.note).toContain("budget is already used");
  // A cap so small that a quarter of it cannot pay for one product.
  const tiny=setup({cap:100_000}),c=await tiny.run();
  expect(c.refreshed).toBe(0);expect(tiny.asked()).toBe(0);
  const fresh=setup({cache:{OLD:days(1),FRESH:days(2),NEVER:days(3)}}),d=await fresh.run();
  expect(d).toMatchObject({stale:0,stopped:"nothing_stale",note:null});expect(fresh.asked()).toBe(0);
 });
 it("stops at its daily count and says how many are still due",async()=>{
  const many=setup({skus:Array.from({length:20},(_,i)=>"S"+i),cache:{},cap:100_000_000}),r=await many.run();
  expect(r.refreshed).toBe(REFRESH_MAX_PER_DAY);expect(r.stopped).toBe("daily_count");expect(r.note).toContain("8 more are due");
 });
});

describe("autopilot in the daily loop",()=>{
 const base=(autopilot:boolean)=>{const calls:string[]=[];let merged:any=null;
  const db={select:async(table:string)=>{if(table==="brain_settings")return [{daily_budget_microusd:10_000_000,delivery_rate_bps:null,stock_max_age_hours:72,autopilot_enabled:autopilot}];return [];},
   insert:async()=>null,upsert:async()=>null,patch:async()=>[],
   rpc:async(fn:string,args:any)=>{calls.push(fn);if(fn==="brain_autopilot_apply")return {enabled:true,price_changes:2,retired:1,offers:3,left_for_owner:1,new_products_waiting:4};if(fn==="brain_brief_merge"){merged=args.p_patch;return true;}
    if(fn==="brain_daily_listings"||fn==="scorecard_window"||fn==="brain_daily_candidates")return [];return 0;}} as unknown as Db;
  return {db,calls,merged:()=>merged};};
 it("never asks the database to approve anything while autopilot is off",async()=>{
  const s=base(false);await runDaily({db:s.db,market:"sa",now:()=>NOW,woo:null,posthog:null,phoneHashKey:null,dialingCode:"+966"});
  expect(s.calls).toContain("brain_daily_save");expect(s.calls.filter(c=>/autopilot|decide|publish|release/.test(c))).toEqual([]);
 });
 it("when the owner switched it on, lets the database apply its own checks and writes what it did into the brief",async()=>{
  const s=base(true),r=await runDaily({db:s.db,market:"sa",now:()=>NOW,woo:null,posthog:null,phoneHashKey:null,dialingCode:"+966"});
  expect(s.calls.indexOf("brain_autopilot_apply")).toBeGreaterThan(s.calls.indexOf("brain_daily_save"));
  expect(s.merged()).toEqual({autopilot:{price_changes:2,retired:1,offers:3,left_for_owner:1,new_products_waiting:4}});expect(r.brief.autopilot!.offers).toBe(3);
  expect(s.calls.filter(c=>/decide|publish|release|set_autopilot/.test(c))).toEqual([]);
 });
});
