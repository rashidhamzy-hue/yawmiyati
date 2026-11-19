import { parseMinorUnits, type MarketCode } from "./markets";
export function normalizeImportCandidate(market:MarketCode, raw:unknown, observedAt:string, parentId?:number) {
 if (!raw || typeof raw!=="object" || !Number.isFinite(Date.parse(observedAt))) throw new Error("Invalid product observation");
 const p=raw as Record<string,unknown>;
 if(typeof p.id!=="number"||!Number.isSafeInteger(p.id)||p.id<=0||typeof p.sku!=="string"||!p.sku.trim()) throw new Error("Missing supplier identifiers");
 if(parentId!==undefined&&(!Number.isSafeInteger(parentId)||parentId<=0)) throw new Error("Invalid parent");
 if(parentId===undefined&&p.type!=="simple") throw new Error("Unsupported product type: inspect variants separately");
 const title=typeof p.name==="string"&&p.name.trim()?p.name.trim():p.sku.trim();
 return {store_code:market,woo_product_id:parentId??p.id,woo_variation_id:parentId===undefined?0:p.id,supplier_sku:p.sku.trim(),title,
 observed_price_minor:typeof p.price==="string"&&p.price!==""?parseMinorUnits(market,p.price):null,
 observed_stock:p.stock_status==="outofstock"?"unavailable" as const:"unknown" as const,observed_at:observedAt};
}
