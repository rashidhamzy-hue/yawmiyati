import {riskCheck as riskCheckForTest} from "../../supabase/functions/_shared/brain/selection.ts";
import {describe,expect,it} from "vitest";
import {MARKETS,decimalToMinor,minorToDecimal,usdToMinor} from "../../supabase/functions/_shared/brain/markets.ts";
import {normalizeWoo,findVideos,flattenMeta} from "../../supabase/functions/_shared/brain/woo-normalize.ts";
import {capabilityReport,economicsInputs,familyKey,heuristicMapping,offerKind,titleClaimedPieces} from "../../supabase/functions/_shared/brain/catalog-analysis.ts";
import {decidePrice,expectedPerOrder,floorMinor,freeDeliveryThreshold,marginBps,marketReference,netPerDelivered,pricePoints,profitDelivered,quantityOffers,reprice,undeliveredCostPerDelivered} from "../../supabase/functions/_shared/brain/economics.ts";
import {audienceCheck,mapCategory,prefilter,riskCheck,selectFinal,merchandise} from "../../supabase/functions/_shared/brain/selection.ts";
import {costOf,extractJson,estimateMax} from "../../supabase/functions/_shared/brain/anthropic.ts";
import {contentPrompt,evidenceRows,parseContent,parseResearch,parseMapping,researchPrompt} from "../../supabase/functions/_shared/brain/prompts.ts";

const sa=MARKETS.sa;
const woo=(over:Record<string,unknown>={})=>({id:101,name:"خفاقة حليب كهربائية",type:"simple",status:"publish",sku:"TG-101",price:"89.00",regular_price:"89.00",sale_price:"",
 stock_status:"instock",categories:[{id:1,name:"المطبخ",slug:"kitchen"}],images:[{src:"https://cdn.taager.com/a.jpg"},{src:"https://cdn.taager.com/b.jpg"},{src:"https://cdn.taager.com/c.jpg"}],
 attributes:[],meta_data:[{key:"taager_price",value:"45"},{key:"min_selling_price",value:"79"},{key:"product_video",value:"https://videos.taager.com/v/1.mp4"}],
 description:"<p>خفاقة حليب لتحضير الرغوة للقهوة في ثوان، تعمل بالبطارية وسهلة التنظيف ومناسبة للقهوة والشاي بالحليب والمشروبات الباردة والساخنة في المنزل والمكتب.</p>".repeat(2),...over});

describe("money",()=>{
 it("parses supplier prices exactly",()=>{
  expect(decimalToMinor("89.50",2)).toBe(8950);
  expect(decimalToMinor("1,234.00",2)).toBe(123400);
  expect(decimalToMinor("٧٩",2)).toBe(7900);
  expect(decimalToMinor("3.5",3)).toBe(3500);
  expect(decimalToMinor("12.345",2)).toBe(1235);
  expect(decimalToMinor("",2)).toBeNull();
  expect(decimalToMinor("abc",2)).toBeNull();
  expect(minorToDecimal(7000000,3)).toBe("7000");
 });
});

describe("WooCommerce normalisation",()=>{
 it("keeps everything and extracts images, videos, meta and prices",async()=>{
  const o=await normalizeWoo("sa",sa,woo());
  expect(o.price_minor).toBe(8900);expect(o.sale_price_minor).toBeNull();
  expect(o.images).toHaveLength(3);expect(o.videos[0].url).toContain("1.mp4");
  expect(o.meta.taager_price).toBe("45");expect(o.revision).toMatch(/^[0-9a-f]{64}$/);
 });
 it("variations inherit the parent title, images and categories",async()=>{
  const parent=woo({id:200,type:"variable",name:"منظم أدراج"});
  const v=await normalizeWoo("sa",sa,{id:201,sku:"TG-201-L",price:"59",attributes:[{name:"المقاس",option:"كبير"}],image:{src:""},meta_data:[]},parent);
  expect(v.product_id).toBe(200);expect(v.variation_id).toBe(201);expect(v.title).toBe("منظم أدراج — كبير");
  expect(v.images).toHaveLength(3);expect(v.categories[0].slug).toBe("kitchen");
 });
 it("finds videos in descriptions and ignores junk",()=>{
  expect(findVideos({},'<iframe src="https://www.youtube.com/embed/abc123"></iframe>')[0].host).toBe("youtube.com");
  expect(findVideos({x:"not a video"},null)).toEqual([]);
  expect(flattenMeta([{key:"a",value:1},{key:"a",value:2},{key:"_edit_lock",value:"x"}])).toEqual({a:[1,2]});
 });
});

describe("capability audit, families and offer kinds",()=>{
 it("reads piece claims from titles but never treats them as verified",async()=>{
  expect(titleClaimedPieces("عرض 3 قطع منظف")).toBe(3);
  expect(titleClaimedPieces("طقم قطعتين")).toBe(2);
  expect(titleClaimedPieces("خفاقة حليب")).toBeNull();
  const o=await normalizeWoo("sa",sa,woo({name:"منظف بالوعات 3 قطع"}));
  expect(offerKind(o,{}).kind).toBe("title_claims_multipack");
  expect(offerKind({...o,meta:{...o.meta,pieces:"3"}},{quantity_key:"pieces"}).kind).toBe("verified_multipack");
 });
 it("puts 1/2/3-packs of the same thing in one potential family",async()=>{
  const a=await normalizeWoo("sa",sa,woo({name:"منظف بالوعات قوي"}));
  const b=await normalizeWoo("sa",sa,woo({id:2,name:"منظف بالوعات قوي 3 قطع"}));
  expect(familyKey(a)).toBe(familyKey(b));
  const c=await normalizeWoo("sa",sa,woo({id:3,name:"منظم 3 طبقات"}));const d=await normalizeWoo("sa",sa,woo({id:4,name:"منظم 4 طبقات"}));
  expect(familyKey(c)).not.toBe(familyKey(d));
 });
 it("maps Taager price fields heuristically and produces a full report",async()=>{
  const offers=await Promise.all([woo(),woo({id:2,sku:"TG-101"}),woo({id:3,name:"باقة عرض المطبخ",categories:[{id:9,name:"Home Bundles",slug:"home-bundles"}]})].map(p=>normalizeWoo("sa",sa,p)));
  const r=capabilityReport(offers,sa);
  expect(r.field_mapping.cost_key).toBe("taager_price");
  expect(r.field_mapping.floor_key).toBe("min_selling_price");
  expect(r.sku.duplicate_skus).toBe(1);
  expect(r.media.offers_with_video).toBe(3);
  expect(r.bundles_and_packs.bundle_like_categories).toContain("Home Bundles");
  expect(r.offer_kinds.bundle_unverified).toBe(1);
  const e=economicsInputs(offers[0],r.field_mapping,sa);
  expect(e).toMatchObject({cost_minor:4500,floor_minor:7900});
 });
 it("never assumes the Woo price is Taager's floor without a mapping",()=>{
  const m=heuristicMapping({foo:{count:3,numericShare:1}});
  expect(m.floor_key).toBeUndefined();
  expect(m.notes!.join(" ")).toMatch(/NOT assumed/);
 });
});

describe("Taager economics",()=>{
 it("matches Taager's published model including Saudi VAT on added profit",()=>{
  const inp={cost_minor:10000,floor_minor:17000};
  expect(profitDelivered(17000,inp,sa)).toBe(7000);           // spread at the minimum
  expect(profitDelivered(19000,inp,sa)).toBe(7000+2000-300);  // 15% of the 20 SAR added
  expect(profitDelivered(19000,inp,MARKETS.ae)).toBe(9000);    // no VAT rule published for UAE
  expect(profitDelivered(17000,inp,sa,true)).toBe(7000-2800);  // free delivery absorbs 28 SAR
  expect(profitDelivered(16000,inp,sa)).toBe(6000);           // below Taager's minimum: no added profit, no VAT
  expect(profitDelivered(9000,inp,sa)).toBe(-1000);           // a loss is reported, never hidden
  expect(expectedPerOrder(7000,7500,sa)).toBe(5250);
  expect(expectedPerOrder(7000,6500,MARKETS.eg)).toBe(Math.floor((7000*6500-500*3500)/10000));
 });
 it("offers shopper-friendly price points per currency",()=>{
  expect(pricePoints(7900,13000,sa).map(v=>v/100)).toEqual([79,89,99,109,119,129]);
  const om=pricePoints(4200,6000,MARKETS.om);expect(om[0]).toBe(4200);expect(om.slice(1).every(v=>v%1000===500||v%1000===900)).toBe(true);
  expect(pricePoints(25000000,26000000,MARKETS.iq).every(v=>v%500000===0)).toBe(true);
 });
 it("prices against cited competitors and never at a loss",()=>{
  const d=decidePrice({inputs:{cost_minor:4500,floor_minor:7900,suggested_minor:null},m:sa,competitors:[
   {retailer:"amazon.sa",url:"https://amazon.sa/x",price_minor:14900,match:"exact",confidence:0.9},
   {retailer:"noon",url:"https://noon.com/x",price_minor:13900,match:"exact",confidence:0.8}]});
  expect(d.state).toBe("priced");
  expect(d.price_minor!).toBeGreaterThan(4500);
  expect(d.customer_total_minor).toBe(d.price_minor!+(d.delivery_included?0:2800));
  expect(d.competitor_basis).toBe("exact");
  expect(d.profit_delivered_minor!).toBeGreaterThan(0);
  expect(decidePrice({inputs:{cost_minor:null,floor_minor:7900,suggested_minor:null},m:sa,competitors:[]}).state).toBe("blocked");
  const none=decidePrice({inputs:{cost_minor:4500,floor_minor:7900,suggested_minor:null},m:sa,competitors:[]});
  expect(none.price_minor).toBe(7900);expect(none.needs_owner_review).toBe(true);
  const sug=decidePrice({inputs:{cost_minor:4500,floor_minor:7900,suggested_minor:9900},m:sa,competitors:[]});
  expect(sug.price_minor).toBe(8900); // Taager's default (99) would be a 51% margin: moved to the top of the band
  expect(sug.margin_on_price_pct!).toBeLessThanOrEqual(50);
  // Taager's minimum profit is 0 and no shop found: needs research, never a blind markup.
  expect(decidePrice({inputs:{cost_minor:4500,floor_minor:4500,suggested_minor:null},m:sa,competitors:[]})).toMatchObject({state:"blocked",blocked_reason:"needs_market_research"});
 });
 it("may price below Taager's minimum or above its maximum when the market says so, and marks it",()=>{
  const market=(price:number)=>[{retailer:"noon",url:"https://noon.com/x",price_minor:price,match:"exact" as const,confidence:0.9},{retailer:"extra",url:"https://extra.com/x",price_minor:price,match:"exact" as const,confidence:0.9}];
  const low=decidePrice({inputs:{cost_minor:4500,floor_minor:12900,suggested_minor:null},m:sa,competitors:market(9900)});
  expect(low.state).toBe("priced");expect(low.price_minor!).toBeLessThan(12900);expect(low.price_minor!).toBeGreaterThan(4500);
  expect(low.taager_position).toBe("below_minimum");expect(low.notes.join(" ")).toMatch(/test order/);
  const high=decidePrice({inputs:{cost_minor:3500,floor_minor:6000,suggested_minor:null,max_minor:6500},m:sa,competitors:market(14900)});
  expect(high.price_minor!).toBeGreaterThan(6500);expect(high.taager_position).toBe("above_maximum");
  // Market below our cost: priced dearer (still earning the floor) and marked, never a loss.
  const under=decidePrice({inputs:{cost_minor:9000,floor_minor:9500,suggested_minor:null},m:sa,competitors:market(5900)});
  expect(under.profit_delivered_minor!).toBeGreaterThanOrEqual(floorMinor(sa));expect(under.price_blocks_sales).toBe(true);expect(under.positioning).toBe("dearer");
 });
});

describe("margin band (owner rule, 28 Nov 2026)",()=>{
 const sa=MARKETS.sa;
 const shops=(...prices:number[])=>prices.map((p,i)=>({retailer:"shop"+i,url:"https://shop"+i+".sa/x",price_minor:p,match:"exact" as const,confidence:0.9}));
 const inBand=(d:ReturnType<typeof decidePrice>)=>d.margin_on_price_pct!>=15&&d.margin_on_price_pct!<=50;
 it("counts margin per delivered order after cost, Saudi VAT and undelivered orders",()=>{
  // Saudi: 15% of what is above Taager's minimum. 109 - 45 - 15% x (109 - 79) = 59.5
  expect(netPerDelivered(10900,{cost_minor:4500,floor_minor:7900},sa,7500)).toBe(5950);
  // Egypt: 5 EGP per refusal; at a 50% delivery rate each delivered order carries one refusal.
  expect(undeliveredCostPerDelivered(5000,MARKETS.eg)).toBe(500);
  expect(netPerDelivered(40000,{cost_minor:30000,floor_minor:null},MARKETS.eg,5000)).toBe(9500);
  // Delivery we pay for is counted at Egypt's dearest band (105 EGP), so no destination can lose money.
  expect(netPerDelivered(40000,{cost_minor:30000,floor_minor:null},MARKETS.eg,5000,true)).toBe(-1000);
  expect(marginBps(1500,10000)).toBe(1500);
 });
 it("lands just under the cheapest credible shop while inside the band",()=>{
  const d=decidePrice({inputs:{cost_minor:4500,floor_minor:7900,suggested_minor:null},m:sa,competitors:shops(11900,12900,13900)});
  expect(d.customer_total_minor!).toBeLessThanOrEqual(Math.floor(11900*0.98));
  expect(d.positioning).toBe("cheaper");expect(inBand(d)).toBe(true);expect(d.band_exception).toBeNull();
  expect(d.competitor_cheapest_minor).toBe(11900);expect(d.competitor_reference_minor).toBe(12900);
  // The highest such price, not the lowest: 89 + 28 = 117 would be above 116.62, so 79.
  expect(d.price_minor).toBe(7900);
 });
 it("ignores unreliable sellers and prices far off the rest",()=>{
  const junk=[...shops(11900,12900,13900),{retailer:"reseller",url:"https://r.sa/x",price_minor:1900,match:"exact" as const,confidence:0.9},
   {retailer:"nopolicy",url:"https://n.sa/x",price_minor:6900,match:"exact" as const,confidence:0.9,credible:false}];
  const ref=marketReference(junk);
  expect(ref).toMatchObject({basis:"exact",count:3,ignored:2,cheapest_minor:11900,median_minor:12900});
  // A stated delivery charge is part of the shop's door total.
  expect(marketReference([{...shops(9900)[0],delivery_minor:1500}]).cheapest_minor).toBe(11400);
  // Similar items are a weaker anchor: 10% allowance, and exact matches win when both exist.
  expect(marketReference([{...shops(10000)[0],match:"similar"}]).cheapest_minor).toBe(11000);
 });
 it("spends room above the band on delivery included, not on a lower headline price",()=>{
  const d=decidePrice({inputs:{cost_minor:2000,floor_minor:4000,suggested_minor:null},m:sa,competitors:shops(14900,15900)});
  expect(d.delivery_included).toBe(true);expect(inBand(d)).toBe(true);
  expect(d.customer_total_minor).toBe(d.price_minor);expect(d.price_minor!).toBeLessThanOrEqual(Math.floor(14900*0.98));
  expect(d.headroom_minor!).toBeGreaterThan(0);expect(d.notes.join(" ")).toMatch(/delivery included/);
  // It earns more than the band's top price without delivery would.
  const plain=netPerDelivered(4900,{cost_minor:2000,floor_minor:4000},sa,7500);
  expect(d.profit_delivered_minor!).toBeGreaterThan(plain);
 });
 it("keeps the US$2 floor on every listing and writes the reason when that breaks the band",()=>{
  const cheap=decidePrice({inputs:{cost_minor:300,floor_minor:900,suggested_minor:null},m:sa,competitors:shops(3900,4900)});
  expect(cheap.profit_delivered_minor!).toBeGreaterThanOrEqual(750);
  expect(cheap.band_exception).toMatchObject({kind:"above_band"});expect(cheap.band_exception!.reason).toMatch(/US\$2 floor/);
  expect(cheap.needs_owner_review).toBe(true);
  for(const m of Object.values(MARKETS)){
   const d=decidePrice({inputs:{cost_minor:usdToMinor(6,m),floor_minor:usdToMinor(8,m),suggested_minor:null},m,competitors:[]});
   expect(d.state).toBe("priced");expect(d.profit_delivered_minor!).toBeGreaterThanOrEqual(floorMinor(m));expect(inBand(d)).toBe(true);
  }
 });
 it("stays in the band when shops are cheaper, marks it and offers the under-band price as an option",()=>{
  const d=decidePrice({inputs:{cost_minor:8000,floor_minor:8500,suggested_minor:null},m:sa,competitors:shops(12500,12900)});
  expect(inBand(d)).toBe(true);expect(d.positioning==="cheaper").toBe(false);
  expect(d.below_band_option).toMatchObject({price_minor:8900});expect(d.below_band_option!.margin_on_price_pct).toBeLessThan(15);
  expect(d.below_band_option!.profit_delivered_minor).toBeGreaterThanOrEqual(750);
 });
 it("re-prices after a sync: pause under the floor, change on a real move, otherwise keep",()=>{
  const base={m:sa,competitors:shops(11900,12900)};
  const pause=reprice({...base,current_price_minor:7900,inputs:{cost_minor:7400,floor_minor:7900,suggested_minor:null}});
  expect(pause.action).toBe("pause");expect(pause.reason).toMatch(/under the US\$2 floor/);expect(pause.new_price_minor!).toBeGreaterThan(7900);
  expect(reprice({...base,current_price_minor:7900,inputs:{cost_minor:4500,floor_minor:7900,suggested_minor:null}}).action).toBe("keep");
  const up=reprice({...base,current_price_minor:5900,inputs:{cost_minor:4500,floor_minor:7900,suggested_minor:null}});
  expect(up).toMatchObject({action:"change",new_price_minor:7900});
  const wide=reprice({...base,current_price_minor:19900,inputs:{cost_minor:4500,floor_minor:7900,suggested_minor:null}});
  expect(wide.action).toBe("change");expect(wide.reason).toMatch(/outside the 15-50% band/);
  expect(reprice({...base,current_price_minor:7900,inputs:{cost_minor:null,floor_minor:null,suggested_minor:null}}).action).toBe("pause");
 });
});

describe("free delivery threshold",()=>{
 const sa=MARKETS.sa;
 it("proposes a free-delivery threshold only with enough products",()=>{
  expect(freeDeliveryThreshold([{price_minor:9900,profit_delivered_minor:3000}],sa)).toBeNull();
  const t=freeDeliveryThreshold(Array.from({length:10},(_,i)=>({price_minor:8900+i*1000,profit_delivered_minor:3000+i*200})),sa)!;
  expect(t.threshold_minor%5000).toBe(0);expect(t.threshold_minor).toBeGreaterThan(8900);
 });
});

describe("selection and safety",()=>{
 it("kills banned products and flags sensitive ones",async()=>{
  expect(riskCheck({title:"حبوب تخسيس سريعة",categories:[],description:""}).kills).toContain("medicine_claims");
  expect(riskCheck({title:"حبوب قهوة عربية",categories:[],description:""}).kills).toEqual([]);
  expect(riskCheck({title:"شيشة الكترونية",categories:[],description:""}).kills).toContain("tobacco_vape");
  expect(riskCheck({title:"سماعات Apple AirPods",categories:[],description:""}).kills).toContain("counterfeit_brands");
  expect(riskCheck({title:"منظف بالوعات",categories:[],description:""}).flags).toContain("chemicals");
  expect(mapCategory({title:"خفاقة حليب للقهوة",categories:[]})).toBe("kitchen");
  // Mother & kids: grouped by the brain (storefront section opens once it has its photo).
  for(const title of ["سرير هزاز للنوم، ومهد وأرجوحة مريحة للرضع","مسند البطة المساعد للأمهات للاستحمام وتبديل الحفاض","سكوتر مودرن للاطفال"])
   expect(mapCategory({title,categories:[]})).toBe("kids");
  expect(mapCategory({title:"حقيبة سهلة الحمل للسفر",categories:[]})).not.toBe("kids");
  // Real Taager titles that older rules blocked by mistake (27 Nov 2026 Saudi sync).
  for(const title of ["منشفة تجفيف ميكرو فيبر","شعلة فحم كهربائية للمبخرة والعود بدون ولاعة ولا دخان","حقيبة خصر رياضية للجنسين","منشط تربة الحديقة 200 جرام",
    "مسدس حرارة","مسدس تعقيم محمول","مضرب صاعق للحشرات قابل للطي","جراب آيفون مضيء في الظلام","زجاجة مياه مع حقيبة منظم حبوب دواء"])
   expect(riskCheck({title,categories:[],description:""}).kills).toEqual([]);
  expect(riskCheck({title:"عطر",categories:[],description:"مناسب للجنسين"}).kills).toEqual([]);
  // Women-only audience: men's, car, tool, gaming and fishing products leave the shortlist; home, kids and unisex stay.
  for(const [title,why] of [["حذاء رجالي مقاس 44","men"],["زيت نمو اللحية","men"],["حامل هاتف للسياره","car"],["داش كام للسيارة 1080 hd","car"],["مثقاب كهربائي","tools"],["طاولة الجيمنج","gaming"],["شمسية صيد السمك","hunting_fishing"],["سيستم كاميرات كامل 4 كاميرات","off_brand"],["ماكينة قص شعر الحيوانات والمواشي","off_brand"]] as const)
   expect(audienceCheck({title})).toContain(why);
  for(const title of ["عطر فالي للنساء و الرجال","المروحة المحمولة للمنزل والسيارة","سيارة كهربائية للاطفال","مصيدة ناموس كهربائية","جهاز لحام وإغلاق الأكياس الحراري","درج ثلاجة معلق بدون دريل","مشط حراري لفرد الشعر واللحية","منقل شواء للرحلات والتخييم"])
   expect(audienceCheck({title})).toEqual([]);
  for(const [title,kill] of [["هاتف شبيه ايفون 18","counterfeit_brands"],["ايربودز عالية الجودة","counterfeit_brands"],["سماعة Apple الأصلية","counterfeit_brands"],["لعبة مسدس تصويب الكرات الهوائية","weapons"],["فيب نكهة نعناع","tobacco_vape"]] as const)
   expect(riskCheck({title,categories:[],description:""}).kills).toContain(kill);
 });
 it("prefilters: excludes out of stock / no images / unknown cost, keeps one per family",async()=>{
  const offers=await Promise.all([
   woo(),woo({id:2,name:"خفاقة حليب كهربائية 2 قطع"}),woo({id:3,stock_status:"outofstock",name:"كوب قهوة"}),
   woo({id:4,images:[],name:"سلة تخزين"}),woo({id:5,meta_data:[],name:"مرآة مكياج"}),woo({id:6,name:"شيشة الكترونية"}),
  ].map(p=>normalizeWoo("sa",sa,p)));
  const rows=prefilter(offers,{cost_key:"taager_price",floor_key:"min_selling_price"},sa,10);
  const st=Object.fromEntries(rows.map(r=>[r.product_id,r.stage]));
  expect(st).toMatchObject({101:"shortlisted",2:"excluded",3:"excluded",4:"excluded",5:"excluded",6:"killed"});
  expect(rows.find(r=>r.product_id===2)!.reasons).toContain("same_family_as_a_stronger_offer");
  expect(rows.find(r=>r.product_id===5)!.reasons).toContain("economics_unknown");
 });
 it("selects by score with family and category diversity",()=>{
  const c=(i:number,fam:string,cat:"kitchen"|"home",score:number)=>({product_id:i,variation_id:0,family_key:fam,category:cat,score,blocked:false});
  const pick=selectFinal([c(1,"a","kitchen",9),c(2,"a","kitchen",8),c(3,"b","kitchen",7),c(4,"c","home",6),{...c(5,"d","home",10),blocked:true}],3);
  expect(pick.map(x=>x.product_id)).toEqual([1,3,4]);
  // Every section keeps a reserved share (mother & kids included), then the best of the rest under the 35% cap.
  const pool=[...Array.from({length:40},(_,i)=>c(100+i,"k"+i,"kitchen",90-i)),{product_id:900,variation_id:0,family_key:"kid1",category:"kids" as const,score:1,blocked:false},
   {product_id:901,variation_id:0,family_key:"w1",category:"wellness" as const,score:2,blocked:false}];
  const spread=selectFinal(pool as never,20);
  expect(spread).toHaveLength(9); // 7 kitchen (35% cap) + the only kids and wellness products
  expect(spread.map(x=>x.product_id)).toEqual(expect.arrayContaining([900,901]));
  expect(spread.filter(x=>x.category==="kitchen")).toHaveLength(7);
  const plan=merchandise([{key:"1:0",category:"kitchen",score:9,price_minor:9900,images:3},{key:"4:0",category:"organize",score:5,price_minor:4900,images:1}]);
  expect(plan.hero).toBe("1:0");expect(plan.cross_sell["1:0"]).toEqual(["4:0"]);
 });
});

describe("AI plumbing",()=>{
 it("meters cost exactly from usage, including web searches and the Haiku long-prompt tier",()=>{
  expect(costOf("claude-haiku-5-5",{input_tokens:10000,output_tokens:1000,server_tool_use:{web_search_requests:3}}).cost_microusd).toBe(1000+500+30000);
  expect(costOf("claude-haiku-5-5",{input_tokens:120000,output_tokens:0}).cost_microusd).toBe(60000);
  expect(costOf("claude-sonnet-5-5",{input_tokens:3000,output_tokens:2000}).cost_microusd).toBe(6000+20000);
  expect(()=>costOf("unknown-model",{})).toThrow();
  expect(estimateMax("claude-haiku-5-5",3000,1500,3)).toBeGreaterThan(30000);
 });
 it("extracts JSON from fenced or bare model text",()=>{
  expect(extractJson('notes\n```json\n{"a":1}\n```')).toEqual({a:1});
  expect(extractJson('Result: {"b":2} done')).toEqual({b:2});
  expect(()=>extractJson("no json here")).toThrow();
 });
 it("only trusts research prices from pages actually searched",()=>{
  const r=parseResearch({listings:[
   {retailer:"Amazon",url:"https://www.amazon.sa/dp/1",price:"129.00",currency:"SAR",match:"exact",confidence:0.9},
   {retailer:"Made up",url:"https://invented.example/x",price:"99",currency:"SAR",match:"exact",confidence:0.9},
   {retailer:"USD shop",url:"https://www.amazon.sa/dp/2",price:"30",currency:"USD",match:"exact",confidence:0.9},
  ],demand_signals:[{source:"amazon",signal:"2,300 ratings"}]},sa,["https://www.amazon.sa/dp/1"]);
  expect(r.listings).toHaveLength(2);
  expect(r.listings[0]).toMatchObject({price_minor:12900,cited:true,confidence:0.9});
  expect(r.listings[1]).toMatchObject({cited:false,confidence:0.3});
 });
 it("records each shop's delivery charge and credibility, and keeps only sourced, claim-free facts",()=>{
  const r=parseResearch({listings:[
   {retailer:"Noon",url:"https://www.noon.com/p/1",price:"119",delivery:"12.00",currency:"SAR",match:"exact",confidence:0.9,credible:true},
   {retailer:"Reseller",url:"https://www.noon.com/p/2",price:"39",delivery:null,currency:"SAR",match:"exact",confidence:0.9,credible:false},
   {retailer:"Noon",url:"https://www.noon.com/p/1#reviews",price:"119",currency:"SAR",match:"exact",confidence:0.9}],
   facts:[{kind:"material",fact:"Stainless steel whisk head",url:"https://www.noon.com/p/1"},
    {kind:"use",fact:"Clinically proven to treat hair loss",url:"https://www.noon.com/p/1"},
    {kind:"size",fact:"About 24 cm long",url:"https://unseen.example/x"},
    {kind:"weird",fact:"Runs on two AA batteries",url:"notaurl"}],
   buyer_questions:["Does it need batteries?","Is it dishwasher safe?"]},sa,["https://www.noon.com/p/1","https://www.noon.com/p/2"]);
  expect(r.listings[0]).toMatchObject({delivery_minor:1200,credible:true});expect(r.listings[1]).toMatchObject({delivery_minor:null,credible:false});
  expect(r.facts.map(f=>[f.kind,f.cited])).toEqual([["material",true],["size",false]]);
  expect(r.buyer_questions).toHaveLength(2);
  expect(r.listings).toHaveLength(2);
  expect(marketReference(r.listings)).toMatchObject({cheapest_minor:11900+1200,count:1,ignored:1});
  const rows=evidenceRows("sa","TG-1",r,"2026-11-28T10:00:00.000Z");
  expect(rows).toHaveLength(2);expect(rows[0]).toMatchObject({store_code:"sa",sku:"TG-1",url:"https://www.noon.com/p/1",price_minor:11900,delivery_minor:1200,credible:true,cited:true,source:"web_search",seen_at:"2026-11-28T10:00:00.000Z"});
  expect(researchPrompt({title:"x",sku:"1",categories:[],attributes:[],description:"",short_description:"",images:[],videos:[],meta:{}} as never,sa).system).toMatch(/YOUR OWN plain English words \(never copy a sentence\)/);
 });
 it("enforces the fixed layout, the market's dialect and the no-invention rule on brain pages",()=>{
  const source="خفاقة حليب كهربائية تعمل ببطاريتين AA طولها 24 سم من الستانلس ستيل";
  const good={title:"خفاقة حليب كهربائية لرغوة ناعمة",benefit_line:"رغوة ناعمة لقهوتك في ثوانٍ.",description:"خفاقة خفيفة تجهّز رغوة الحليب بسرعة.\n\nسهلة التنظيف بعد كل استخدام.",
   bullets:["رأس من الستانلس ستيل","تعمل ببطاريتين AA","طولها 24 سم وتدخل أي درج"],specs:[{label:"الطول",value:"24 سم"}],in_box:["خفاقة حليب"],how_to_use:["ضعي الرأس في الحليب","اضغطي الزر"],
   faq:[{q:"هل تحتاج بطاريات؟",a:"نعم، تعمل ببطاريتين AA."},{q:"كم طولها؟",a:"طولها 24 سم."},{q:"ما مادة الرأس؟",a:"الرأس من الستانلس ستيل."}],
   seo:{title:"خفاقة حليب كهربائية",meta_description:"خفاقة حليب لرغوة ناعمة.",keywords:["خفاقة حليب"],slug:"milk-frother"},category:"kitchen"};
  const ok=parseContent(good,{market:"sa",sourceText:source});
  expect(ok.issues).toEqual([]);expect(ok.benefit_line).toBe("رغوة ناعمة لقهوتك في ثوانٍ.");expect(ok.in_box).toEqual(["خفاقة حليب"]);expect(ok.how_to_use).toHaveLength(2);
  // An invented size, an invented certification and an invented origin are all caught.
  const invented=parseContent({...good,bullets:["قوة 500 واط","معتمدة من هيئة الغذاء","تدخل أي درج"]},{market:"sa",sourceText:source});
  expect(invented.issues).toEqual(expect.arrayContaining(["unsupported_number","unsupported_claim","needs_fix"]));
  expect(invented.removed_claims.join(" ")).toMatch(/500/);
  // Arabic-Indic digits count as the same number; a number the research found is allowed.
  expect(parseContent({...good,specs:[{label:"الطول",value:"٢٤ سم"}]},{market:"sa",sourceText:source}).issues).toEqual([]);
  // Egyptian wording on the Saudi store, promo words and keyword lists in the title, walls of text.
  expect(parseContent({...good,benefit_line:"مش هتلاقي زيها دلوقتي."},{market:"sa",sourceText:source}).issues).toContain("wrong_dialect");
  expect(parseContent({...good,benefit_line:"مش هتلاقي زيها دلوقتي."},{market:"eg",sourceText:source}).issues).not.toContain("wrong_dialect");
  expect(parseContent({...good,title:"عرض خاص خفاقة حليب"},{market:"sa",sourceText:source}).issues).toContain("title_promo_words");
  expect(parseContent({...good,title:"خفاقة حليب | خفاقة قهوة | خفاقة كهربائية | خفاقة"},{market:"sa",sourceText:source}).issues).toContain("title_keyword_stuffing");
  expect(parseContent({...good,description:"كلام ".repeat(120)},{market:"sa",sourceText:source}).issues).toContain("layout_wall_of_text");
  expect(parseContent({...good,bullets:["واحدة"],faq:[]},{market:"sa",sourceText:source}).issues).toEqual(expect.arrayContaining(["layout_bullets","layout_faq"]));
  expect(parseContent({...good,benefit_line:"لا تفوّتي الكمية تنفد"},{market:"sa",sourceText:source}).issues).toContain("banned_wording_present");
  // The prompt tells the writer the same rules, in the market's voice.
  const pr=contentPrompt({title:"x",sku:"1",categories:[],attributes:[],description:"",short_description:"",images:[],videos:[],meta:{}} as never,MARKETS.eg,{category:null,piecesVerified:null,priceText:"",deliveryText:"",returnsText:"",research:"",facts:[{kind:"size",fact:"24 cm long"}],buyerQuestions:["Does it need batteries?"],fix:["unsupported_number"]});
  expect(pr.system).toMatch(/Egyptian shoppers/);expect(pr.system).toMatch(/LEFT OUT/);expect(pr.user).toMatch(/24 cm long/);expect(pr.user).toMatch(/rejected for: unsupported_number/);
 });
 it("validates store content and flags supplier names, prices and claims",()=>{
  const ok=parseContent({title:"خفاقة حليب كهربائية",description:"رغوة ناعمة لقهوتك.",seo:{title:"خفاقة حليب",meta_description:"وصف",keywords:["خفاقة حليب"],slug:"Milk Frother!"},category:"kitchen"});
  expect(ok.issues).toEqual([]);expect(ok.seo.slug).toBe("milk-frother");
  const bad=parseContent({title:"الأفضل في السوق من تاجر",description:"بسعر 89 ريال وخصم",seo:{slug:"x"}});
  expect(bad.issues).toEqual(expect.arrayContaining(["banned_wording_present","price_in_text"]));
  expect(parseMapping({cost_key:"taager_price",floor_key:"not_a_key",confidence:0.9},new Set(["taager_price"]))).toMatchObject({cost_key:"taager_price",floor_key:null});
 });
});

describe("risk rules on real supplier wording",()=>{
 const rc=(title:string,description="")=>riskCheckForTest({title,categories:[],description});
 it("keeps tools and household items that only sound risky",()=>{
  expect(rc("مسدس غسيل السيارات بالفوم").kills).toEqual([]);
  expect(rc("مسدس المسامير الحديث").kills).toEqual([]);
  expect(rc("صاعق الناموس الكهربائي").kills).toEqual([]);
  expect(rc("ماكينة الخياطة الحديثة","تمكنك من علاج قطع ملابسك بسهولة").kills).toEqual([]);
  expect(rc("شواية كهربائية","لا يصدر دخان أثناء الشوي").kills).toEqual([]);
  expect(rc("ترامبولين للكبار","يساعد على حرق الدهون").kills).toEqual([]);
  expect(rc("كبسولات قهوة").kills).toEqual([]);
 });
 it("still kills clear cases from the title or unambiguous description terms",()=>{
  expect(rc("كريم تخسيس للبطن").kills).toContain("medicine_claims");
  expect(rc("Airpods Pro 2 Semi original").kills).toContain("counterfeit_brands");
  expect(rc("شيشة الكترونية").kills).toContain("tobacco_vape");
  expect(rc("علبة","حبوب تخسيس طبيعية").kills).toContain("medicine_claims");
  expect(rc("مسدس صوت").kills).toContain("weapons");
  expect(rc("تابلت مزود بكيبورد شبيه الايفون i15 Pro").kills).toContain("counterfeit_brands");
  expect(rc("ساعة ذكية سامسونج").kills).toContain("counterfeit_brands");
  expect(rc("سرير قابل للطي").kills).toEqual([]);
 });
});

describe("quantity offers",()=>{
 it("offers 2 and 3 pieces cheaper than singles, never earning less than one single sale at full unit cost",()=>{
  const offers=quantityOffers(19900,{cost_minor:7700,floor_minor:14000},MARKETS.sa);
  expect(offers.map(o=>o.quantity)).toEqual([2,3]);
  for(const o of offers){
   expect(o.price_minor).toBeLessThan(o.quantity*19900);
   expect(String(o.price_minor/100)).toMatch(/9$/);
   expect(o.profit_delivered_minor).toBeGreaterThanOrEqual(profitDelivered(19900,{cost_minor:7700,floor_minor:14000},MARKETS.sa));
   expect(o.price_minor).toBeGreaterThan(o.quantity*7700);
  }
 });
 it("skips offers when the margin is too thin",()=>{
  expect(quantityOffers(5900,{cost_minor:5200,floor_minor:5900},MARKETS.sa)).toEqual([]);
  expect(quantityOffers(4000,{cost_minor:5000,floor_minor:null},MARKETS.sa)).toEqual([]);
 });
 it("is part of every priced decision",()=>{
  const d=decidePrice({inputs:{cost_minor:4500,floor_minor:9900,suggested_minor:null},m:MARKETS.sa,competitors:[]});
  expect(Array.isArray(d.quantity_offers)).toBe(true);
 });
});
