import {describe,expect,it} from "vitest";
import {cleanPages,contradictions,customerFacts,effectiveMarket,extractMarketFacts,rulesBrief,startingDecision,type StoredFact} from "../../supabase/functions/_shared/brain/taager-facts";
import {MARKETS,worstDeliveryFee,type Market} from "../../supabase/functions/_shared/brain/markets";
import {profitDelivered} from "../../supabase/functions/_shared/brain/economics";
import {FIXTURE_TAAGER_PAGES} from "../../supabase/functions/_shared/learn/fixtures/taager-pages";

// FIXTURE-ONLY: these pages are made up in the documented v5 shape. The first real v5 file may need rule fixes.
const facts=(m:Market)=>Object.fromEntries(extractMarketFacts(m,cleanPages(m,FIXTURE_TAAGER_PAGES[m])).map(f=>[f.key,f]));
const stored=(m:Market,over:Partial<Record<string,StoredFact["decision"]>>={}):StoredFact[]=>extractMarketFacts(m,cleanPages(m,FIXTURE_TAAGER_PAGES[m])).map(f=>({key:f.key,value:f.value,decision:over[f.key]??startingDecision(m,f),summary:f.summary,source_path:f.source_path,source_read_at:f.source_read_at}));

describe("facts read from Taager's information pages (fixture)",()=>{
 it("reads the delivery fee of every market, Egypt's three zones included, with the page and date it came from",()=>{
  expect(facts("sa").delivery_fee.value).toEqual({flat_minor:2800});
  expect(facts("ae").delivery_fee.value).toEqual({flat_minor:1900});
  expect(facts("om").delivery_fee.value).toEqual({flat_minor:3000});
  expect(facts("iq").delivery_fee.value).toEqual({flat_minor:7000000});
  const eg=facts("eg").delivery_fee.value.zones as {name:string;places:string[];fee_minor:number}[];
  expect(eg.map(z=>z.fee_minor)).toEqual([9500,10000,10500]);
  expect(eg[0].places).toEqual(["Cairo","Giza","Alexandria"]);expect(eg[2].places).toContain("Aswan");
  expect(facts("eg").delivery_fee.source_path).toBe("/eg/info");expect(facts("eg").delivery_fee.source_read_at).toBe("2026-11-28T15:00:00.000Z");
 });
 it("reads delivery times, the return window, refusal and return fees, VAT, the confirmation call and loyalty tiers",()=>{
  expect(facts("sa").delivery_time.value).toMatchObject({min_days:2,max_days:5});
  expect(facts("ae").delivery_time.value).toMatchObject({min_days:1,max_days:2});
  expect(facts("eg").delivery_time.value).toMatchObject({min_days:1,max_days:5});
  expect(facts("om").delivery_time).toBeUndefined(); // the page publishes none: nothing is invented
  expect(facts("sa").return_window.value).toMatchObject({days:7,defect_only:false});
  expect(facts("om").return_window.value).toMatchObject({days:15,defect_only:true});
  expect(facts("iq").return_window.value).toMatchObject({days:3});
  expect(facts("eg").return_window.value).toMatchObject({days:14});
  expect(facts("eg").refusal_fee.value).toEqual({fee_minor:500});
  expect(facts("eg").return_fee.value).toEqual({shipped_minor:500,delivered_minor:500});
  expect(facts("eg").return_rules.summary).toContain("Personal care");
  expect(facts("sa").vat.value).toEqual({on_added_profit_bps:1500});
  expect(facts("eg").confirmation.value).toMatchObject({call_from_hour:11,call_to_hour:21,attempts:7});
  expect(facts("om").confirmation.value).toMatchObject({call_from_hour:9,call_to_hour:17,attempts:7});
  expect(facts("eg").cod.value).toMatchObject({open_before_paying:false});
  expect(facts("sa").loyalty.value).toMatchObject({current:"Bronze",delivery_rate_needed_pct:25});
  expect((facts("eg").loyalty.value.tiers as {name:string}[]).map(t=>t.name)).toEqual(["Bronze","Silver","Gold","VIP"]);
  expect(facts("eg").loyalty.value.current).toBe("Silver");
 });
 it("never stores anything personal: account pages, personal API calls, emails and long numbers are dropped",()=>{
  const dirty=[{path:"/sa/info",title:"x",text:"Write to owner@example.com or call +966 50 123 4567. Shipping costs are 28 Saudi riyals to all regions.",links:["/sa/wallet","/sa/loyalty"],
   api:[{url:"/user/profile",status:200,json:{phone:"1"}},{url:"/shipping/zones?token=abc",status:200,json:{email:"a@b.co",zones:[{shippingFee:28,ownerName:"Rashid"}]}}]},
   {path:"/sa/account",title:"me",text:"my account page with a lot of text in it"},{path:"/eg/info",title:"wrong market",text:"this belongs to another market entirely"},{path:"/sa/help",error:"could not open"}];
  const clean=cleanPages("sa",dirty);
  expect(clean.map(p=>p.path)).toEqual(["/sa/info"]);
  expect(clean[0].text).toContain("[email]");expect(clean[0].text).toContain("[number]");expect(clean[0].text).not.toContain("owner@");
  expect(clean[0].links).toEqual(["/sa/loyalty"]);
  expect(clean[0].api).toEqual([{url:"/shipping/zones",status:200,json:{zones:[{shippingFee:28}]}}]);
 });
});

describe("where a page contradicts what we plan with",()=>{
 it("agrees in every market on the fixture except the facts our files do not hold yet",()=>{
  expect(contradictions("sa",Object.values(facts("sa")))).toEqual([]);
  expect(contradictions("ae",Object.values(facts("ae")))).toEqual([]);
  expect(contradictions("om",Object.values(facts("om")))).toEqual([]);
  // Iraq: the page gives a 3-day return window our customer copy does not state. Egypt: the page's delivery range starts at 1 day.
  expect(contradictions("iq",Object.values(facts("iq"))).map(c=>[c.key,c.known,c.page])).toEqual([["return_window","no return window in our customer copy","3 days"]]);
  expect(contradictions("eg",Object.values(facts("eg"))).map(c=>c.key)).toEqual(["delivery_time"]);
 });
 it("lists a changed fee with both figures, and plans with the dearer one until the owner decides",()=>{
  const page=[{path:"/sa/info",read_at:"2026-12-05T08:00:00Z",text:"Shipping prices in Saudi Arabia\nShipping costs are 32 Saudi riyals to all regions of the Kingdom."}];
  const f=extractMarketFacts("sa",cleanPages("sa",page));
  expect(contradictions("sa",f)).toEqual([{key:"delivery_fee",known:"28 SAR",page:"32 SAR",source_path:"/sa/info",source_read_at:"2026-12-05T08:00:00Z",costs_us_more:true}]);
  expect(startingDecision("sa",f[0])).toBe("pending");
  const waiting=effectiveMarket(MARKETS.sa,[{key:"delivery_fee",value:f[0].value,decision:"pending"}]);
  expect(waiting.shippingMinor).toBe(2800);expect(worstDeliveryFee(waiting)).toBe(3200);expect(waiting.factsNotes[0]).toContain("32 SAR");
  // Free delivery is checked against the dearer fee straight away: 80 SAR price, 40 cost, no VAT above a 80 floor.
  expect(profitDelivered(8000,{cost_minor:4000,floor_minor:8000},waiting,true)).toBe(800);
  expect(profitDelivered(8000,{cost_minor:4000,floor_minor:8000},MARKETS.sa,true)).toBe(1200);
  const confirmed=effectiveMarket(MARKETS.sa,[{key:"delivery_fee",value:f[0].value,decision:"confirmed"}]);
  expect(confirmed.shippingMinor).toBe(3200);expect(confirmed.factsNotes).toEqual([]);
  const rejected=effectiveMarket(MARKETS.sa,[{key:"delivery_fee",value:f[0].value,decision:"rejected"}]);
  expect(rejected.shippingMinor).toBe(2800);expect(worstDeliveryFee(rejected)).toBe(2800);
  // A cheaper fee on the page never lowers our planning figure before it is confirmed.
  const cheaper=effectiveMarket(MARKETS.sa,[{key:"delivery_fee",value:{flat_minor:2000},decision:"pending"}]);
  expect(worstDeliveryFee(cheaper)).toBe(2800);expect(cheaper.factsNotes).toEqual([]);
 });
 it("the brain plans Egypt with the real zones and charges, and delivery we pay for is counted at the dearest band",()=>{
  const eg=effectiveMarket(MARKETS.eg,stored("eg"));
  expect(eg.shippingZonesMinor).toEqual([9500,10000,10500]);expect(eg.shippingMinor).toBe(10000);expect(worstDeliveryFee(eg)).toBe(10500);expect(eg.refusalChargeMinor).toBe(500);
  expect(profitDelivered(50000,{cost_minor:20000,floor_minor:null},eg,true)).toBe(50000-20000-10500);
  expect(profitDelivered(50000,{cost_minor:20000,floor_minor:null},MARKETS.eg,true)).toBe(50000-20000-10500);
 });
});

describe("what reaches customers and the morning brief",()=>{
 it("gives customers only what is true for them: fee, delivery days, return window, cash on delivery",()=>{
  const eg=customerFacts(stored("eg",{delivery_time:"confirmed"}));
  expect(eg.delivery_fee_minor).toEqual([9500,10000,10500]);expect(eg.delivery_zones![0]).toEqual({places:["Cairo","Giza","Alexandria"],fee_minor:9500});
  expect(eg.delivery_days).toEqual({min:1,max:5});expect(eg.return_days).toBe(14);expect(eg.open_before_paying).toBe(false);
  expect(JSON.stringify(eg)).not.toMatch(/merchant|refus|loyalty|vat|taager/i);
  // A fact that waits for the owner is not shown to customers.
  expect(customerFacts(stored("eg")).delivery_days).toBeNull();expect(customerFacts(stored("iq")).return_days).toBeNull();
 });
 it("the brief flags changes since the last sync and every open contradiction",()=>{
  const s:StoredFact[]=[...stored("iq"),];
  const fee=s.find(f=>f.key==="delivery_fee")!;
  fee.value={flat_minor:8000000};fee.decision="pending";fee.changed_at="2026-12-05T08:00:00Z";fee.previous_value={flat_minor:7000000};fee.summary="Delivery fee 8000 IQD per order, everywhere in Iraq.";
  const b=rulesBrief("iq",s,"2026-12-04T00:00:00Z");
  expect(b.changes).toEqual([{what:"delivery fee changed: Delivery fee 8000 IQD per order, everywhere in Iraq.",source:"/iq/info",when:"2026-12-05T08:00:00Z"}]);
  expect(b.contradictions.map(c=>[c.what,c.ours,c.page,c.status])).toEqual([
   ["delivery fee","7000 IQD","8000 IQD","waiting for you; the dearer figure is already used for safety"],
   ["return window","no return window in our customer copy","3 days","waiting for you"]]);
  expect(b.planning_notes[0]).toContain("8000 IQD");
  expect(rulesBrief("iq",s,"2026-12-06T00:00:00Z").changes).toEqual([]);
  expect(rulesBrief("sa",stored("sa"),null)).toMatchObject({changes:[],contradictions:[],planning_notes:[],loyalty:expect.stringContaining("our account: Bronze")});
 });
});

import {daysPhrase,fetchPolicyFacts,parsePolicyFacts,policySentences} from "../lib/store/policy-facts";
import {storeFacts} from "../lib/seo/endpoints";
import {customerServiceCopy} from "../lib/store/customer-service-copy";
import {preparePages,changedLines} from "../lib/store/taager-pages";
describe("customer copy from confirmed facts, in each dialect",()=>{
 it("keeps our written sentences while the confirmed facts say the same or nothing",()=>{
  for(const m of ["sa","ae","om","eg","iq"] as const)expect(policySentences(m,null).changed).toEqual([]);
  const same=parsePolicyFacts({delivery_fee:{flat_minor:2800,zones:null},delivery_days:{min:2,max:5},returns:{days:7,defect_only:false}});
  expect(policySentences("sa",same)).toMatchObject({shipping:customerServiceCopy.sa.shipping,delivery:customerServiceCopy.sa.delivery,returns:customerServiceCopy.sa.returns,changed:[]});
  expect(policySentences("om",parsePolicyFacts({returns:{days:15,defect_only:true}})).changed).toEqual([]);
 });
 it("writes the confirmed number in the market's own words when it differs, and never names the supplier",()=>{
  const iq=policySentences("iq",parsePolicyFacts({delivery_fee:{flat_minor:8000000},delivery_days:{min:2,max:4},returns:{days:3,defect_only:false}}));
  expect(iq.changed).toEqual(["shipping","delivery","returns"]);
  expect(iq.shipping).toBe("أجرة التوصيل ٨٬٠٠٠ د.ع للطلب كله، بكل المحافظات.");
  expect(iq.delivery).toBe("التوصيل عادةً ياخذ ٢ إلى ٤ أيام بعد تأكيد الطلب.");
  expect(iq.returns).toBe("تگدرين ترجّعين المنتج خلال ٣ أيام. احتفظي برقم الطلب.");
  expect(policySentences("eg",parsePolicyFacts({delivery_days:{min:1,max:5}})).delivery).toBe("التوصيل عادةً بياخد ١ إلى ٥ أيام بعد تأكيد الطلب.");
  expect(policySentences("ae",parsePolicyFacts({returns:{days:14,defect_only:true}})).returns).toContain("١٤ يومًا");
  expect(daysPhrase("ae",1,2)).toBe("يوم إلى يومين");expect(daysPhrase("eg",14,14)).toBe("١٤ يوم");expect(daysPhrase("sa",2,2)).toBe("يومين");
  const facts=storeFacts("iq",parsePolicyFacts({delivery_fee:{flat_minor:8000000}}));
  expect(facts.shipping).toContain("٨٬٠٠٠");expect(facts.delivery).toBe(customerServiceCopy.iq.delivery);expect(JSON.stringify(facts)).not.toMatch(/taager|merchant/i);
 });
 it("reads the public facts through the RPC and treats any failure as no facts",async()=>{
  const ok=(async(_u:unknown,init?:RequestInit)=>{expect(JSON.parse(String(init!.body))).toEqual({p_store:"sa"});return new Response(JSON.stringify({delivery_fee:{flat_minor:3200,zones:null},delivery_days:null,returns:null}));}) as unknown as typeof fetch;
  expect((await fetchPolicyFacts("https://x.supabase.co","k","sa",ok))!.deliveryFeeMinor).toBe(3200);
  expect(await fetchPolicyFacts("https://x.supabase.co","k","sa",(async()=>new Response("no",{status:500})) as unknown as typeof fetch)).toBeNull();
  expect(await fetchPolicyFacts("https://x.supabase.co","k","sa",(async()=>{throw Error("down");}) as unknown as typeof fetch)).toBeNull();
  expect(parsePolicyFacts({delivery_fee:{flat_minor:-5},delivery_days:{min:9,max:2},returns:{days:"7"}})).toEqual({deliveryFeeMinor:null,deliveryZones:null,deliveryDays:null,returnDays:null,returnDefectOnly:false});
 });
});
describe("the owner's import of a v5 file",()=>{
 it("prepares every market's pages and facts from the file, with the decision each fact starts with",()=>{
  const file={source:"taager-merchant-sync",version:5,countries:[],pages:FIXTURE_TAAGER_PAGES};
  const prepared=preparePages(JSON.stringify(file));
  expect(prepared.map(p=>[p.market,p.pages.length])).toEqual([["sa",2],["ae",1],["om",1],["eg",3],["iq",1]]);
  expect(prepared.find(p=>p.market==="sa")!.facts.every(f=>f.decision==="agrees")).toBe(true);
  expect(prepared.find(p=>p.market==="iq")!.facts.filter(f=>f.decision==="pending").map(f=>f.key)).toEqual(["return_window"]);
  expect(preparePages({source:"taager-merchant-sync",version:4,countries:[]})).toEqual([]);expect(preparePages("not json")).toEqual([]);
  expect(changedLines("a\nShipping 28\nb","a\nShipping 32\nb")).toEqual({added:["Shipping 32"],removed:["Shipping 28"]});
 });
});
