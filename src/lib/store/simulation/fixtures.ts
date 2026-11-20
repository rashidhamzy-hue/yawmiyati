/**
 * OFFLINE DEVELOPMENT FIXTURES — NEVER LIVE INVENTORY.
 *
 * No imports of this module from public routes, Edge Functions, supplier
 * adapters or production publishing jobs. All names, evidence, prices, stock
 * and costs are synthetic even when based on a real market currency.
 */
import {markets,parseMinorUnits,type MarketCode} from "../markets";

export const SIMULATION_MODE="SIMULATION_ONLY" as const;
export type SimCategory="home"|"kitchen"|"beauty"|"fashion"|"wellness"|"organize";
export type SimStock="available"|"unavailable"|"unknown";

export type SimProduct={
 readonly synthetic:true;
 readonly kind:"simulation_product";
 readonly market:MarketCode;
 readonly sku:string;
 readonly category:SimCategory;
 readonly title:string;
 readonly currency:string;
 readonly priceMinor:number;
 readonly costMinor:number;
 readonly variants:readonly {readonly sku:string;readonly label:string;readonly stock:SimStock;readonly availableUnits:number}[];
 readonly description:string;
 readonly observationAt:string;
 readonly evidence:"synthetic_fixture";
 readonly mayPublish:false;
};

const categories:readonly SimCategory[]=["home","kitchen","beauty","fashion","wellness","organize"];
const categoryNames:Record<SimCategory,string>={
 home:"ديكور منزلي",kitchen:"أدوات المطبخ",beauty:"أدوات العناية",
 fashion:"إكسسوارات",wellness:"أدوات الراحة",organize:"أدوات التنظيم",
};
const marketNames:Record<MarketCode,string>={
 sa:"السعودية",ae:"الإمارات",om:"عُمان",eg:"مصر",iq:"العراق",
};
const localBase:Record<MarketCode,string>={
 sa:"40",ae:"45",om:"5",eg:"450",iq:"45000",
};
export const SIMULATION_FIXTURE_DATE="2026-11-20T12:00:00.000Z";

/** Exactly 30 products per market, 2 variants per product, deterministic. */
export function createSyntheticCatalog(market:MarketCode):readonly SimProduct[]{
 if(!Object.hasOwn(markets,market))throw new Error("invalid_market");
 const base=parseMinorUnits(market,localBase[market]);
 return Array.from({length:30},(_,index)=>{
  const n=index+1;
  const category=categories[index%categories.length];
  const sku="SIM-"+market.toUpperCase()+"-"+String(n).padStart(3,"0");
  const priceMinor=base+Math.floor(index/6)*Math.max(1,Math.floor(base/8));
  const variantState:SimStock=index%11===0?"unknown":index%7===0?"unavailable":"available";
  return Object.freeze({
   synthetic:true as const,kind:"simulation_product" as const,market,sku,category,
   title:"[تجريبي] "+categoryNames[category]+" "+n+" — "+marketNames[market],
   currency:markets[market].currency,priceMinor,costMinor:Math.floor(priceMinor*0.57),
   variants:Object.freeze([
    Object.freeze({sku:sku+"-A",label:"خيار أ",stock:variantState,availableUnits:variantState==="available"?8:0}),
    Object.freeze({sku:sku+"-B",label:"خيار ب",stock:index%5===0?"unavailable" as const:"available" as const,availableUnits:index%5===0?0:3}),
   ]),
   description:"منتج اصطناعي للاختبار فقط. لا يمثل سلعة حقيقية ولا يجوز عرضه للعملاء.",
   observationAt:SIMULATION_FIXTURE_DATE,evidence:"synthetic_fixture" as const,mayPublish:false as const,
  });
 });
}

/**
 * Synthetic shipping amounts for offline arithmetic only. They are NOT quotes
 * or seller promises. Egypt deliberately uses a mock amount because its actual
 * governorate rate table is still unknown. OMR/IQD use ISO minor precision.
 */
const shippingMajor:Record<MarketCode,string>={sa:"28",ae:"19",om:"3",eg:"60",iq:"7000"};
export function syntheticShippingMinor(market:MarketCode):number{
 if(!Object.hasOwn(markets,market))throw new Error("invalid_market");
 return parseMinorUnits(market,shippingMajor[market]);
}
export function createFiveMarketFixtures(){
 return Object.freeze({
  mode:SIMULATION_MODE,
  createdAt:SIMULATION_FIXTURE_DATE,
  products:Object.freeze({
   sa:createSyntheticCatalog("sa"),ae:createSyntheticCatalog("ae"),
   om:createSyntheticCatalog("om"),eg:createSyntheticCatalog("eg"),
   iq:createSyntheticCatalog("iq"),
  }),
 });
}
