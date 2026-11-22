import type { MarketCode } from "../../src/lib/store/markets";
import { digest, type Snapshot, type RecordInput } from "./workspace";

export type WooPage = {page: number; totalPages: number; totalProducts: number; products: {
  global_unique_id?:string; stock_status?: string; id: number; sku: string; name: string; categories: {name:string}[]; variations: number[];
}[]};

function canonical(value:unknown):unknown {
  if(Array.isArray(value))return value.map(canonical);
  if(value && typeof value==="object")return Object.fromEntries(Object.entries(value)
    .sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,v])=>[key,canonical(v)]));
  return value;
}

// Each market uses its own export. Woo product counts describe parent products.
// Candidate rows count orderable variations separately, preserving unmapped rows.
export function unpackWoo(market:MarketCode, pages:WooPage[], observedAt:string) {
  if (!pages.length || !Number.isFinite(Date.parse(observedAt))) throw Error("Missing Woo export or observation time");
  const {totalPages,totalProducts}=pages[0]!;
  if (![totalPages,totalProducts].every(n=>Number.isSafeInteger(n)&&n>=0)) throw Error("Invalid Woo totals");
  const seenPages=new Set<number>(), products=new Set<number>();
  const records:RecordInput[]=[];
  for (const page of pages) {
    if(page.totalPages!==totalPages || page.totalProducts!==totalProducts || !Number.isSafeInteger(page.page) ||
       page.page<1 || page.page>Math.max(totalPages,1) || seenPages.has(page.page))throw Error("Inconsistent or duplicate Woo page");
    seenPages.add(page.page);
    for(const p of page.products){
      if(!Number.isSafeInteger(p.id)||p.id<=0||products.has(p.id)||!p.name?.trim()||!Array.isArray(p.variations))throw Error("Invalid or duplicate Woo product");
      products.add(p.id);
      const variants=p.variations.length?p.variations:[0];
      if(new Set(variants).size!==variants.length || p.variations.some(v=>!Number.isSafeInteger(v)||v<=0))throw Error("Invalid variation");
      const sourceDigest=digest(canonical(p));
      for(const variant of variants){
        const sku=variant || !p.sku?.trim() ? "woo-"+p.id+"-"+variant : p.sku;
        records.push({...(!variant && p.global_unique_id?{packGtin:p.global_unique_id}:{}),woo:{productId:p.id,variationId:variant,observedAt,sourceDigest,...(p.stock_status?{stockStatus:p.stock_status}:{})},productKey:"woo/"+p.id+"/"+variant,offer:{
          market,sku,title:p.name,category:p.categories.map(c=>c.name).join(" / "),components:null,sellerFloor:null,shopperShipping:null,competitor:null,
          observations:[],commercialCostVerified:false,variantsVerified:false,mediaRightsVerified:false,
          economics:{price:null,supplierCost:null,outboundDelivery:null,deliveredFees:null,returnCost:null,adCost:null,deliveryBps:null}
        },comparisons:[],demand:[],facts:[],faq:[],media:[]});
      }
    }
  }
  if(products.size>totalProducts || (seenPages.size===Math.max(totalPages,1) && products.size!==totalProducts))throw Error("Woo totals disagree with unique products");
  return {market, observedAt, reportedTotal:products.size===totalProducts && seenPages.size===Math.max(totalPages,1)?records.length:null,
    wooCoverage:{pagesRead:seenPages.size,totalPages,parentsRead:products.size,totalProducts},records};
}

export function refreshWoo(current:Snapshot, updates:Record<string,{pages:WooPage[];observedAt:string}>) {
  if(current.demo || current.version!==1)throw Error("Refresh requires a Woo workspace");
  const codes=Object.keys(updates);
  if(!codes.length || codes.some(code=>!current.stores.some(store=>store.market===code)))throw Error("Unknown or missing refresh market");
  const changes:{market:MarketCode;unchanged:number;changed:number;added:number;removed:number}[]=[];
  const stores=current.stores.map(old=>{
    if(!Object.hasOwn(updates,old.market))return old;
    if(old.records.some(row=>!row.woo))throw Error("Cannot refresh a mixed-source market as Woo-only");
    const input=updates[old.market]!;
    const next=unpackWoo(old.market,input.pages,input.observedAt);
    if(next.reportedTotal===null)throw Error("Incomplete Woo export for "+old.market);
    const last=old.records.reduce((latest,r)=>Math.max(latest,r.woo?Date.parse(r.woo.observedAt):-Infinity),old.observedAt?Date.parse(old.observedAt):-Infinity);
    const now=Date.parse(input.observedAt);
    if(now<last || now>Date.now())throw Error("Invalid refresh chronology for "+old.market);
    const key=(r:RecordInput)=>JSON.stringify([r.woo?.productId,r.woo?.variationId]);
    const byId=new Map(old.records.map(r=>[key(r),r]));
    const stats={market:old.market,unchanged:0,changed:0,added:0,removed:0};
    const records=next.records.map(fresh=>{
      const id=key(fresh),prior=byId.get(id);
      if(!prior){stats.added++;return fresh;}
      byId.delete(id);
      if(prior.woo?.sourceDigest!==fresh.woo!.sourceDigest){stats.changed++;return fresh;}
      stats.unchanged++;
      return {...prior,woo:fresh.woo};
    });
    stats.removed=byId.size;
    if(now===last && old.observedAt && (stats.added||stats.removed||stats.changed))throw Error("Conflicting captures with the same timestamp");
    changes.push(stats);
    return {...next,records};
  });
  return {snapshot:{...current,stores},changes};
}
