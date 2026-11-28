import {describe,expect,it,vi} from "vitest";
import {MARKETS} from "../../supabase/functions/_shared/brain/markets";
import {bundleProposals,comboProfit,freeDeliveryPlan,proposeOffers,quantityProposals,worstDeliveryFee,type OfferListing} from "../../supabase/functions/_shared/brain/offers";
import {profitDelivered} from "../../supabase/functions/_shared/brain/economics";
import {offersClient} from "../lib/store/offers-client";

const sa=MARKETS.sa,iq=MARKETS.iq;
const L=(slug:string,category:string,price:number,cost:number,floor:number,rank:number,extra:Partial<OfferListing>={}):OfferListing=>({listing_id:"id-"+slug,slug,title:"منتج "+slug,category,price_minor:price,cost_minor:cost,floor_minor:floor,rank,...extra});
const shelf=[
 L("blender","kitchen",14900,7700,14000,1,{title:"خلاط كهربائي",quantity_offers:[{quantity:2,price_minor:25900},{quantity:3,price_minor:20000}]}),
 L("rack","organize",9900,5000,9000,2,{title:"رف تنظيم"}),L("lamp","home",8900,4500,8000,3,{title:"مصباح طاولة"}),
 L("serum","beauty",6900,3000,6000,4,{title:"سيروم شعر"}),L("mask","wellness",5900,2500,5000,5,{title:"قناع نوم"}),
 L("readyset","home",12900,10000,12000,6,{title:"طقم جاهز من المورد",is_bundle:true}),
];
describe("offer proposals never lose money",()=>{
 it("multi-piece profit counts the full cost of every piece and VAT on all of the profit (lowest case)",()=>{
  // 2 for 259 SAR: 25900 - 2*7700 = 10500; VAT 15% of 10500 = 1575 -> 8925 (the database test expects the same figure)
  expect(comboProfit([{cost_minor:7700,quantity:2}],25900,sa)).toBe(8925);
  expect(comboProfit([{cost_minor:7700,quantity:2}],25900,iq)).toBe(10500);
  expect(comboProfit([{cost_minor:7700,quantity:2}],25900,sa,true)).toBe(8925-2800);
 });
 it("keeps only quantity offers that are cheaper than singles and earn at least one single sale",()=>{
  const q=quantityProposals(shelf,sa);
  expect(q.map(x=>[x.quantity,x.price_minor])).toEqual([[2,25900]]); // 3 for 200 loses money (cost 231): dropped
  expect(q[0]!.profit_minor).toBeGreaterThanOrEqual(profitDelivered(14900,shelf[0]!,sa));
  expect(q[0]!.profit_usd).toBeCloseTo(23.8,1);
 });
 it("builds sets from single products in partner sections only, cheaper than singles, profitable even as two parcels",()=>{
  const sets=bundleProposals(shelf,sa);
  expect(sets.length).toBeGreaterThan(0);
  for(const s of sets){
   expect(s.items.some(i=>i.listing_id==="id-readyset")).toBe(false);
   expect(s.price_minor).toBeLessThan(s.separate_minor);
   expect(s.profit_minor).toBeGreaterThan(0);expect(s.profit_if_split_minor).toBeGreaterThan(0);
   expect(s.profit_if_split_minor).toBe(s.profit_minor-worstDeliveryFee(sa));
   expect(s.slug).toMatch(/^set-[a-z0-9-]+$/);
  }
  expect(sets[0]!.items.map(i=>i.listing_id)).toEqual(["id-blender","id-rack"]);
  const used=sets.flatMap(s=>s.items.map(i=>i.listing_id));expect(new Set(used).size).toBe(used.length);
 });
 it("sizes free delivery on the least profitable basket and refuses when margins are too thin",()=>{
  // A loss-making quantity offer on the shelf makes every basket unsafe until it is filtered out (proposeOffers does that).
  expect(freeDeliveryPlan(shelf,[],sa).plan).toBeNull();
  const plan=proposeOffers({market:sa,listings:shelf}).free_delivery;
  expect(plan).not.toBeNull();expect(plan!.worst_title).toBe("طقم جاهز من المورد");
  expect(plan!.worst_case_profit_minor).toBeGreaterThan(0);expect(plan!.typical_profit_minor).toBeGreaterThan(plan!.worst_case_profit_minor);
  expect(Math.floor(plan!.threshold_minor*plan!.worst_margin_bps/10000)-2800).toBeGreaterThan(0);
  // Iraq-like shelf: 2,000 IQD profit on 16,000 IQD items cannot pay a 7,000 IQD delivery fee on any reachable basket.
  const thin=[1,2,3,4,5].map(i=>L("iq"+i,"home",16000000,14000000,16000000,i));
  const none=freeDeliveryPlan(thin,[],iq);
  expect(none.plan).toBeNull();expect(none.reason).toMatch(/thinnest margin|4 typical/);
  expect(bundleProposals(thin,iq)).toEqual([]);
  expect(freeDeliveryPlan(shelf.slice(0,3),[],sa).plan).toBeNull();
  expect(worstDeliveryFee(MARKETS.eg)).toBe(10500);
 });
 it("proposeOffers returns the three kinds together and is deterministic",()=>{
  const a=proposeOffers({market:sa,listings:shelf}),b=proposeOffers({market:sa,listings:[...shelf].reverse()});
  expect(a.quantity).toHaveLength(1);expect(a.bundles.length).toBeGreaterThan(0);expect(a.free_delivery).not.toBeNull();
  expect(b.bundles.map(x=>x.slug)).toEqual(a.bundles.map(x=>x.slug));
 });
});
describe("owner offers client",()=>{
 it("reads inputs, saves proposals as rows without costs, and needs a signed-in owner",async()=>{
  const calls:{fn:string;body:Record<string,unknown>}[]=[];
  const request=vi.fn(async(url:URL|RequestInfo,init?:RequestInit)=>{const fn=String(url).split("/rpc/")[1]!;const body=JSON.parse(String(init?.body));calls.push({fn,body});
   if(fn==="brain_offer_inputs")return Response.json({facts:{},listings:shelf});
   if(fn==="brain_offers_list")return Response.json([]);
   return Response.json({saved:3});}) as unknown as typeof fetch;
  const client=offersClient("https://x.supabase.co","pk","jwt",request);
  const p=await client.propose("sa");
  expect(p.quantity).toHaveLength(1);
  const saved=calls.find(c=>c.fn==="brain_offers_save")!;
  expect(saved.body["p_store"]).toBe("sa");
  expect(JSON.stringify(saved.body)).not.toMatch(/cost|profit|floor/);
  expect((saved.body["p_proposals"] as {kind:string}[]).map(r=>r.kind).sort()).toEqual(expect.arrayContaining(["bundle","free_delivery","quantity"]));
  expect((init=>init)(request.mock.calls[0]![1] as RequestInit).headers).toMatchObject({authorization:"Bearer jwt"});
  expect(()=>offersClient("https://x.supabase.co","pk","")).toThrow();
  expect(()=>offersClient("http://x.supabase.co","pk","jwt")).toThrow();
 });
});
