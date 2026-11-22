import { createWooReader, type WooConfig } from "../../src/lib/store/woo.server.ts";
import { markets, type MarketCode } from "../../src/lib/store/markets";
import { digest } from "./workspace";
import type { WooPage } from "./woo-snapshot";

export function configuration(market:MarketCode,env:NodeJS.ProcessEnv):WooConfig {
  const prefix="YAWMIYATI_WOO_"+market.toUpperCase()+"_";
  const [origin,consumerKey,consumerSecret]=["ORIGIN","KEY","SECRET"].map(k=>env[prefix+k]);
  if(!origin||!consumerKey||!consumerSecret)throw Error("Configure the three "+prefix+" connection settings");
  return {market,origin,consumerKey,consumerSecret};
}
const scalar=(v:unknown)=>typeof v==="string"||typeof v==="number"?String(v):"";
const decimal=(v:unknown)=>/^\d{1,12}(?:\.\d{1,3})?$/.test(scalar(v))?scalar(v):null;
const groupRules={
  cost:/^(taager|supplier|wholesale)_(product_)?(cost|price)$/,
  floor:/^((taager|supplier)_)?min(imum)?_(selling|sale)_price$/,
  tiers:/quantity_(discount|break|tier)|tier(ed)?_pric/,
  extra:/extra_(cart_)?item|add_?on_pric/,
  components:/pack_(contents|components)|bundle_(items|components)|bundled_items/
};
function project(raw:any) {
  if(!raw||typeof raw!=="object"||!Array.isArray(raw.categories)||!Array.isArray(raw.variations))throw Error("Incomplete Woo product");
  const signals=[];for(const meta of raw.meta_data??[]){
    if(typeof meta?.key!=="string"||meta.value==null||meta.value==="")continue;
    const key=meta.key.toLowerCase().replace(/^_+/,"").replace(/[- ]+/g,"_");
    if(/secret|token|password|auth|credential|private|email|phone|address|customer|user/.test(key))continue;
    const group=Object.entries(groupRules).find(([,rule])=>rule.test(key))?.[0];
    if(group)signals.push({group,amount:["cost","floor"].includes(group)?decimal(meta.value):null,revision:digest(meta.value)});
  }
  return {id:raw.id,sku:scalar(raw.sku),name:raw.name,categories:raw.categories.map((c:any)=>({name:scalar(c.name)})),variations:raw.variations,
    global_unique_id:scalar(raw.global_unique_id),stock_status:scalar(raw.stock_status),
    observed:{regular:decimal(raw.regular_price),sale:decimal(raw.sale_price),stock:decimal(raw.stock_quantity),signals}};
}
function count(value:string|null){
  if(value===null||!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw Error("Missing or invalid Woo pagination totals");
  return Number(value);
}
export async function pullInventory(config:WooConfig,request=fetch) {
  const observedAt=new Date().toISOString();
  const reader=createWooReader(config,request),pages:WooPage[]=[];
  if(await reader.currency()!==markets[config.market].currency)throw Error("Woo currency does not match the configured market");
  let lastId=0,expectedPages=1,expectedProducts=0;
  for(let page=1;page<=Math.max(1,expectedPages);page++){
    const {records,totals}=await reader.inventoryPage(page);
    const n=count(totals.products),p=count(totals.pages);
    if(p!==Math.ceil(n/50)||p>10000||page>1&&(p!==expectedPages||n!==expectedProducts))throw Error("Woo catalog changed during pagination");
    expectedPages=p;expectedProducts=n;
    if(records.length!==Math.min(50,n-(page-1)*50))throw Error("Incomplete Woo page");
    const products=records.map(project);
    for(const product of products){
      if(!Number.isSafeInteger(product.id)||product.id<=lastId)throw Error("Woo product ordering changed");
      lastId=product.id;
    }
    pages.push({page,totalPages:p,totalProducts:n,products});
  }
  return {observedAt,pages};
}
