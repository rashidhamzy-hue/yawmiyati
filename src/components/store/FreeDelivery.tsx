import {useMemo} from "react";
import type {MarketCode} from "@/lib/store/markets";
import type {PublicListing} from "@/lib/store/public-catalog";
import {freeDeliveryState} from "@/lib/store/free-delivery";
import {useShopCart} from "@/lib/store/shop-cart";
import {useStoreOffers} from "@/lib/store/store-offers";
import {useStoreCatalog} from "@/lib/store/store-catalog";
import {priceCart,useLineOffers} from "./ShopCartPage";
import {FreeDeliveryBar} from "./FreeDeliveryBar";
const NO_ROWS:readonly PublicListing[]=[];

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

