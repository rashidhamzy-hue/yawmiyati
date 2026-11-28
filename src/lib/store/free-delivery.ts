import type {PublicListing} from "./public-catalog";
import type {CartLine} from "./shop-cart";
import type {StoreBundle,StoreOffers} from "./store-offers";

/**
 * Free delivery in the cart, from owner-approved rules only (public_store_offers, re-checked by the database on
 * every read). Two ways an order ships free:
 *   - it holds a product whose price already includes delivery;
 *   - the ELIGIBLE lines reach the approved basket value. A line is eligible only when the database flagged it:
 *     a single product by its own flag, a quantity-offer price only when every approved offer of that product is
 *     flagged too, a set by the set's flag. Anything unflagged still ships, it just does not count.
 * The same rule must be applied by the server when orders are priced (G3). Pure, unit-tested.
 */
export type FreeDeliveryLine={line:CartLine;available:boolean;total:bigint;saving:bigint;row:PublicListing|null;bundle:StoreBundle|null};
export type FreeDeliveryState={
 /** A threshold rule is approved and running. */
 offered:boolean;free:boolean;why:"included"|"threshold"|null;
 threshold:bigint|null;eligible:bigint;left:bigint;progress:number;
 /** Some lines do not count toward the threshold (shown as a short note). */
 partial:boolean};
export function lineEligible(p:FreeDeliveryLine,quantityOffers:readonly {free_delivery?:boolean}[]):boolean{
 if(!p.available)return false;
 if(p.line.kind==="bundle")return p.bundle?.free_delivery===true;
 if(p.row?.free_delivery!==true)return false;
 // A discounted quantity price counts only if the database flagged every approved offer of this product.
 return p.saving===0n||quantityOffers.every(o=>o.free_delivery===true);
}
export function freeDeliveryState(lines:readonly FreeDeliveryLine[],offers:StoreOffers,lineOffers:ReadonlyMap<string,readonly {free_delivery?:boolean}[]>,blocked=false):FreeDeliveryState{
 const ok=lines.filter(l=>l.available);
 const included=!blocked&&ok.some(l=>l.line.kind==="item"&&(l.row?.delivery_included===true||offers.delivery_included.includes(l.line.listing_id)));
 const threshold=offers.free_delivery?BigInt(offers.free_delivery.threshold_minor):null;
 let eligible=0n,partial=false;
 for(const l of ok){
  if(lineEligible(l,l.line.kind==="item"?lineOffers.get(l.line.listing_id)??[]:[]))eligible+=l.total;else partial=true;
 }
 const reached=threshold!==null&&eligible>=threshold&&!blocked;
 const left=threshold!==null&&!reached?threshold-eligible:0n;
 const progress=threshold!==null&&threshold>0n?Math.min(100,Number(eligible*100n/threshold)):0;
 return {offered:threshold!==null,free:included||reached,why:included?"included":reached?"threshold":null,threshold,eligible,left,progress:included?100:progress,partial:threshold!==null&&partial&&!included};
}
/** Whole days and hours until an approved offer ends (never negative; null once it has ended). */
export function timeLeft(endsAt:string,now:number=Date.now()):{days:number;hours:number}|null{
 const ms=Date.parse(endsAt)-now;
 if(!Number.isFinite(ms)||ms<=0)return null;
 return {days:Math.floor(ms/86_400_000),hours:Math.floor(ms%86_400_000/3_600_000)};
}
