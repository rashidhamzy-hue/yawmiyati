/**
 * Integration boundary contract. Type-only: no transport, credentials, network,
 * real provider observations or effectful implementations.
 * Production adapters MUST validate evidence independently and never trust
 * simulation objects. This contract does not activate integrations.
 */
import {z} from "zod";
import {markets,type MarketCode} from "../markets";

export const marketSchema=z.enum(["sa","ae","om","eg","iq"]);
export const supplierProductSchema=z.object({
 market:marketSchema,providerId:z.string().trim().min(1).max(120),
 sku:z.string().trim().min(1).max(200),
 title:z.string().trim().min(1).max(300),
 currency:z.string().length(3),
 costMinor:z.number().int().nonnegative().safe().nullable(),
 stock:z.enum(["available","unavailable","unknown"]),
 stockObservedAt:z.string().datetime({offset:true}).nullable(),
 evidenceRef:z.string().trim().min(1).max(500).nullable(),
 variantSkus:z.array(z.string().trim().min(1).max(200)).max(200),
});
export const supplierOrderRequestSchema=z.object({
 market:marketSchema,internalOrderId:z.string().min(1).max(100),
 idempotencyKey:z.string().min(8).max(160),
 lines:z.array(z.object({supplierSku:z.string().min(1),quantity:z.number().int().positive().max(100)})).min(1).max(100),
 currency:z.string().length(3),
}).strict();
export const supplierOrderReceiptSchema=z.object({
 market:marketSchema,internalOrderId:z.string().min(1),
 idempotencyKey:z.string().min(8),
 accepted:z.boolean(),supplierOrderId:z.string().nullable(),
 observedAt:z.string().datetime({offset:true}),evidenceRef:z.string().nullable(),
}).strict();
export type SupplierProductSnapshot=z.infer<typeof supplierProductSchema>;
export type SupplierOrderRequest=z.infer<typeof supplierOrderRequestSchema>;
export type SupplierOrderReceipt=z.infer<typeof supplierOrderReceiptSchema>;
export type Clock={now():string};
export type Transport={request(input:{method:"GET"|"POST";path:string;body?:unknown;headers?:Readonly<Record<string,string>>}):Promise<unknown>};
export interface SupplierAdapter {
 readonly market:MarketCode;
 listProducts(page:number):Promise<readonly SupplierProductSnapshot[]>;
 readStock(supplierSku:string):Promise<SupplierProductSnapshot>;
 submitOrder(request:SupplierOrderRequest):Promise<SupplierOrderReceipt>;
 readOrder(supplierOrderId:string):Promise<SupplierOrderReceipt>;
}
export function validateSupplierProduct(market:MarketCode,raw:unknown):SupplierProductSnapshot{
 if(raw&&typeof raw==="object"&&("synthetic" in raw||"mayPublish" in raw||"kind" in raw))throw Error("synthetic_supplier_identity_forbidden");
 const p=supplierProductSchema.parse(raw);
 if(p.market!==market||p.currency!==markets[market].currency)throw Error("supplier_market_or_currency_mismatch");
 if(p.sku.startsWith("SIM-")||p.providerId.startsWith("SIM-"))throw Error("synthetic_supplier_identity_forbidden");
 return p;
}
export function validateSupplierOrderRequest(market:MarketCode,raw:unknown):SupplierOrderRequest{
 if(raw&&typeof raw==="object"&&("synthetic" in raw||"mode" in raw))throw Error("synthetic_order_forbidden");
 const p=supplierOrderRequestSchema.parse(raw);
 if(p.market!==market||p.currency!==markets[market].currency)throw Error("supplier_market_or_currency_mismatch");
 if(p.internalOrderId.startsWith("SIM-")||p.lines.some(x=>x.supplierSku.startsWith("SIM-")))throw Error("synthetic_order_forbidden");
 return p;
}
export function validateSupplierOrderReceipt(request:SupplierOrderRequest,raw:unknown):SupplierOrderReceipt{
 const receipt=supplierOrderReceiptSchema.parse(raw);
 if(receipt.market!==request.market||receipt.internalOrderId!==request.internalOrderId||receipt.idempotencyKey!==request.idempotencyKey)throw Error("supplier_receipt_mismatch");
 if(receipt.accepted&&(!receipt.supplierOrderId||!receipt.evidenceRef))throw Error("supplier_acknowledgment_missing");
 if(receipt.supplierOrderId?.startsWith("SIM-"))throw Error("synthetic_receipt_forbidden");
 return receipt;
}
