import {afterEach,describe,expect,it,vi} from "vitest";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import {MorningBrief} from "@/components/owner/MorningBrief";

const brief={day:"2026-11-28",market:"sa",currency_note:"US dollars at about 3.75 SAR per dollar.",headline:"Last 14 days: 12 orders, 4 delivered, $52.3 profit from delivered orders.",
 sold:{orders_placed:12,delivered:4,open:3,delivered_profit_usd:52.3,top:[{title:"خلاط",orders:3,delivered:1,profit_usd:14.2}]},
 refusals:{refused:3,returned:1,unreachable:1,cancelled:0,reasons:[{reason:"price",orders:2}],worst:[]},
 push_in_ads:[{listing_id:"a",slug:"blender",title:"خلاط",angle:"Value.",creative:"Use the product video.",show_price_usd:21.07,show_offer:"Price + cash on delivery",target_country:"Saudi Arabia",why:"8% add to cart."}],
 price_blocks_sales:[],retire:[],add:[],price_changes:{changes:1,pauses:0,examples:[]},paused:[],hidden_now:[{reason:"out of stock at Taager",products:2}],
 sources:[{source:"facebook / paid",visits:500,orders:8,delivered:3,delivered_profit_usd:24,verdict:"Earned $24 delivered."}],search_gaps:[{query:"مكواة",searches:4}],offers_waiting:2,
 audiences:[{key:"added_to_cart",name:"YM SA · added to cart · 14d",event:"AddToCart",url_contains:"/sa/",retention_days:14,exclude:["purchased_30d"],use_for:"Dynamic product ad."}],
 seasonal:[{key:"ramadan-2027",name:"Ramadan",date:"2027-02-08",confidence:"astronomical forecast",days_until:29,act_by:"2027-01-18",next_step:"Add about 8 products in kitchen.",ideas:["Hosting"]}],
 health:{sync_age_hours:7,sync_ok:true,orders_connected:true,analytics_connected:false,unknown_order_statuses:0,spend_today_usd:0.12,daily_cap_usd:10,notes:["analytics not connected"]},
 to_approve:{products_to_add:1,products_to_retire:1,price_changes:1,offers:2}};
const data={day:"2026-11-28",brief,created_at:"2026-11-28T03:21:00Z",days:["2026-11-28","2026-11-27"],price_changes_waiting:1,offers_waiting:2,paused:[],autopilot_enabled:false,daily_loop_enabled:true,
 proposals:[{id:"p1",kind:"add_product",ref:"SKU-9",title:"منتج جديد",why:"new at Taager this month.",data:{product_id:901},status:"proposed",day:"2026-11-28"},
  {id:"p2",kind:"retire_product",ref:"d",title:"منتج ضعيف",why:"400 views and no orders.",data:{},status:"proposed",day:"2026-11-28"}]};

afterEach(()=>vi.unstubAllGlobals());
describe("Morning brief panel",()=>{
 it("shows the brief in dollars and approves the whole day with one button",async()=>{
  const calls:string[]=[];
  const request=vi.fn(async(url:URL|string,init?:RequestInit)=>{
   const path=new URL(String(url)).pathname;calls.push(path+" "+String(init?.body));
   if(path.endsWith("brain_brief"))return Response.json(data);
   if(path.endsWith("brain_reprice_decide"))return Response.json({decided:1,skipped_unsafe:0});
   if(path.endsWith("brain_daily_decide"))return Response.json({decided:2,retired:1,add_product_ids:[901]});
   if(path.endsWith("brain_offers_list"))return Response.json([{id:"o1",status:"proposed",problem:null},{id:"o2",status:"proposed",problem:"loss"}]);
   if(path.endsWith("brain_offer_decide"))return Response.json({});
   if(path.endsWith("/yawmiyati-brain"))return Response.json({run:{id:"r9",status:"running"}});
   return Response.json({});
  }) as unknown as typeof fetch;
  render(<MorningBrief market="sa" origin="https://x.supabase.co" publicKey="pk" token="tok" request={request}/>);
  expect(await screen.findByText(/12 orders, 4 delivered, \$52\.3 profit/)).toBeInTheDocument();
  expect(screen.getByText(/\$21\.07/)).toBeInTheDocument();expect(screen.getByText("YM SA · added to cart · 14d")).toBeInTheDocument();
  expect(screen.getByText(/Ramadan · 2027-02-08 \(astronomical forecast\) · in 29 days/)).toBeInTheDocument();
  expect((screen.getByLabelText(/Autopilot/) as HTMLInputElement).checked).toBe(false);expect(screen.getByLabelText(/Autopilot/)).toBeDisabled();
  fireEvent.click(screen.getByRole("button",{name:/Approve all \(5\)/}));
  await waitFor(()=>expect(screen.getByRole("status").textContent).toMatch(/1 price changes, 1 products retired, 1 products to add, 1 offers/));
  expect(calls.some(c=>c.includes("brain_reprice_decide")&&c.includes('"p_ids":null'))).toBe(true);
  expect(calls.some(c=>c.includes("brain_daily_decide")&&c.includes('"p_decision":"approved"'))).toBe(true);
  // Only the safe offer is approved; the new product goes to a build, which comes back for review before publishing.
  expect(calls.filter(c=>c.includes("brain_offer_decide"))).toHaveLength(1);
  expect(calls.some(c=>c.includes("/yawmiyati-brain")&&c.includes('"action":"build_store"')&&c.includes('"product_ids":[901]'))).toBe(true);
  expect(calls.some(c=>/brain_publish|brain_set_release|autopilot/.test(c))).toBe(false);
 });
});
