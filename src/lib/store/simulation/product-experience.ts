/**
 * Pure, offline-only product discovery for owner demonstrations.
 * Never import from live/public routes or publish these synthetic records.
 */
import {markets,type MarketCode} from "../markets";
import {createSyntheticCatalog,type SimCategory,type SimProduct} from "./fixtures";

export type DemoSort="recommended"|"price_asc"|"price_desc"|"title";
export type DemoStockFilter="all"|"available"|"unavailable"|"unknown";
export type DemoCatalogQuery={
 readonly market:MarketCode;
 readonly category?:SimCategory|"all";
 readonly search?:string;
 readonly stock?:DemoStockFilter;
 readonly sort?:DemoSort;
 readonly minPriceMinor?:number;
 readonly maxPriceMinor?:number;
 readonly page?:number;
 readonly pageSize?:number;
};
export const SIM_CATEGORIES=["home","kitchen","beauty","fashion","wellness","organize"] as const;
export const CATEGORY_TITLES:Record<SimCategory,string>={
 home:"المنزل والديكور",kitchen:"المطبخ والقهوة",beauty:"الجمال والعناية",
 fashion:"الأزياء والإكسسوارات",wellness:"الراحة والرفاهية",organize:"التنظيم",
};
export type DemoCatalogResult={
 readonly synthetic:true;
 readonly total:number;
 readonly pages:number;
 readonly page:number;
 readonly pageSize:number;
 readonly products:readonly SimProduct[];
};
export function demoAvailability(product:SimProduct):"available"|"unavailable"|"unknown"{
 if(product.variants.some(v=>v.stock==="available"&&v.availableUnits>0))return "available";
 if(product.variants.some(v=>v.stock==="unknown"))return "unknown";
 return "unavailable";
}
export function normalizeDemoQuery(value:string){
 return value.normalize("NFKC").replace(/[\u064B-\u065F\u0670]/g,"").replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").toLocaleLowerCase("ar").trim();
}
export function demoListing(input:DemoCatalogQuery,catalog:readonly SimProduct[]=createSyntheticCatalog(input.market)):DemoCatalogResult{
 if(!Object.hasOwn(markets,input.market))throw Error("invalid_market");
 const page=input.page??1,pageSize=input.pageSize??12,category=input.category??"all",sort=input.sort??"recommended",stock=input.stock??"all";
 if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>60)throw Error("invalid_pagination");
 if(category!=="all"&&!SIM_CATEGORIES.includes(category))throw Error("invalid_category");
 if(!["all","available","unavailable","unknown"].includes(stock))throw Error("invalid_stock_filter");
 if(!["recommended","price_asc","price_desc","title"].includes(sort))throw Error("invalid_sort");
 for(const amount of [input.minPriceMinor,input.maxPriceMinor])if(amount!==undefined&&(!Number.isSafeInteger(amount)||amount<0))throw Error("invalid_price_range");
 if(input.minPriceMinor!==undefined&&input.maxPriceMinor!==undefined&&input.minPriceMinor>input.maxPriceMinor)throw Error("invalid_price_range");
 const query=normalizeDemoQuery(input.search??"");
 if(query.length>120)throw Error("invalid_search");
 let items=catalog.filter(p=>p.synthetic===true&&p.mayPublish===false&&p.market===input.market&&p.currency===markets[input.market].currency&&p.evidence==="synthetic_fixture");
 if(category!=="all")items=items.filter(p=>p.category===category);
 if(stock!=="all")items=items.filter(p=>demoAvailability(p)===stock);
 if(query)items=items.filter(p=>normalizeDemoQuery(p.title+" "+p.description+" "+p.category+" "+p.sku).includes(query));
 if(input.minPriceMinor!==undefined)items=items.filter(p=>p.priceMinor>=input.minPriceMinor!);
 if(input.maxPriceMinor!==undefined)items=items.filter(p=>p.priceMinor<=input.maxPriceMinor!);
 items=[...items];
 if(sort==="price_asc")items.sort((a,b)=>a.priceMinor-b.priceMinor||a.sku.localeCompare(b.sku));
 if(sort==="price_desc")items.sort((a,b)=>b.priceMinor-a.priceMinor||a.sku.localeCompare(b.sku));
 if(sort==="title")items.sort((a,b)=>a.title.localeCompare(b.title,"ar")||a.sku.localeCompare(b.sku));
 const total=items.length,pages=Math.ceil(total/pageSize);
 return {synthetic:true,total,pages,page,pageSize,products:items.slice((page-1)*pageSize,page*pageSize)};
}
export function demoProduct(market:MarketCode,sku:string):SimProduct|null{
 if(!Object.hasOwn(markets,market)||typeof sku!=="string")throw Error("invalid_product_query");
 return createSyntheticCatalog(market).find(x=>x.sku===sku)??null;
}
export function demoVariant(product:SimProduct,sku:string){
 const variant=product.variants.find(x=>x.sku===sku);
 if(!variant)throw Error("invalid_variant");
 return variant;
}
export function formatDemoMoney(market:MarketCode,valueMinor:number){
 if(!Object.hasOwn(markets,market)||!Number.isSafeInteger(valueMinor)||valueMinor<0)throw Error("invalid_money");
 const m=markets[market];
 return new Intl.NumberFormat(m.locale,{style:"currency",currency:m.currency,minimumFractionDigits:m.minorDigits,maximumFractionDigits:m.minorDigits}).format(valueMinor/10**m.minorDigits);
}
