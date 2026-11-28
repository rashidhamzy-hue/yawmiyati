import {Check,Truck} from "lucide-react";
import {useEffect,useMemo,useRef} from "react";
import {markets,type MarketCode} from "@/lib/store/markets";
import {formatPrice,type PublicListing} from "@/lib/store/public-catalog";
import {freeDeliveryState,timeLeft,type FreeDeliveryState} from "@/lib/store/free-delivery";
import {useShopCart} from "@/lib/store/shop-cart";
import {shopCopy} from "@/lib/store/shop-copy";
import {useStoreOffers} from "@/lib/store/store-offers";
import {track} from "@/lib/analytics/analytics";
import {useStoreCatalog} from "@/lib/store/store-catalog";
import {priceCart,useLineOffers} from "./ShopCartPage";
const NO_ROWS:readonly PublicListing[]=[];

/** Progress toward the owner-approved free-delivery basket. Renders nothing unless a rule is approved and safe right now. */
export function FreeDeliveryBar({market,state,where}:{market:MarketCode;state:FreeDeliveryState;where:"cart"|"product"}){
 const copy=shopCopy(market),reached=useRef(false);
 useEffect(()=>{
  if(!state.offered&&!state.free)return;
  if(state.free&&!reached.current){reached.current=true;track("free_delivery_reached",{market,where,why:state.why??"",eligible_minor:state.eligible.toString()});}
  if(!state.free)reached.current=false;
 },[state.free,state.offered,state.why,state.eligible,market,where]);
 if(!state.offered&&!state.free)return null;
 return <div className="rounded-xl bg-primary-soft px-3.5 py-3" data-free-delivery={state.free?"reached":"progress"}>
  <p className={"flex items-center gap-2 text-sm font-semibold "+(state.free?"text-success":"")}>{state.free?<Check className="h-4 w-4 flex-none" aria-hidden="true"/>:<Truck className="h-4 w-4 flex-none" aria-hidden="true"/>}{state.free?copy.freeDeliveryReached:copy.freeDeliveryLeft(formatPrice(state.left,market))}</p>
  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.progress} aria-label={copy.freeDeliveryReached}><div className={"h-full rounded-full transition-all duration-500 "+(state.free?"bg-success":"bg-foreground")} style={{width:state.progress+"%"}}/></div>
  {state.partial&&!state.free&&<p className="mt-2 text-xs text-muted-foreground">{copy.freeDeliveryPartial}</p>}
 </div>;
}

/** The cart's free-delivery state for any page (product page uses it under the buy box). */
export function useCartFreeDelivery(market:MarketCode,rows:readonly PublicListing[]){
 const cart=useShopCart(market),offers=useStoreOffers(market),lineOffers=useLineOffers(market,cart.lines);
 return useMemo(()=>{const priced=priceCart(cart.lines,rows,offers.bundles,lineOffers);return freeDeliveryState(priced.lines,offers,lineOffers,priced.blocked);},[cart.lines,rows,offers,lineOffers]);
}
/** Product page: how far the cart is from free delivery. Shown only for a product that counts toward it. */
export default function ProductFreeDelivery({market}:{market:MarketCode}){
 const catalog=useStoreCatalog(market);
 const state=useCartFreeDelivery(market,catalog.state==="ready"?catalog.rows:NO_ROWS);
 return <FreeDeliveryBar market={market} state={state} where="product"/>;
}

const dateLabel=(iso:string,market:MarketCode)=>{try{return new Intl.DateTimeFormat(markets[market].locale+"-u-ca-gregory",{day:"numeric",month:"long",timeZone:"UTC"}).format(new Date(iso));}catch{return iso.slice(0,10);}};
/** "Offer until <date>" with a countdown from the offer's real end date. No end date, no line. */
export function OfferUntil({market,endsAt,compact=false}:{market:MarketCode;endsAt:string;compact?:boolean}){
 const copy=shopCopy(market),left=timeLeft(endsAt);
 if(!left)return null;
 if(compact)return <span className="ym-chip bg-card/95 text-sale shadow-sm" data-offer-until="">{copy.offerUntil(dateLabel(endsAt,market))}</span>;
 return <p className="text-sm font-semibold text-sale" data-offer-until="">{copy.offerUntil(dateLabel(endsAt,market))}{left.days<7&&<span className="ms-2 font-normal text-muted-foreground" suppressHydrationWarning>{copy.offerEndsIn(left.days,left.hours)}</span>}</p>;
}
