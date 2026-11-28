import {describe,expect,it,vi} from "vitest";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import {basketHash,gateOrder,marketMobile,nameProblem,otherMarketOf,riskLevel} from "../../supabase/functions/_shared/learn/order-quality.ts";
import {OrderQualityPanel} from "@/components/owner/OrderQualityPanel";
import {shopCopy} from "@/lib/store/shop-copy";

const ok={market:"sa" as const,phone:"0501234567",name:"نورة العتيبي",undelivered90:0,phoneLastHour:0,browserLastHour:0,sameBasket24h:0};

describe("order-quality filter",()=>{
 it("accepts each market's own mobile numbers and names the right market for a foreign one",()=>{
  expect(marketMobile("0501234567","sa")).toBe("966501234567");expect(marketMobile("+971 50 123 4567","ae")).toBe("971501234567");
  expect(marketMobile("91234567","om")).toBe("96891234567");expect(marketMobile("01012345678","eg")).toBe("201012345678");expect(marketMobile("07701234567","iq")).toBe("9647701234567");
  expect(marketMobile("0112345678","sa")).toBeNull(); // a Riyadh landline is not a mobile
  expect(marketMobile("+971501234567","sa")).toBeNull();expect(otherMarketOf("+971501234567","sa")).toBe("ae");expect(otherMarketOf("00201012345678","sa")).toBe("eg");
  expect(otherMarketOf("12345","sa")).toBeNull();
 });
 it("tells real names from test text in Arabic and Latin",()=>{
  for(const good of ["نورة العتيبي","Sara Ahmed","أم محمد","Mariam","زينب"])expect(nameProblem(good)).toBeNull();
  expect(nameProblem("a")).toBe("too_short");expect(nameProblem("test")).toBe("test_text");expect(nameProblem("تجربة")).toBe("test_text");
  expect(nameProblem("aaaaaa")).toBe("test_text");expect(nameProblem("ababababab")).toBe("repeated_characters");for(const pet of ["لولو","Lulu","Mimi","ريري"])expect(nameProblem(pet)).toBeNull();expect(nameProblem("ههههههه")).toBe("repeated_characters");
  expect(nameProblem("0501234567")).toBe("too_short");expect(nameProblem("sara@mail.com")).toBe("not_a_name");expect(nameProblem("Sara 12345")).toBe("not_a_name");
 });
 it("decides in order: fix the phone, refuse the blacklisted, hold the doubtful, ask one-timers to confirm, allow the rest",()=>{
  expect(gateOrder(ok)).toEqual({action:"allow"});
  expect(gateOrder({...ok,phone:"+971501234567"})).toEqual({action:"fix_form",field:"phone",reason:"wrong_country_phone",other_market:"ae"});
  expect(gateOrder({...ok,phone:"123"})).toMatchObject({action:"fix_form",reason:"invalid_phone"});
  expect(riskLevel(0)).toBe("none");expect(riskLevel(1)).toBe("confirm");expect(riskLevel(2)).toBe("blocked");expect(riskLevel(5)).toBe("blocked");
  expect(gateOrder({...ok,undelivered90:1})).toEqual({action:"confirm_whatsapp",reason:"one_undelivered_order"});
  expect(gateOrder({...ok,undelivered90:2,name:"test"})).toEqual({action:"refuse",reason:"blacklisted"});
  expect(gateOrder({...ok,name:"asdf",sameBasket24h:1,phoneLastHour:3,browserLastHour:4})).toEqual({action:"hold",reasons:["invalid_name","duplicate_order","too_many_orders_phone","too_many_orders_browser"],name_problem:"test_text"});
  // A held order is still held when the customer also has one undelivered order: the owner sees both.
  expect(gateOrder({...ok,undelivered90:1,sameBasket24h:1})).toMatchObject({action:"hold",reasons:["duplicate_order"]});
 });
 it("fingerprints a basket whatever the order of its items",async()=>{
  const a=await basketHash([{sku:"A",quantity:2},{sku:"B",quantity:1}]),b=await basketHash([{sku:"B",quantity:1},{sku:"A",quantity:2}]);
  expect(a).toMatch(/^[0-9a-f]{64}$/);expect(a).toBe(b);expect(a).not.toBe(await basketHash([{sku:"A",quantity:1},{sku:"B",quantity:1}]));
 });
 it("answers politely in each market's dialect, never naming a reason",()=>{
  for(const m of ["sa","ae","om","eg","iq"] as const){const c=shopCopy(m);
   expect(c.orderRefused).toMatch(/واتساب/);expect(c.orderNeedsConfirm).toMatch(/واتساب/);expect(c.privacyOrdersText.length).toBeGreaterThan(80);
   expect(c.orderRefused).not.toMatch(/قائمة|سوداء|محظور|مرتجع|رفض/);}
  expect(shopCopy("eg").orderRefused).toMatch(/دلوقتي/);expect(shopCopy("iq").orderRefused).toMatch(/هسه/);expect(shopCopy("sa").orderRefused).toMatch(/الحين/);
 });
});

describe("order quality panel",()=>{
 it("shows held orders and numbers under the rule by code only, and lets the owner release and unblock",async()=>{
  const key="a1".repeat(32),calls:string[]=[];
  const request=vi.fn(async(url:URL|string,init?:RequestInit)=>{const path=new URL(String(url)).pathname;calls.push(path+" "+String(init?.body));
   if(path.endsWith("brain_order_quality"))return Response.json({rule:{window_days:90,confirm_at:1,refuse_at:2},
    queue:[{id:"q1",order_ref:"YM-1009",reasons:["duplicate_order","invalid_name"],summary:{items:1},created_at:"2026-11-28T08:00:00Z",customer:"a1a1a1a1",undelivered_90d:0}],
    blacklist:[{customer:"a1a1a1a1",key,undelivered_90d:2,last_at:"2026-11-27T08:00:00Z",delivered_all_time:1}]});
   return Response.json(path.endsWith("brain_customer_unblock")?true:{order_ref:"YM-1009",status:"released"});}) as unknown as typeof fetch;
  render(<OrderQualityPanel market="sa" origin="https://x.supabase.co" publicKey="pk" token="tok" request={request}/>);
  expect(await screen.findByText(/Order YM-1009 · customer a1a1a1a1/)).toBeInTheDocument();
  expect(screen.getByText(/same basket from the same number within a day; the name does not look real/)).toBeInTheDocument();
  expect(screen.getByText("order form refuses")).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/\+?966|05\d{8}/);
  fireEvent.click(screen.getByRole("button",{name:"Release"}));
  await waitFor(()=>expect(calls.some(c=>c.includes("brain_order_queue_decide")&&c.includes('"p_decision":"released"'))).toBe(true));
  fireEvent.click(screen.getByRole("button",{name:"Unblock"}));
  await waitFor(()=>expect(calls.some(c=>c.includes("brain_customer_unblock")&&c.includes(key))).toBe(true));
 });
});
