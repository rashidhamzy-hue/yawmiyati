import { demoCatalog,demoDate } from "../../src/lib/store/offer-selection-demo";
import { markets,type MarketCode } from "../../src/lib/store/markets";
import type { Snapshot } from "./workspace";

export function sampleSnapshot():Snapshot {
  return {version:1,demo:true,stores:(Object.keys(markets) as MarketCode[]).map(market=>{
    const {offers,reportedTotal}=demoCatalog(market);
    return {market,reportedTotal,records:offers.map(offer=>{
      const url="https://example.invalid/"+market+"/"+offer.sku;
      const productKey=offer.sku;
      const contents=(offer.components??[]).map(p=>(p.id==="rack"?"رف مطبخ":"خطّاف")+" × "+p.quantity.toLocaleString(markets[market].locale)).join("، ");
      return {offer:{...offer,observations:offer.observations.map(o=>({...o,source:url+"/"+o.factor}))},productKey,
        comparisons:[{market,productKey,currency:markets[market].currency,seller:"Fictional comparison shop",url,observedAt:demoDate,price:offer.economics.price!,shipping:0}],
        demand:[{market,productKey,url:url+"/search-interest",metric:"search_interest_index",observedAt:demoDate,value:75}],
        facts:[{id:"title",text:offer.title,source:url},{id:"contents",text:"تحتوي العبوة على "+contents+".",source:url}],
        faq:[{question:"ماذا تتضمن العبوة؟",factId:"contents"}],media:[]};
    })};
  })};
}
