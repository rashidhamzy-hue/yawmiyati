import type { MarketCode } from "../../src/lib/store/markets";
import type { RecordInput } from "./workspace";

export type WooPage = {page: number; totalPages: number; totalProducts: number; products: {
  id: number; sku: string; name: string; categories: {name:string}[]; variations: number[];
}[]};

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
      for(const variant of variants){
        const sku=variant || !p.sku?.trim() ? "woo-"+p.id+"-"+variant : p.sku;
        records.push({woo:{productId:p.id,variationId:variant,observedAt},productKey:"woo/"+p.id+"/"+variant,offer:{
          market,sku,title:p.name,category:p.categories.map(c=>c.name).join(" / "),components:null,sellerFloor:null,shopperShipping:null,competitor:null,
          observations:[],commercialCostVerified:false,variantsVerified:false,mediaRightsVerified:false,
          economics:{price:null,supplierCost:null,outboundDelivery:null,deliveredFees:null,returnCost:null,adCost:null,deliveryBps:null}
        },comparisons:[],demand:[],facts:[],faq:[],media:[]});
      }
    }
  }
  if(products.size>totalProducts || (seenPages.size===Math.max(totalPages,1) && products.size!==totalProducts))throw Error("Woo totals disagree with unique products");
  return {market, reportedTotal:products.size===totalProducts && seenPages.size===Math.max(totalPages,1)?records.length:null,
    wooCoverage:{pagesRead:seenPages.size,totalPages,parentsRead:products.size,totalProducts},records};
}
