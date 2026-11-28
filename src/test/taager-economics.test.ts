import {describe,expect,it} from "vitest";
import {MARKETS} from "../../supabase/functions/_shared/brain/markets";
import {profitDelivered} from "../../supabase/functions/_shared/brain/economics";
import {demandFactor,demandSignals,nearDuplicates,quantityOffersDual,salePlan,setCostIfTaager,setProfitDual,stockLow,stockVelocity,taagerFacts,tierCost,titleOverlap,SALE_SAFETY_DAYS} from "../../supabase/functions/_shared/brain/taager-economics";
import {BUNDLE_THEMES,orderPictures,parsePictureVerdicts,picturePrompt,themedBundles,type BundleListing} from "../../supabase/functions/_shared/brain/bundles";
import {deliveryIncludedProposals,freeDeliveryPlan,proposeOffers,quantityProposals,saleProposals,type OfferListing} from "../../supabase/functions/_shared/brain/offers";
import {normalizeTaager} from "../../supabase/functions/_shared/brain/taager-normalize";
import {prefilter} from "../../supabase/functions/_shared/brain/selection";
import {TAAGER_MAPPING} from "../../supabase/functions/_shared/brain/taager-normalize";

const sa=MARKETS.sa,DAY=86_400_000,now=Date.parse("2026-11-28T08:00:00Z");
// The verified Saudi example: 1 piece costs 115, 2 pieces cost 134 (price 174, profit 40), sale cost 80 until 31 Dec.
const meta={taager_tiers:[{quantity:1,price_minor:14500,profit_minor:3000},{quantity:2,price_minor:17400,profit_minor:4000},{quantity:3,price_minor:23600,profit_minor:5000},{quantity:4,price_minor:29800,profit_minor:6000}],
 taager_upsell_discounts:[{type:"second_confirmation",price_minor:8000,profit_minor:500},{type:"second_placement",price_minor:8000,profit_minor:500}],
 taager_sale:{price_minor:11000,profit_minor:3000,starts_at:"2026-11-24T22:00:00",expires_at:"2026-12-31T19:59:59.999"}};
const inp={cost_minor:11500,floor_minor:14500};

describe("Taager's own quantity, add-on and sale prices",()=>{
 it("reads total cost per quantity (price - profit), the add-on cost and the sale, and never the call-centre price",()=>{
  const f=taagerFacts(meta);
  expect(f.tiers.map(t=>[t.quantity,t.cost_minor])).toEqual([[2,13400],[3,18600],[4,23800]]);
  expect(f.addon).toEqual({price_minor:8000,cost_minor:7500});
  expect(f.sale).toMatchObject({cost_minor:8000,expires_at:"2026-12-31T19:59:59.999"});
  expect(tierCost(f,2,11500)).toBe(13400);
  expect(tierCost({tiers:[{quantity:3,price_minor:40000,cost_minor:39000}]},3,7700)).toBeNull(); // dearer than singles: supplier noise
  expect(taagerFacts(null)).toEqual({tiers:[],addon:null,sale:null});
  expect(taagerFacts({taager_tiers:[{quantity:2,price_minor:100,profit_minor:200}],taager_sale:{price_minor:5,profit_minor:null}})).toEqual({tiers:[],addon:null,sale:null});
 });
 it("until the market is proven every quantity offer earns at least one single sale at FULL cost, and reports both figures",()=>{
  const offers=quantityOffersDual(19900,inp,taagerFacts(meta),sa,false);
  const single=profitDelivered(19900,inp,sa);
  expect(offers.length).toBeGreaterThan(0);
  for(const o of offers){
   expect(o.basis).toBe("full_cost");expect(o.profit_delivered_minor).toBe(o.profit_full_minor);
   expect(o.profit_full_minor).toBeGreaterThanOrEqual(single);
   expect(o.profit_if_taager_minor).toBeGreaterThan(o.profit_full_minor);
   expect(o.price_minor).toBeLessThan(o.quantity*19900);
  }
 });
 it("once proven the shopper gets part of Taager's saving and the check uses Taager's quantity cost",()=>{
  const safe=quantityOffersDual(19900,inp,taagerFacts(meta),sa,false),proven=quantityOffersDual(19900,inp,taagerFacts(meta),sa,true);
  const two=(l:typeof safe)=>l.find(o=>o.quantity===2)!;
  expect(two(proven).price_minor).toBeLessThan(two(safe).price_minor);
  expect(two(proven).basis).toBe("taager_price");
  expect(two(proven).profit_delivered_minor).toBe(two(proven).profit_if_taager_minor);
  expect(two(proven).profit_if_taager_minor).toBeGreaterThanOrEqual(profitDelivered(19900,inp,sa));
  // No tier for a quantity: nothing changes when proven; four pieces only where Taager prices four.
  expect(quantityOffersDual(19900,inp,{tiers:[]},sa,true)).toEqual(quantityOffersDual(19900,inp,{tiers:[]},sa,false));
  expect(quantityOffersDual(19900,inp,{tiers:[]},sa).some(o=>o.quantity===4)).toBe(false);
  expect(quantityOffersDual(11000,inp,taagerFacts(meta),sa,true)).toEqual([]); // priced below cost: nothing
 });
 it("a mixed set keeps one piece at full cost and counts the others at their add-on cost",()=>{
  expect(setCostIfTaager([{cost_minor:7700,quantity:1,addon_cost_minor:7500},{cost_minor:5000,quantity:1},{cost_minor:10000,quantity:1}])).toBe(22500);
  // every piece has an add-on price: the smallest saving is not used (one piece is the first product)
  expect(setCostIfTaager([{cost_minor:10000,quantity:1,addon_cost_minor:6000},{cost_minor:5000,quantity:1,addon_cost_minor:4000}])).toBe(11000);
  expect(setProfitDual([{cost_minor:7700,quantity:1,addon_cost_minor:7500},{cost_minor:5000,quantity:1},{cost_minor:10000,quantity:1}],29900,sa)).toEqual({profit_full_minor:6120,profit_if_taager_minor:6290,basis:"full_cost"});
 });
});

describe("Taager sales: bank the margin or pass part of it on",()=>{
 const sale=taagerFacts(meta).sale!;
 it("passes half on when we are dearer, ending 3 days before Taager's sale, profitable at the regular cost",()=>{
  const p=salePlan({price_minor:19900,inputs:inp,sale,positioning:"dearer",m:sa,now})!;
  expect(p.action).toBe("time_limited_offer");
  expect(Date.parse(p.offer!.ends_at)).toBe(Date.parse("2026-12-31T19:59:59.999Z")-SALE_SAFETY_DAYS*DAY);
  expect(p.offer!.price_minor).toBeLessThanOrEqual(19900-1750);expect(p.offer!.price_minor).toBeLessThanOrEqual(Math.floor(19900*0.95));
  expect(p.offer!.profit_full_minor).toBeGreaterThan(0);expect(p.offer!.profit_if_taager_minor).toBeGreaterThan(p.offer!.profit_full_minor);
  expect(p.banked_profit_minor).toBeGreaterThan(p.normal_profit_minor);
 });
 it("keeps the price when already cheaper, when the sale has no end date, or when it ends too soon",()=>{
  expect(salePlan({price_minor:19900,inputs:inp,sale,positioning:"cheaper",m:sa,now})!.action).toBe("keep_price");
  expect(salePlan({price_minor:19900,inputs:inp,sale:{...sale,expires_at:null},positioning:"dearer",m:sa,now})!.reason).toMatch(/no end date/);
  expect(salePlan({price_minor:19900,inputs:inp,sale:{...sale,expires_at:"2026-12-02T08:00:00"},positioning:"dearer",m:sa,now})!.reason).toMatch(/too soon/);
  expect(salePlan({price_minor:19900,inputs:inp,sale:{...sale,expires_at:"2026-11-20T00:00:00"},m:sa,now})).toBeNull(); // over
  expect(salePlan({price_minor:19900,inputs:inp,sale:{...sale,starts_at:"2026-12-05T00:00:00"},m:sa,now})).toBeNull(); // not started
  expect(salePlan({price_minor:19900,inputs:inp,sale:{...sale,cost_minor:12000},m:sa,now})).toBeNull(); // not cheaper for us
  expect(salePlan({price_minor:19900,inputs:inp,sale:null,m:sa,now})).toBeNull();
 });
 it("never proposes an offer that loses at the regular cost unless the market is proven",()=>{
  // Our price barely above cost: a 5% cut would lose at the regular cost (11500) but earn at the sale cost (8000).
  const thin=salePlan({price_minor:11900,inputs:inp,sale,positioning:"dearer",m:sa,now})!;
  expect(thin.action).toBe("keep_price");
  const proven=salePlan({price_minor:11900,inputs:inp,sale,positioning:"dearer",m:sa,now,proven:true})!;
  expect(proven.action).toBe("time_limited_offer");expect(proven.offer!.profit_if_taager_minor).toBeGreaterThan(0);expect(proven.offer!.basis).toBe("taager_price");
 });
});

describe("demand signals",()=>{
 it("reads stock buckets and turns falling stock between syncs into pieces per day (restocks ignored)",()=>{
  expect([stockLow("from_200_to_210"),stockLow("less_than_10"),stockLow("more_than_1000"),stockLow("not_available"),stockLow("soon"),stockLow(5)]).toEqual([200,0,1000,0,null,null]);
  const at=(d:number)=>new Date(now-d*DAY).toISOString();
  expect(stockVelocity([{at:at(4),low:300},{at:at(2),low:240},{at:at(1),low:400},{at:at(0),low:380}],now)).toBe(20); // 60 + 20 sold over 4 days; the rise is a restock
  expect(stockVelocity([{at:at(0.2),low:300},{at:at(0),low:100}],now)).toBeNull(); // less than a day apart
  expect(stockVelocity([{at:at(30),low:300},{at:at(0),low:100}],now)).toBeNull(); // outside the window: one reading left
 });
 it("lifts ranking for fast movers, good confirmation and new arrivals; no data never pushes a product down",()=>{
  expect(demandFactor(demandSignals({now}))).toBe(1);
  const hot=demandSignals({history:[{at:new Date(now-2*DAY).toISOString(),low:300},{at:new Date(now).toISOString(),low:200}],confirmationRate:0.9,createdAt:"2026-11-20T10:00:00",now});
  expect(hot).toMatchObject({velocity_per_day:50,confirmation_rate_bps:9000,is_new:true});
  expect(demandFactor(hot)).toBe(1.45);
  expect(demandFactor(demandSignals({confirmationRate:0.3,now}))).toBe(0.85);
  expect(demandSignals({confirmationRate:0,createdAt:"2025-01-01T00:00:00",now})).toMatchObject({confirmation_rate_bps:null,is_new:false});
 });
 it("the shortlist ranks an in-demand product above an identical quiet one and records the signals",()=>{
  const row=(sku:string,id:number,name:string,conf:number)=>({market:"sa",sku,product_id:id,variant_id:0,item_type:"product",name,alternatives:null,
   listing:{financials:{price:140,originalPrice:77,profit:63},createdAt:"2026-01-01T00:00:00"},
   detail:{name,active:true,variant:{sku,images:["https://media.taager.com/"+sku+"a.jpg","https://media.taager.com/"+sku+"b.jpg","https://media.taager.com/"+sku+"c.jpg"],description:"وصف ".repeat(80),financials:{price:140,originalPrice:77,profit:63},availability:"available",analytics:{confirmationRate:conf,deliveryRate:0.5}}}});
  const offers=[row("QUIET1",1,"خلاط عصير محمول للمطبخ",0),row("HOT001",2,"مصباح طاولة للمنزل بإضاءة دافئة",0.95)].map(r=>normalizeTaager("sa",sa,r as never,now));
  const hist=new Map([["HOT001",[{at:new Date(now-3*DAY).toISOString(),low:500},{at:new Date(now).toISOString(),low:380}]]]);
  const rows=prefilter(offers,TAAGER_MAPPING,sa,10,{stockHistory:hist,now});
  const hot=rows.find(r=>r.product_id===2)!,quiet=rows.find(r=>r.product_id===1)!;
  expect(hot.prefilter_score).toBeGreaterThan(quiet.prefilter_score);
  expect((hot.economics as {demand:{velocity_per_day:number;factor:number}}).demand).toMatchObject({velocity_per_day:40,factor:1.4});
 });
});

describe("near-identical products under different Taager ids",()=>{
 it("keeps the strongest of each group: Taager's exact alternative, the same picture, or near-identical titles at a similar cost",()=>{
  const d=nearDuplicates([
   {key:"1",sku:"A",title:"سيارة أطفال كهربائية بريموت أحمر",cost_minor:40000,score:9},
   {key:"2",sku:"B",title:"سيارة اطفال كهربائيه بريموت ازرق",cost_minor:42000,score:7},
   {key:"3",sku:"C",title:"سيارة أطفال كهربائية بريموت",cost_minor:90000,score:6}, // same words, very different cost: kept
   {key:"4",sku:"D",title:"خلاط محمول",cost_minor:5000,score:5,alternatives:[{sku:"D",alternatives:[{sku:"E"}]}]},
   {key:"5",sku:"E",title:"عصارة سفر صغيرة",cost_minor:9000,score:4},
   {key:"6",sku:"F",title:"منظم ادراج",cost_minor:2000,score:3,first_image:"https://m/x.jpg"},
   {key:"7",sku:"G",title:"صندوق ترتيب",cost_minor:8000,score:2,first_image:"https://m/x.jpg"},
  ]);
  expect([...d]).toEqual([["2","1"],["5","4"],["7","6"]]);
  expect(titleOverlap("خلاط","خلاط كهربائي")).toBe(0); // one word is not evidence
 });
 it("the prefilter excludes the twin with a reason before paid research",()=>{
  const row=(sku:string,id:number,name:string,profit:number)=>({market:"sa",sku,product_id:id,variant_id:0,item_type:"product",name,alternatives:null,listing:{financials:{price:100+profit,originalPrice:100,profit}},
   detail:{name,active:true,variant:{sku,images:["https://media.taager.com/"+sku+".jpg"],description:"x",financials:{price:100+profit,originalPrice:100,profit},availability:"available"}}});
  const rows=prefilter([row("CAR1",1,"سيارة أطفال كهربائية بريموت تحكم أحمر",60),row("CAR2",2,"سيارة أطفال كهربائية بريموت تحكم أزرق",40)].map(r=>normalizeTaager("sa",sa,r as never,now)),TAAGER_MAPPING,sa,10,{now});
  expect(rows.find(r=>r.product_id===1)!.stage).toBe("shortlisted");
  // (a twin in the same title family is reported as family; this pair differs after the 7th word)
  expect(rows.find(r=>r.product_id===2)).toMatchObject({stage:"excluded",reasons:expect.arrayContaining(["near_duplicate_of:1:0"])});
 });
});

const B=(slug:string,title:string,category:string,price:number,cost:number,rank:number,extra:Partial<BundleListing>={}):BundleListing=>({listing_id:"id-"+slug,slug,title,category,price_minor:price,cost_minor:cost,floor_minor:null,rank,...extra});
describe("brain-made themed bundles",()=>{
 const shelf=[B("curl","جهاز تجعيد الشعر","beauty",16900,7000,1),B("comb","مشط فك التشابك","beauty",5900,2000,2),B("oil","زيت شعر بالأعشاب","beauty",8900,3500,3,{addon_cost_minor:2500}),
  B("botox","كريم بديل البوتوكس","beauty",11900,5000,4),B("ready","باقة تجعيد الشعر الجاهزة","beauty",19900,9000,5,{is_bundle:true}),B("lamp","مصباح طاولة","home",9900,4000,6)];
 it("builds a 2-4 piece routine from published single products in the theme's sections, never a supplier bundle",()=>{
  const [set]=themedBundles(shelf,sa,{splitFeeMinor:2800});
  expect(set).toBeDefined();
  expect(set!.theme).toBe("hair-care");expect(set!.title).toBe("روتين العناية بالشعر");expect(set!.slug).toBe("routine-hair-care-3");
  expect(set!.items.map(i=>i.listing_id)).toEqual(["id-curl","id-comb","id-oil"]); // "توك" inside "البوتوكس" is not a hair accessory
  expect(set!.price_minor).toBeLessThanOrEqual(Math.floor(set!.separate_minor*0.95));
  expect(set!.profit_full_minor).toBeGreaterThanOrEqual(profitDelivered(16900,shelf[0]!,sa));
  expect(set!.profit_if_split_minor).toBe(set!.profit_minor-2800);expect(set!.profit_if_split_minor).toBeGreaterThan(0);
  expect(set!.profit_if_taager_minor).toBeGreaterThan(set!.profit_full_minor); // the oil's add-on price
 });
 it("proposes nothing when the numbers do not work, and every theme name is Arabic with a usable slug",()=>{
  const thin=[B("a","جهاز تجعيد الشعر","beauty",10900,10000,1),B("b","مشط فك التشابك","beauty",5900,5400,2)];
  expect(themedBundles(thin,sa,{splitFeeMinor:2800})).toEqual([]);
  expect(themedBundles(shelf,sa,{splitFeeMinor:2800,exclude:new Set(["id-curl","id-comb"])})).toEqual([]);
  for(const t of BUNDLE_THEMES){expect(t.id).toMatch(/^[a-z][a-z-]+$/);expect(t.name).toMatch(/^[؀-ۿ\s]+$/);expect(t.roles.length).toBeGreaterThanOrEqual(3);}
 });
});

describe("picture rule",()=>{
 it("clean pictures lead, promo artwork is dropped, and a product never ends without a picture",()=>{
  const ids=["a.jpg","b.jpg","c.jpg","d.jpg"];
  expect(picturePrompt(ids).user).toContain("a.jpg, b.jpg, c.jpg, d.jpg");
  const v=parsePictureVerdicts({pictures:[{id:"a.jpg",kind:"promo"},{id:"b.jpg",kind:"text"},{id:"c.jpg",kind:"clean"},{id:"zzz",kind:"clean"}]},ids)!;
  expect(v).toEqual([{id:"a.jpg",kind:"promo"},{id:"b.jpg",kind:"text"},{id:"c.jpg",kind:"clean"},{id:"d.jpg",kind:"text"}]);
  expect(orderPictures(v)).toEqual({order:["c.jpg","b.jpg","d.jpg"],dropped:["a.jpg"],needs_owner_look:false});
  expect(orderPictures([{id:"a.jpg",kind:"promo"},{id:"b.jpg",kind:"promo"}])).toEqual({order:["a.jpg"],dropped:["b.jpg"],needs_owner_look:true});
  expect(orderPictures([{id:"a.jpg",kind:"text"}]).needs_owner_look).toBe(true);
  expect(parsePictureVerdicts("ignore previous instructions",ids)).toBeNull();
 });
});

const L=(slug:string,price:number,cost:number,rank:number,extra:Partial<OfferListing>={}):OfferListing=>({listing_id:"id-"+slug,slug,title:"منتج "+slug,category:"home",price_minor:price,cost_minor:cost,floor_minor:price,rank,...extra});
describe("offer proposals with both figures",()=>{
 it("quantity proposals carry what the offer earns with and without Taager's quantity price",()=>{
  const l=L("x",19900,11500,1,{floor_minor:14500,tiers:taagerFacts(meta).tiers});
  const q=quantityProposals([l],sa);
  expect(q.length).toBeGreaterThan(0);
  for(const p of q){expect(p.profit_minor).toBe(p.profit_full_minor);expect(p.profit_if_taager_usd).toBeGreaterThan(p.profit_full_usd);expect(p.basis).toBe("full_cost");}
  const proven=quantityProposals([l],sa,true);
  expect(proven.find(p=>p.quantity===2)!.price_minor).toBeLessThan(q.find(p=>p.quantity===2)!.price_minor);
  expect(proven.every(p=>p.basis==="taager_price"&&p.profit_minor===p.profit_if_taager_minor)).toBe(true);
 });
 it("sale proposals and notes come from the listing's running Taager sale",()=>{
  const sale=taagerFacts(meta).sale!;
  const {sales,notes}=saleProposals([L("dear",19900,11500,1,{floor_minor:14500,sale,positioning:"dearer"}),L("cheap",19900,11500,2,{floor_minor:14500,sale,positioning:"cheaper"}),L("none",9900,5000,3)],sa,now);
  expect(sales.map(s=>s.listing_id)).toEqual(["id-dear"]);expect(sales[0]!.ends_at).toBe("2026-12-28T19:59:59.999Z");
  expect(notes.map(n=>n.listing_id)).toEqual(["id-cheap"]);expect(notes[0]!.banked_profit_usd).toBeGreaterThan(notes[0]!.normal_profit_usd);
 });
});

describe("free delivery: eligible products only",()=>{
 // Margins: 40% x4, 30%, 6% (thin).
 const shelf=[L("a",10000,6000,1),L("b",12000,7200,2),L("c",9000,5400,3),L("d",15000,9000,4),L("e",10000,7000,5),L("thin",10000,9400,6)];
 it("sizes the threshold on the thinnest ELIGIBLE product and leaves thin products out instead of giving up",()=>{
  const {plan}=freeDeliveryPlan(shelf,[],MARKETS.ae);
  expect(plan).not.toBeNull();
  expect(plan!.excluded.map(x=>x.listing_id)).toEqual(["id-thin"]);expect(plan!.eligible).toBe(5);
  expect(plan!.min_margin_bps).toBe(3000);
  // every eligible basket at the threshold pays the 19 AED fee and keeps about $1
  expect(Math.floor(plan!.threshold_minor*plan!.min_margin_bps/10000)-1900).toBe(plan!.worst_case_profit_minor);
  expect(plan!.worst_case_profit_minor).toBeGreaterThanOrEqual(367);
  expect(plan!.threshold_minor).toBeGreaterThanOrEqual(15000); // above a typical single purchase
  expect(plan!.threshold_minor%5000).toBe(0);
 });
 it("offers nothing when even the better products cannot pay the fee on a reachable basket, or with too few products",()=>{
  const iq=MARKETS.iq,thin=[1,2,3,4,5,6].map(i=>L("iq"+i,16000000,14000000,i));
  const none=freeDeliveryPlan(thin,[],iq);
  expect(none.plan).toBeNull();expect(none.reason).toMatch(/too thin/);
  expect(freeDeliveryPlan(shelf.slice(0,3),[],sa).plan).toBeNull();
 });
 it("Egypt uses its dearest delivery band, and delivery-included needs real room in the price",()=>{
  const eg=MARKETS.eg,egShelf=[1,2,3,4,5].map(i=>L("eg"+i,60000,36000,i));
  const {plan}=freeDeliveryPlan(egShelf,[],eg);
  expect(plan!.worst_case_profit_minor).toBe(Math.floor(plan!.threshold_minor*0.4)-10500);
  const inc=deliveryIncludedProposals([L("room",20000,9000,1),L("tight",9000,6500,2),L("bundle",30000,9000,3,{is_bundle:true})],MARKETS.ae);
  expect(inc.map(d=>d.listing_id)).toEqual(["id-room"]);expect(inc[0]!.profit_minor).toBe(11000-1900);
 });
 it("proposeOffers returns every kind and says whether Taager's prices were used",()=>{
  const p=proposeOffers({market:MARKETS.ae,listings:shelf,now});
  expect(p.taager_discounts_proven).toBe(false);expect(p.free_delivery).not.toBeNull();expect(p.sales).toEqual([]);expect(Array.isArray(p.delivery_included)).toBe(true);
  expect(proposeOffers({market:MARKETS.ae,listings:shelf,now,proven:true}).taager_discounts_proven).toBe(true);
 });
});
