import {useEffect,useState} from "react";
import {Check,Plus} from "lucide-react";
import type {MarketCode} from "@/lib/store/markets";
import {formatPrice,type PublicListing} from "@/lib/store/public-catalog";
import {completeTheSet,relatedProducts} from "@/lib/store/recommendations";
import {rememberViewed,useViewed} from "@/lib/store/recently-viewed";
import {addToCart,useShopCart} from "@/lib/store/shop-cart";
import {shopCopy} from "@/lib/store/shop-copy";
import {track} from "@/lib/analytics/analytics";
import {ProductRail,ProductTile,listingImage,productHref} from "./ProductTile";

/** A compact row with a one-tap add button: used for "complete the set" and cart add-ons. */
export function AddOnRow({item,market,source}:{item:PublicListing;market:MarketCode;source:string}){
 const copy=shopCopy(market),cart=useShopCart(market),image=listingImage(item);
 const inCart=cart.lines.some(l=>l.kind==="item"&&l.listing_id===item.listing_id);
 const add=()=>{addToCart(market,{kind:"item",listing_id:item.listing_id,slug:item.slug,title:item.title,image:item.image??null,quantity:1});track("add_to_cart",{market,slug:item.slug,quantity:1,value_minor:item.price_minor,source});};
 return <li className="ym-card flex items-center gap-3 p-2.5" data-add-on="">
  <a href={productHref(market,item.slug)} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface" tabIndex={-1} aria-hidden="true">{image&&<img src={image.url} alt="" width={64} height={64} loading="lazy" decoding="async" className="h-full w-full object-cover"/>}</a>
  <div className="min-w-0 flex-1"><a href={productHref(market,item.slug)} className="line-clamp-2 text-[13px] font-medium leading-5 hover:underline">{item.title}</a><p className="ym-price mt-0.5 text-sm">{formatPrice(item.price_minor,market)}</p></div>
  <button type="button" onClick={add} disabled={inCart} aria-label={(inCart?copy.addedOne:copy.addOne)+": "+item.title} className={"inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3.5 text-sm font-semibold transition-colors "+(inCart?"bg-primary-soft text-success":"bg-primary text-primary-foreground")}>{inCart?<Check className="h-4 w-4" aria-hidden="true"/>:<Plus className="h-4 w-4" aria-hidden="true"/>}{inCart?copy.addedOne:copy.addOne}</button>
 </li>;
}
export function ViewedRail({market,rows,exclude}:{market:MarketCode;rows:readonly PublicListing[];exclude?:string}){
 const slugs=useViewed(market,exclude);
 const items=slugs.map(s=>rows.find(r=>r.slug===s)).filter((r):r is PublicListing=>!!r).slice(0,8);
 if(items.length<2)return null;
 return <div className="-mx-4 sm:-mx-6 lg:-mx-8" data-viewed-rail=""><ProductRail title={shopCopy(market).viewedTitle}>{items.map(item=><ProductTile key={item.listing_id} item={item} market={market}/>)}</ProductRail></div>;
}
/** Everything under a released product: complete the set, similar products, viewed before. */
export function ProductRecommendations({market,current,rows}:{market:MarketCode;current:PublicListing;rows:readonly PublicListing[]}){
 const copy=shopCopy(market);
 const [ready,setReady]=useState(false);
 // Remember this view after the page has settled; rememberViewed itself does nothing without consent.
 useEffect(()=>{const t=window.setTimeout(()=>{rememberViewed(market,current.slug);setReady(true);},800);return()=>window.clearTimeout(t);},[market,current.slug]);
 const set=completeTheSet(current,rows),setIds=new Set(set.map(r=>r.listing_id));
 const related=relatedProducts(current,rows,10).filter(r=>!setIds.has(r.listing_id)).slice(0,8);
 return <div className="mt-10 space-y-2" data-recommendations="">
  {set.length>0&&<section aria-label={copy.completeSet} className="max-w-3xl">
   <h2 className="ym-h3">{copy.completeSet}</h2><p className="ym-body mb-3 text-sm">{copy.completeSetHint}</p>
   <ul className="grid gap-2 sm:grid-cols-1">{set.map(item=><AddOnRow key={item.listing_id} item={item} market={market} source="complete_the_set"/>)}</ul>
  </section>}
  {related.length>0&&<div className="-mx-4 sm:-mx-6 lg:-mx-8"><ProductRail title={copy.relatedTitle} href={"/"+market+"/search"} linkLabel={copy.seeAll}>{related.map(item=><ProductTile key={item.listing_id} item={item} market={market}/>)}</ProductRail></div>}
  {ready&&<ViewedRail market={market} rows={rows} exclude={current.slug}/>}
 </div>;
}
