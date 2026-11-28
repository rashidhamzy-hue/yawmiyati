import {useEffect,useRef,useState} from "react";
import {Check,ShoppingBag} from "lucide-react";
import type {MarketCode} from "@/lib/store/markets";
import {formatPrice} from "@/lib/store/public-catalog";
import {addToCart,priceForQuantity,type QuantityOffer} from "@/lib/store/shop-cart";
import {shopCopy} from "@/lib/store/shop-copy";
import {track} from "@/lib/analytics/analytics";

export type BuyTarget={listing_id:string;slug:string;title:string;image:string|null;price_minor:string};
/**
 * Quantity choice (single price and the approved "N for X" offers), the order buttons, and the bar that
 * keeps the order button under her thumb on phones once the main button scrolls away.
 */
export function BuyBox({market,target,offers}:{market:MarketCode;target:BuyTarget;offers:readonly QuantityOffer[]}){
 const copy=shopCopy(market),unit=BigInt(target.price_minor);
 const real=offers.filter(o=>BigInt(o.price_minor)<unit*BigInt(o.quantity));
 const options=[1,...real.map(o=>o.quantity)].filter((q,i,a)=>a.indexOf(q)===i).sort((a,b)=>a-b).map(q=>({quantity:q,...priceForQuantity(unit,offers,q)})).filter(o=>o.quantity===1||o.saving>0n);
 const [quantity,setQuantity]=useState(1),[added,setAdded]=useState(false),[pinned,setPinned]=useState(false);
 const anchor=useRef<HTMLDivElement>(null);
 const chosen=options.find(o=>o.quantity===quantity)??options[0]!;
 const bestSaving=options.reduce((m,o)=>o.saving>m?o.saving:m,0n);
 useEffect(()=>{
  const el=anchor.current;if(!el||typeof IntersectionObserver==="undefined")return;
  const io=new IntersectionObserver(([e])=>setPinned(!!e&&!e.isIntersecting&&e.boundingClientRect.top<0),{threshold:0});
  io.observe(el);return()=>io.disconnect();
 },[]);
 useEffect(()=>{document.body.classList.add("yawmiyati-product-page");return()=>document.body.classList.remove("yawmiyati-product-page");},[]);
 const label=(q:number)=>q===1?copy.onePiece:q===2?copy.twoPieces:copy.pieces(q);
 const add=(go:boolean)=>{
  addToCart(market,{kind:"item",listing_id:target.listing_id,slug:target.slug,title:target.title,image:target.image,quantity:chosen.quantity});
  track("add_to_cart",{market,slug:target.slug,quantity:chosen.quantity,value_minor:chosen.total.toString(),source:go?"order_now":"add"});
  if(go)window.location.assign("/"+market+"/checkout");else{setAdded(true);window.setTimeout(()=>setAdded(false),4000);}
 };
 return <div className="space-y-4" data-buy-box="">
  {options.length>1&&<fieldset>
   <legend className="mb-2 text-sm font-semibold">{copy.chooseQuantity}</legend>
   <div className="grid gap-2">{options.map(o=>{const on=o.quantity===chosen.quantity;return <label key={o.quantity} className={"flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-2.5 transition-colors "+(on?"border-foreground bg-card ring-1 ring-foreground":"border-border bg-card hover:border-foreground/40")}>
     <input type="radio" name="quantity" value={o.quantity} checked={on} onChange={()=>{setQuantity(o.quantity);if(o.quantity>1)track("offer_selected",{market,slug:target.slug,quantity:o.quantity,value_minor:o.total.toString(),saving_minor:o.saving.toString()});}} className="h-4 w-4 accent-[var(--foreground)]"/>
     <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label(o.quantity)}</span>{o.saving>0n&&<span className="block text-xs font-medium text-sale">{copy.save(formatPrice(o.saving,market))}</span>}</span>
     {o.saving>0n&&o.saving===bestSaving&&options.length>2&&<span className="ym-chip ym-chip-sand">{copy.bestValue}</span>}
     <span className="ym-price text-base">{formatPrice(o.total,market)}</span>
    </label>;})}</div>
  </fieldset>}
  <div ref={anchor} className="grid gap-2 sm:grid-cols-[1.4fr_1fr]">
   <button type="button" className="btn-primary w-full" onClick={()=>add(true)} data-order-now="">{copy.orderNow}</button>
   <button type="button" className="btn-outline w-full" onClick={()=>add(false)} data-add-to-cart=""><ShoppingBag className="h-[18px] w-[18px]" aria-hidden="true"/>{copy.addToCart}</button>
  </div>
  <p role="status" aria-live="polite" className={"flex min-h-6 items-center gap-2 text-sm font-medium text-success "+(added?"":"invisible")}><Check className="h-4 w-4" aria-hidden="true"/>{copy.addedToCart} · <a href={"/"+market+"/cart"} className="underline underline-offset-4">{copy.viewCart}</a></p>
  <div data-buy-bar="" aria-hidden={!pinned} className={"fixed inset-x-0 bottom-0 z-[56] border-t border-border bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.625rem)] pt-2.5 shadow-[0_-6px_24px_rgba(0,0,0,.08)] backdrop-blur-lg transition-transform duration-200 md:hidden "+(pinned?"translate-y-0":"translate-y-full")}>
   <div className="mx-auto flex max-w-xl items-center gap-3">
    <div className="min-w-0 flex-1"><p className="truncate text-[11px] text-muted-foreground">{label(chosen.quantity)}</p><p className="ym-price text-lg leading-6">{formatPrice(chosen.total,market)}</p></div>
    <button type="button" tabIndex={pinned?0:-1} className="btn-primary min-w-[9.5rem] flex-none" onClick={()=>add(true)}>{copy.orderNow}</button>
   </div>
  </div>
 </div>;
}
