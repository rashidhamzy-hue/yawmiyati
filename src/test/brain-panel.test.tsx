import {afterEach,describe,expect,it,vi} from "vitest";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import {BrainPanel} from "@/components/owner/BrainPanel";

const run={id:"r1",stage:"review",status:"awaiting_review",progress:{ingested:320,woo_total_products:300,researched:80,content_written:50},error:null,created_at:"",finished_at:null,
 summary:{prefilter:{evaluated:300,shortlisted:80,killed:4,top_exclusion_reasons:[["out_of_stock",40]]},
  decision:{selected:1,needs_owner_review:0,positioning:{cheaper:1},avg_expected_profit_usd:7.2,free_delivery:{threshold:"250 SAR",reasoning:"Basket math."}},
  merchandising:{hero:"خفاقة حليب",featured:["خفاقة حليب"],category_order:["kitchen"]},
  cost:{total_usd:3.1,research_usd:2.4,content_usd:0.7,web_searches:230,per_researched_product_usd:0.03,per_content_product_usd:0.014,projection:{one_store_cycle_usd:3.1,five_stores_cycle_usd:15.5,research_entire_catalog_this_store_usd:9,daily_autopilot_5_new_products_per_store_usd:1.9,note:"Estimates."}}}};
const overview={settings:{autopilot_enabled:false,daily_budget_microusd:10_000_000},spent_today_microusd:3_100_000,runs:[run],latest_run_id:"r1",
 capability:{totals:{products:300,variations:20},media:{offers_with_video:12,max_images:9,images_per_offer:{"2-4":200}},sku:{duplicate_skus:3},duplicates:{potential_family_groups:15},prices:{on_sale:5,median_minor:8900},content:{empty_description_pct:2},
  offer_kinds:{single:280,title_claims_multipack:20},bundles_and_packs:{bundle_like_categories:["Home Bundles"]},field_mapping:{cost_key:"taager_price",floor_key:"min_selling_price",confidence:"ai",notes:[]},meta_keys:[{key:"taager_price",count:300,numeric_share:1,samples:["45"]}]},
 cost:null,counts:{selected:1}};
const item={product_id:1,variation_id:0,title:"Milk frother",family_key:"x",offer_kind:"single",category:"kitchen",stage:"selected",prefilter_score:5,score:4.2,
 economics:{cost_minor:4500,floor_minor:7900},decision:{price_minor:12900,customer_total_minor:15700,profit_delivered_minor:7650,expected_profit_usd:1.53,competitor_reference_minor:14900,competitor_basis:"exact",competitor_count:2,notes:[]},
 research:{summary:"Sold on Amazon",listings:[{retailer:"amazon.sa",url:"https://www.amazon.sa/x",price_minor:14900,match:"exact",cited:true}],demand_signals:[{signal:"500 ratings"}]},
 content:{title:"خفاقة حليب كهربائية",description:"رغوة ناعمة.",bullets:["سهلة"],seo:{title:"خفاقة",meta_description:"وصف",slug:"milk-frother",keywords:["خفاقة"]},issues:[]},
 merchandising:{cross_sell:[{title:"علبة قهوة"}]},reasons:[],flags:[],cost_microusd:45000,owner_decision:null};

afterEach(()=>vi.unstubAllGlobals());

describe("Brain panel",()=>{
 it("shows the capability report, proposal, costs and products, and approves all",async()=>{
  const calls:string[]=[];
  vi.stubGlobal("fetch",vi.fn(async(url:URL|string,init?:RequestInit)=>{
   const path=new URL(String(url)).pathname;calls.push(path+" "+String(init?.body));
   if(path.endsWith("brain_dashboard"))return Response.json(overview);
   if(path.endsWith("brain_analysis_page"))return Response.json([item]);
   if(path.endsWith("brain_decide"))return Response.json(1);
   return Response.json({});
  }));
  render(<BrainPanel market="sa" origin="https://x.supabase.co" publicKey="pk" token="tok"/>);
  expect(await screen.findByText("خفاقة حليب كهربائية")).toBeInTheDocument();
  expect(screen.getByText("What Taager gives us")).toBeInTheDocument();
  expect(screen.getByText("taager_price",{selector:"li code"})).toBeInTheDocument();
  expect(screen.getByText("250 SAR")).toBeInTheDocument();
  expect(screen.getByText("$15.5")).toBeInTheDocument();
  expect(screen.getByText("129 SAR")).toBeInTheDocument();
  expect(screen.getByText(/AI spend today \$3\.10 \/ \$10\.00/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:/Approve all/}));
  await waitFor(()=>expect(calls.some(c=>c.includes("brain_decide")&&c.includes('"p_decision":"approved"')&&c.includes('"p_items":null'))).toBe(true));
 });
});

describe("Build store command",()=>{
 it("starts one build for the chosen number of products and shows progress and cost in dollars",async()=>{
  const calls:string[]=[];
  const building={...run,id:"r2",stage:"content",status:"awaiting_review",progress:{researched:15,content_written:4,target:10,cost_microusd:412000,research_from_cache:3,content_reused:1}};
  let started=false;
  vi.stubGlobal("fetch",vi.fn(async(url:URL|string,init?:RequestInit)=>{
   const path=new URL(String(url)).pathname;calls.push(path+" "+String(init?.body));
   if(path.endsWith("brain_dashboard"))return Response.json(started?{...overview,runs:[building]}:overview);
   if(path.endsWith("brain_analysis_page"))return Response.json([item]);
   if(path.endsWith("/yawmiyati-brain")){const b=JSON.parse(String(init?.body));if(b.action==="build_store")started=true;return Response.json({run:building,spent_today_microusd:412000});}
   return Response.json({});
  }));
  render(<BrainPanel market="sa" origin="https://x.supabase.co" publicKey="pk" token="tok"/>);
  const count=await screen.findByLabelText("Number of products to build") as HTMLInputElement;
  expect(count.value).toBe("100");
  fireEvent.change(count,{target:{value:"10"}});
  fireEvent.click(screen.getByRole("button",{name:"Build store"}));
  await waitFor(()=>expect(calls.some(c=>c.includes("/yawmiyati-brain")&&c.includes('"action":"build_store"')&&c.includes('"count":10'))).toBe(true));
  expect(await screen.findByText(/4 of 10 pages written/)).toBeInTheDocument();
  expect(screen.getByText(/this build so far \$0\.41/)).toBeInTheDocument();
  expect(screen.getByText(/4 reused at no cost/)).toBeInTheDocument();
  expect(screen.getByRole("progressbar",{name:"Build progress"})).toHaveAttribute("aria-valuenow","4");
  // Out-of-range numbers are clamped, never sent.
  fireEvent.change(screen.getByLabelText("Number of products to build"),{target:{value:"999"}});
  expect((screen.getByLabelText("Number of products to build") as HTMLInputElement).value).toBe("200");
 });
});

describe("pick list for the Taager add button",()=>{
 it("lists approved Taager product ids for the market",async()=>{
  const {pickList}=await import("@/components/owner/BrainPanel");
  const base={...item,owner_decision:null};
  expect(pickList([{...base,product_id:5,owner_decision:"approved"},{...base,product_id:7,owner_decision:"rejected"},{...base,product_id:9,owner_decision:"approved"},{...base,product_id:5,variation_id:2,owner_decision:"approved"}] as never,"sa")).toBe("ym:sa:5,9");
  expect(pickList([base] as never,"sa")).toBe("");
 });
});

