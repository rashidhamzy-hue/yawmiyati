import {describe,expect,it} from "vitest";
import {step} from "../../supabase/functions/_shared/brain/runner.ts";
import {decidePrice} from "../../supabase/functions/_shared/brain/economics.ts";
import {MARKETS} from "../../supabase/functions/_shared/brain/markets.ts";
import type {Db} from "../../supabase/functions/_shared/brain/db.ts";

// ---- In-memory PostgREST double: supports exactly the filters the runner uses ----
type Row=Record<string,unknown>;
function fakeDb(){
 const t:Record<string,Row[]>={brain_settings:[],brain_runs:[],brain_cost_ledger:[],supplier_offers:[],supplier_capability_reports:[],brain_product_analysis:[],taager_catalog:[]};
 const pk:Record<string,string[]>={supplier_offers:["store_code","provider","product_id","variation_id"],brain_product_analysis:["run_id","product_id","variation_id"],supplier_capability_reports:["run_id"],brain_settings:["store_code"]};
 const val=(v:string)=>v==="null"?null:/^-?\d+$/.test(v)?Number(v):v;
 function filter(rows:Row[],q:string){
  const p=new URLSearchParams(q);let out=rows;
  for(const [k,v] of p){
   if(["select","order","limit","offset","on_conflict"].includes(k))continue;
   if(k==="or")continue; // lock condition: treated as satisfied
   const [op,...rest]=v.split(".");const arg=rest.join(".");
   if(op==="eq")out=out.filter(r=>String(r[k])===String(val(arg)));
   else if(op==="is")out=out.filter(r=>r[k]===null||r[k]===undefined);
   else if(op==="in"){const set=arg.replace(/[()]/g,"").split(",");out=out.filter(r=>set.includes(String(r[k])));}
  }
  const order=p.get("order");
  if(order){const [col,dir]=order.split(",")[0].split(".");out=[...out].sort((a,b)=>((Number(b[col])||0)-(Number(a[col])||0))*(dir==="desc"?1:-1));}
  const off=Number(p.get("offset")??0),lim=Number(p.get("limit")??1e9);
  return out.slice(off,off+lim);
 }
 const db={
  select:async(table:string,q:string)=>structuredClone(filter(t[table],q)),
  insert:async(table:string,rows:unknown)=>{const list=(Array.isArray(rows)?rows:[rows]).map(r=>({id:crypto.randomUUID(),created_at:new Date().toISOString(),...(r as Row)}));t[table].push(...list);return structuredClone(list);},
  upsert:async(table:string,rows:unknown)=>{for(const r of (Array.isArray(rows)?rows:[rows]) as Row[]){const keys=pk[table];const i=t[table].findIndex(x=>keys.every(k=>String(x[k]??(k==="provider"?"taager_woo":0))===String(r[k]??(k==="provider"?"taager_woo":0))));if(i>=0)t[table][i]={...t[table][i],...r};else t[table].push({...r});}return null;},
  patch:async(table:string,q:string,body:unknown)=>{const hit=filter(t[table],q);for(const r of hit)Object.assign(r,body as Row);return structuredClone(hit);},
  rpc:async(fn:string)=>fn==="brain_spent_today"?t.brain_cost_ledger.reduce((s,r)=>s+Number(r.cost_microusd),0):null,
 } as unknown as Db;
 return {db,t};
}

// ---- Fake Taager-on-WooCommerce store (30 products + one variable with 2 variations) ----
const N=30;
function product(i:number){
 const banned=i===7,noCost=i===8,bundle=i===9,dup=i===11;
 return {id:i,name:banned?"شيشة الكترونية":dup?"منتج رقم 10 3 قطع":`منتج رقم ${i}`,type:i===20?"variable":"simple",status:"publish",sku:`TG-${i}`,
  price:String(60+i),regular_price:String(60+i),stock_status:i===5?"outofstock":"instock",
  categories:[{id:1,name:bundle?"Home Bundles":i%2?"المطبخ":"منظمات التخزين",slug:"c"}],
  images:Array.from({length:i%4},(_,k)=>({src:`https://cdn.taager.com/${i}-${k}.jpg`})),attributes:[],
  meta_data:noCost?[]:[{key:"taager_price",value:String(30+i)},{key:"min_selling_price",value:String(55+i)}],
  description:"<p>"+"وصف المنتج بالتفصيل مع الاستخدامات. ".repeat(12)+"</p>"};
}
function fakeFetch(calls:{research:number;content:number;mapping:number}){
 return (async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input));
  if(url.hostname==="shop.test"){
   if(url.pathname.endsWith("/variations"))return Response.json([{id:2001,sku:"TG-20-S",price:"80",attributes:[{name:"size",option:"S"}],meta_data:[{key:"taager_price",value:"40"},{key:"min_selling_price",value:"75"}]},{id:2002,sku:"TG-20-L",price:"90",attributes:[{name:"size",option:"L"}],meta_data:[{key:"taager_price",value:"45"},{key:"min_selling_price",value:"85"}]}],{headers:{"x-wp-totalpages":"1"}});
   const page=Number(url.searchParams.get("page")),per=Number(url.searchParams.get("per_page"));
   const all=Array.from({length:N},(_,k)=>product(k+1));
   return Response.json(all.slice((page-1)*per,page*per),{headers:{"x-wp-totalpages":String(Math.ceil(N/per)),"x-wp-total":String(N)}});
  }
  const body=JSON.parse(String(init?.body));
  const sys:string=body.system;
  if(sys.includes("map a supplier")){calls.mapping++;return Response.json({content:[{type:"text",text:'{"cost_key":"taager_price","floor_key":"min_selling_price","confidence":0.9,"woo_price_is":"neither","explanation":"names"}'}],usage:{input_tokens:2000,output_tokens:100},stop_reason:"end_turn"});}
  if(sys.includes("market researcher")){calls.research++;const n=calls.research;
   return Response.json({content:[{type:"server_tool_use",name:"web_search",input:{query:"x"}},{type:"web_search_tool_result",content:[{type:"web_search_result",url:`https://www.amazon.sa/dp/${n}`}]},
    {type:"text",text:JSON.stringify({listings:[{retailer:"amazon.sa",url:`https://www.amazon.sa/dp/${n}`,price:String(120+n),currency:"SAR",match:"exact",confidence:0.85}],demand_signals:[{source:"amazon",signal:"500 ratings"}],summary:"Sold on Amazon"})}],
    usage:{input_tokens:8000,output_tokens:600,server_tool_use:{web_search_requests:2}},stop_reason:"end_turn"});}
  if(sys.includes("product pages")){calls.content++;
   return Response.json({content:[{type:"text",text:JSON.stringify({title:"منتج مميز",description:"وصف عربي واضح.",bullets:["فائدة"],seo:{title:"منتج مميز",meta_description:"وصف",keywords:["منتج"],slug:"product"},category:"kitchen",faq:[{q:"س",a:"ج"}]})}],
    usage:{input_tokens:3000,output_tokens:1500},stop_reason:"end_turn"});}
  return new Response("unexpected",{status:500});
 }) as typeof fetch;
}

describe("Yawmiyati Brain end to end (fake Taager store, fake Claude)",()=>{
 it("ingests everything, audits, prefilters, researches, prices, writes content and stops for owner review",async()=>{
  const {db,t}=fakeDb();
  t.brain_settings.push({store_code:"sa",daily_budget_microusd:10_000_000,research_model:"claude-haiku-5-5",content_model:"claude-sonnet-5-5",shortlist_size:12,selection_size:6,max_searches_per_product:3,delivery_rate_bps:null,field_mapping:{}});
  t.brain_runs.push({id:"run-1",store_code:"sa",stage:"ingest",status:"running",cursor:{},progress:{},summary:{},locked_until:null});
  const calls={research:0,content:0,mapping:0};
  const deps={db,market:"sa" as const,woo:{origin:"https://shop.test",key:"ck",secret:"cs"},anthropicKey:"sk-test",fetchImpl:fakeFetch(calls),concurrency:4,timeBudgetMs:600_000};
  let run=await step(deps,"run-1");
  for(let i=0;i<20&&run.status==="running";i++)run=await step(deps,"run-1");
  expect(run.status).toBe("awaiting_review");
  expect(run.stage).toBe("review");
  // Ingestion: 30 products + 2 variations.
  expect(t.supplier_offers).toHaveLength(32);
  const report=t.supplier_capability_reports[0].report as Record<string,any>;
  expect(report.totals.products).toBe(30);expect(report.totals.variations).toBe(2);
  expect(report.field_mapping.cost_key).toBe("taager_price");
  expect(calls.mapping).toBe(1);
  // Prefilter: banned killed, out of stock / no image / no cost excluded, shortlist capped at 12.
  const a=t.brain_product_analysis;
  const byId=(id:number)=>a.find(r=>r.product_id===id)!;
  expect(byId(7).stage).toBe("killed");
  expect((byId(5).reasons as string[])).toContain("out_of_stock");
  expect((byId(8).reasons as string[])).toContain("economics_unknown");
  expect((byId(4).reasons as string[])).toContain("no_images");
  expect(calls.research).toBe(11); // 35% category cap: 5 kitchen + 5 organize + 1 home
  expect(byId(11).family_key).toBe(byId(10).family_key); // "3-pack" of product 10 is the same potential family
  expect(byId(11).stage).toBe("excluded");
  // Decisions: 6 selected, each priced at or above Taager's minimum, profitable, with content.
  const selected=a.filter(r=>r.stage==="selected");
  expect(selected).toHaveLength(6);
  for(const s of selected){
   const d=s.decision as Record<string,number>;const e=s.economics as Record<string,number>;
   expect(d.price_minor).toBeGreaterThanOrEqual(e.floor_minor);
   expect(d.profit_delivered_minor).toBeGreaterThan(0);
   expect((s.content as Record<string,unknown>).title).toBe("منتج مميز");
   expect(s.merchandising).toBeTruthy();
   expect(Number(s.cost_microusd)).toBeGreaterThan(0);
  }
  expect(calls.content).toBe(6);
  // Every paid call is in the ledger; summary carries costs and projections.
  expect(t.brain_cost_ledger).toHaveLength(1+11+6);
  const summary=run.summary as Record<string,any>;
  expect(summary.cost.web_searches).toBe(22);
  expect(summary.cost.total_usd).toBeGreaterThan(0);
  expect(summary.cost.projection.five_stores_cycle_usd).toBeGreaterThan(0);
  expect(summary.decision.selected).toBe(6);
  expect(summary.merchandising.featured.length).toBeGreaterThan(0);
 });

 it("pauses instead of overspending when the daily budget is reached",async()=>{
  const {db,t}=fakeDb();
  t.brain_settings.push({store_code:"sa",daily_budget_microusd:20_000,research_model:"claude-haiku-5-5",content_model:"claude-sonnet-5-5",shortlist_size:12,selection_size:6,max_searches_per_product:3,delivery_rate_bps:null,field_mapping:{}});
  t.brain_runs.push({id:"run-2",store_code:"sa",stage:"ingest",status:"running",cursor:{},progress:{},summary:{},locked_until:null});
  const calls={research:0,content:0,mapping:0};
  const deps={db,market:"sa" as const,woo:{origin:"https://shop.test",key:"ck",secret:"cs"},anthropicKey:"sk-test",fetchImpl:fakeFetch(calls),timeBudgetMs:600_000};
  let run=await step(deps,"run-2");
  for(let i=0;i<10&&run.status==="running";i++)run=await step(deps,"run-2");
  expect(run.status).toBe("paused_budget");
  expect(calls.research).toBe(0);
  const spent=t.brain_cost_ledger.reduce((s,r)=>s+Number(r.cost_microusd),0);
  expect(spent).toBeLessThanOrEqual(20_000);
 });

 it("fails clearly without supplier credentials",async()=>{
  const {db,t}=fakeDb();
  t.brain_settings.push({store_code:"sa",daily_budget_microusd:1,research_model:"claude-haiku-5-5",content_model:"claude-sonnet-5-5",shortlist_size:1,selection_size:1,max_searches_per_product:1,delivery_rate_bps:null,field_mapping:{}});
  t.brain_runs.push({id:"run-3",store_code:"sa",stage:"ingest",status:"running",cursor:{},progress:{},summary:{},locked_until:null});
  const run=await step({db,market:"sa",woo:null,anthropicKey:null},"run-3") as Record<string,unknown>;
  expect(run.status).toBe("failed");expect(String(run.error)).toContain("missing_woo_credentials");
 });
});

// ---- Owner-run Taager sync rows (shape of taager_catalog) ----
function taagerRow(i:number){
 const sku=`SA0101${String(i).padStart(4,"0")}99`;
 const fin:Record<string,unknown>={price:55+i,originalPrice:30+i,profit:25,discounts:[],tieredPricing:[{quantity:1,price:55+i,profit:25},{quantity:2,price:100+2*i,profit:40}]};
 if(i===5)fin.pricingRange={min:60,max:65};
 if(i===6)(fin.discounts as unknown[]).push({type:"sale",price:58,profit:25,startsAt:"2020-01-01T00:00:00",expiresAt:"2099-01-01T00:00:00"});
 const variant={sku,financials:fin,availability:i===4?"not_available":"available",merchantInfo:{orderable:true},analytics:{confirmationRate:i===1?0.8:0,deliveryRate:i===1?0.9:0},
  images:[`https://media.taager.com/${i}-a.jpg`,`https://media.taager.com/${i}-b.jpg`,`https://media.taager.com/${i}-v.mp4`],videos:[],
  description:i===2?"1":"وصف المنتج بالتفصيل مع الاستخدامات. ".repeat(12),specifications:"-",howToUse:"",attributes:[],
  ...(i===3?{bundleItems:[{productId:900,sku:"SA0999000199",quantity:2}]}:{}),faq:i===1?[{question:"هل يناسب المطبخ؟",answer:"نعم"}]:[]};
 return {market:"sa",sku,product_id:1000+i,variant_id:5000+i,item_type:i===3?"bundle":"product",name:`منتج تاجر ${i}`,
  listing:{productId:1000+i,variantId:5000+i,sku,name:`منتج تاجر ${i}`,type:i===3?"bundle":"product",financials:{price:55+i,originalPrice:30+i,profit:25}},
  detail:{productId:1000+i,name:`منتج تاجر ${i}`,country:"SAU",categoryId:553,type:i===3?"bundle":"product",active:true,variant,variant_count:1},alternatives:[],synced_at:"2026-11-27T00:00:00Z",price_changed_at:null};
}

describe("Yawmiyati Brain on Taager merchant data",()=>{
 it("reads taager_catalog instead of WooCommerce and prices inside Taager's limits",async()=>{
  const {db,t}=fakeDb();
  t.brain_settings.push({store_code:"sa",daily_budget_microusd:10_000_000,research_model:"claude-haiku-5-5",content_model:"claude-sonnet-5-5",shortlist_size:12,selection_size:6,max_searches_per_product:3,delivery_rate_bps:null,field_mapping:{}});
  t.brain_runs.push({id:"run-t",store_code:"sa",stage:"ingest",status:"running",cursor:{},progress:{},summary:{},locked_until:null});
  for(let i=1;i<=10;i++)t.taager_catalog.push(taagerRow(i));
  const calls={research:0,content:0,mapping:0};
  const deps={db,market:"sa" as const,woo:null,anthropicKey:"sk-test",fetchImpl:fakeFetch(calls),concurrency:4,timeBudgetMs:600_000};
  let run=await step(deps,"run-t");
  for(let i=0;i<20&&run.status==="running";i++)run=await step(deps,"run-t");
  expect(run.error??null).toBeNull();
  expect(run.status).toBe("awaiting_review");
  expect((run.summary as Record<string,unknown>).source).toBe("taager_api");
  expect(calls.mapping).toBe(0); // Taager states its own economics: no AI field mapping
  expect(t.supplier_offers).toHaveLength(10);
  const offer=(i:number)=>t.supplier_offers.find(o=>o.product_id===1000+i)! as Record<string,any>;
  expect(offer(1).provider).toBe("taager_api");
  expect(offer(1).images).toHaveLength(2);expect(offer(1).videos).toHaveLength(1); // .mp4 moved out of images
  expect(offer(1).meta.taager_success_rate_bps).toBe(7200);
  expect(offer(2).description).toBeNull(); // Taager placeholder text is treated as empty
  expect(offer(3).meta.taager_bundle_items).toEqual([{sku:"SA0999000199",product_id:900,quantity:2}]);
  expect(offer(6).sale_price_minor).toBe(5800);
  const a=t.brain_product_analysis;const byId=(i:number)=>a.find(r=>r.product_id===1000+i)! as Record<string,any>;
  expect(byId(4).reasons).toContain("out_of_stock");
  expect(byId(3).offer_kind).toBe("verified_bundle");
  expect(byId(1).economics).toMatchObject({cost_minor:3100,floor_minor:5600});
  expect(byId(5).economics.max_minor).toBe(6500);
  for(const s of a.filter(r=>r.stage==="selected")){
   const d=s.decision as Record<string,number>;const e=s.economics as Record<string,number>;
   expect(d.price_minor).toBeGreaterThan(e.cost_minor);expect(d.profit_delivered_minor).toBeGreaterThan(0);
  }
  expect(a.filter(r=>r.stage==="selected").length).toBeGreaterThan(0);
 });
 it("treats Taager's maximum as a reference, not a cap",()=>{
  const over=decidePrice({inputs:{cost_minor:3500,floor_minor:6000,suggested_minor:null,max_minor:6500},competitors:[{retailer:"amazon.sa",url:"https://amazon.sa/x",price_minor:14900,match:"exact",confidence:0.9}],m:MARKETS.sa});
  expect(over.state).toBe("priced");expect(over.price_minor!).toBeGreaterThan(6500);expect(over.taager_position).toBe("above_maximum");
 });
});
