import {useEffect,useMemo,useState} from "react";
import {ArrowLeft,Check,Minus,Plus,ShieldCheck,Tag,Trash2,Truck} from "lucide-react";
import type {MarketCode} from "@/lib/store/markets";
import {fetchPublicProductPage,formatPrice,type PublicListing} from "@/lib/store/public-catalog";
import {productMediaPath} from "@/lib/store/product-media";
import {catalogConfig,useStoreCatalog} from "@/lib/store/store-catalog";
import {useStoreOffers,type StoreBundle} from "@/lib/store/store-offers";
import {MAX_LINE_QUANTITY,cartCount,lineId,priceForQuantity,setLineQuantity,useShopCart,type CartLine,type QuantityOffer} from "@/lib/store/shop-cart";
import {deliveryFee,egyptDestinations} from "@/lib/store/delivery-fees";
import {cartAddOns} from "@/lib/store/recommendations";
import {customerServiceCopy} from "@/lib/store/customer-service-copy";
import {shopCopy} from "@/lib/store/shop-copy";
import {track} from "@/lib/analytics/analytics";
import {AddOnRow} from "./ProductRecommendations";
import {CodCheckoutForm} from "./CodCheckoutForm";
import {productHref} from "./ProductTile";

export type PricedLine={line:CartLine;available:boolean;total:bigint;saving:bigint;unit:bigint;row:PublicListing|null;bundle:StoreBundle|null;nextSaving:bigint};
/** Prices every cart line from the released catalogue and the approved offers. Pure, so it is unit-tested. */
export function priceCart(lines:readonly CartLine[],rows:readonly PublicListing[],bundles:readonly StoreBundle[],lineOffers:ReadonlyMap<string,readonly QuantityOffer[]>):{lines:PricedLine[];subtotal:bigint;saving:bigint;blocked:boolean}{
 const priced=lines.map((line):PricedLine=>{
  if(line.kind==="item"){
   const row=rows.find(r=>r.listing_id===line.listing_id)??null;
   if(!row)return {line,available:false,total:0n,saving:0n,unit:0n,row:null,bundle:null,nextSaving:0n};
   const unit=BigInt(row.price_minor),offers=lineOffers.get(line.listing_id)??[];
   const now=priceForQuantity(unit,offers,line.quantity);
   const next=line.quantity<MAX_LINE_QUANTITY?priceForQuantity(unit,offers,line.quantity+1):now;
   return {line,available:true,...now,unit,row,bundle:null,nextSaving:next.saving-now.saving};
  }
  const bundle=bundles.find(b=>b.id===line.bundle_id)??null;
  const parts=bundle?.items.map(i=>({i,row:rows.find(r=>r.listing_id===i.listing_id)}))??[];
  if(!bundle||parts.some(p=>!p.row))return {line,available:false,total:0n,saving:0n,unit:0n,row:null,bundle:null,nextSaving:0n};
  const separate=parts.reduce((s,p)=>s+BigInt(p.row!.price_minor)*BigInt(p.i.quantity),0n),unit=BigInt(bundle.price_minor);
  // A set is only a set while it is cheaper than its pieces; otherwise it is not offered.
  if(unit>=separate)return {line,available:false,total:0n,saving:0n,unit:0n,row:null,bundle:null,nextSaving:0n};
  return {line,available:true,total:unit*BigInt(line.quantity),saving:(separate-unit)*BigInt(line.quantity),unit,row:null,bundle,nextSaving:0n};
 });
 const ok=priced.filter(p=>p.available);
 return {lines:priced,subtotal:ok.reduce((s,p)=>s+p.total,0n),saving:ok.reduce((s,p)=>s+p.saving,0n),blocked:priced.some(p=>!p.available)};
}
function useLineOffers(market:MarketCode,lines:readonly CartLine[]){
 const [map,setMap]=useState<Map<string,QuantityOffer[]>>(new Map());
 const wanted=lines.filter(l=>l.kind==="item").map(l=>(l as {listing_id:string}).listing_id+"|"+l.slug).sort().join(",");
 useEffect(()=>{
  let live=true;const {origin,key}=catalogConfig;
  if(!wanted||!origin||!key)return;
  void Promise.all(wanted.split(",").map(async pair=>{const [id,slug]=pair.split("|") as [string,string];try{const page=await fetchPublicProductPage(origin,key,market,slug,id);return [id,page?.quantity_offers??[]] as const;}catch{return [id,[]] as const;}}))
   .then(entries=>{if(live)setMap(new Map(entries.map(([id,o])=>[id,[...o]])));});
  return()=>{live=false;};
 },[market,wanted]);
 return map;
}
const DEST_KEY="yawmiyati.destination.eg";

export function ShopCartPage({market,type}:{market:MarketCode;type:"cart"|"checkout"}){
 const copy=shopCopy(market),service=customerServiceCopy[market],path="/"+market;
 const cart=useShopCart(market),catalog=useStoreCatalog(market),offers=useStoreOffers(market),lineOffers=useLineOffers(market,cart.lines);
 const [destination,setDestination]=useState<string>("");
 const [formValid,setFormValid]=useState(false);
 useEffect(()=>{if(market==="eg")try{setDestination(window.sessionStorage.getItem(DEST_KEY)??"");}catch{/* no session storage */}},[market]);
 const chooseDestination=(v:string)=>{setDestination(v);try{window.sessionStorage.setItem(DEST_KEY,v);}catch{/* ignore */}};
 const rows=catalog.state==="ready"?catalog.rows:[];
 const priced=useMemo(()=>priceCart(cart.lines,rows,offers.bundles,lineOffers),[cart.lines,rows,offers.bundles,lineOffers]);
 // The order bar owns the thumb zone here too (same rule as product pages).
 useEffect(()=>{document.body.classList.add("yawmiyati-product-page");return()=>document.body.classList.remove("yawmiyati-product-page");},[]);
 useEffect(()=>{if(type==="checkout"&&cart.lines.length)track("checkout_viewed",{market,lines:cart.lines.length});},[type,market,cart.lines.length]);
 if(catalog.state==="loading")return <section className="mx-auto max-w-3xl px-4 py-8" aria-busy="true"><div className="ym-skeleton h-8 w-32"/><div className="mt-6 space-y-3">{[0,1].map(i=><div key={i} className="ym-skeleton h-24"/>)}</div></section>;
 if(catalog.state==="error")return <section className="mx-auto max-w-3xl px-4 py-16 text-center"><p className="ym-body" role="alert">{copy.loadError}</p><button type="button" className="btn-outline mt-5" onClick={catalog.retry}>{copy.retry}</button></section>;
 const fee=deliveryFee(market,destination),threshold=offers.free_delivery?BigInt(offers.free_delivery.threshold_minor):null;
 const free=threshold!==null&&priced.subtotal>=threshold&&!priced.blocked;
 const total=free?priced.subtotal:fee===null?null:priced.subtotal+BigInt(fee);
 const left=threshold!==null&&!free?threshold-priced.subtotal:0n;
 const progress=threshold!==null?Math.min(100,Number(priced.subtotal*100n/threshold)):0;
 const inCartRows=priced.lines.flatMap(p=>p.row?[p.row]:[]);
 const addOns=cartAddOns(inCartRows,rows,3);
 const title=(p:PricedLine)=>p.row?.title??p.bundle?.title??p.line.title;
 const picture=(p:PricedLine)=>p.row?.image??p.line.image??(p.bundle?rows.find(r=>r.listing_id===p.bundle!.items[0]!.listing_id)?.image:undefined)??null;

 const summary=<div className="ym-card space-y-3 p-4 sm:p-5" data-cart-summary="">
  {threshold!==null&&<div className="rounded-xl bg-primary-soft px-3.5 py-3" data-free-delivery="">
   <p className={"flex items-center gap-2 text-sm font-semibold "+(free?"text-success":"")}>{free?<Check className="h-4 w-4" aria-hidden="true"/>:<Truck className="h-4 w-4" aria-hidden="true"/>}{free?copy.freeDeliveryReached:copy.freeDeliveryLeft(formatPrice(left,market))}</p>
   <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={copy.freeDeliveryReached}><div className={"h-full rounded-full transition-all duration-500 "+(free?"bg-success":"bg-foreground")} style={{width:progress+"%"}}/></div>
  </div>}
  {market==="eg"&&<label className="block text-sm font-semibold">{copy.destination}
   <select value={destination} onChange={e=>chooseDestination(e.target.value)} className="field mt-1.5 text-base"><option value="">{copy.chooseDestination}</option>{egyptDestinations.map(d=><option key={d} value={d}>{d}</option>)}</select>
  </label>}
  <dl className="space-y-2 text-sm">
   <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{copy.subtotal} · {copy.itemsCount(cartCount(cart))}</dt><dd className="ym-price">{formatPrice(priced.subtotal,market)}</dd></div>
   {priced.saving>0n&&<div className="flex justify-between gap-3 text-sale"><dt className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" aria-hidden="true"/>{copy.youSave}</dt><dd className="font-semibold tabular-nums">{formatPrice(priced.saving,market)}</dd></div>}
   <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{copy.delivery}</dt><dd className={"font-semibold tabular-nums "+(free?"text-success":"")}>{free?copy.deliveryFree:fee===null?copy.deliveryByDestination:formatPrice(fee,market)}</dd></div>
   <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3"><dt className="font-semibold">{total===null?copy.totalBeforeDelivery:copy.totalAtDoor}</dt><dd className="ym-price text-xl" data-cart-total="">{formatPrice(total??priced.subtotal,market)}</dd></div>
  </dl>
  <p className="flex items-start gap-2 text-xs leading-6 text-muted-foreground"><ShieldCheck className="mt-1 h-4 w-4 shrink-0" strokeWidth={1.6} aria-hidden="true"/>{service.paymentHeading} · {copy.reassureCall}</p>
 </div>;

 if(!cart.lines.length)return <section className="mx-auto max-w-xl px-4 py-16 text-center" data-cart-empty="">
  <h1 className="ym-h2">{copy.cartEmptyTitle}</h1><p className="ym-body mt-3">{copy.cartEmptyBody}</p>
  <a href={path+"#discover"} className="btn-primary mt-7">{copy.startShopping}</a>
 </section>;

 const list=<ul className="space-y-3" data-cart-lines="">{priced.lines.map(p=>{const id=lineId(p.line),img=picture(p);return <li key={id} className={"ym-card flex gap-3 p-3 "+(p.available?"":"opacity-70")} data-cart-line="">
   <a href={p.line.kind==="item"?productHref(market,p.line.slug):path+"/offers"} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface" tabIndex={-1} aria-hidden="true">{img&&<img src={productMediaPath(img,360)} alt="" width={80} height={80} loading="lazy" decoding="async" className="h-full w-full object-cover"/>}</a>
   <div className="min-w-0 flex-1">
    {p.line.kind==="bundle"&&<span className="ym-chip ym-chip-ink mb-1">{copy.setChip}</span>}
    <p className="line-clamp-2 text-sm font-medium leading-6">{title(p)}</p>
    {!p.available?<p className="mt-1 text-xs font-semibold text-destructive">{copy.unavailable}</p>:<p className="mt-0.5 flex flex-wrap items-baseline gap-x-2"><span className="ym-price text-[15px]">{formatPrice(p.total,market)}</span>{p.saving>0n&&<span className="text-xs font-medium text-sale">{copy.save(formatPrice(p.saving,market))}</span>}</p>}
    <div className="mt-2 flex items-center justify-between gap-2">
     {type==="cart"&&p.available?<div className="inline-flex items-center rounded-full border border-border" role="group" aria-label={copy.chooseQuantity}>
      <button type="button" className="tap grid place-items-center rounded-full" aria-label={copy.decrease} onClick={()=>setLineQuantity(market,id,p.line.quantity-1)}>{p.line.quantity===1?<Trash2 className="h-4 w-4" aria-hidden="true"/>:<Minus className="h-4 w-4" aria-hidden="true"/>}</button>
      <span className="min-w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">{p.line.quantity}</span>
      <button type="button" className="tap grid place-items-center rounded-full disabled:opacity-30" aria-label={copy.increase} disabled={p.line.quantity>=MAX_LINE_QUANTITY} onClick={()=>setLineQuantity(market,id,p.line.quantity+1)}><Plus className="h-4 w-4" aria-hidden="true"/></button>
     </div>:<span className="text-xs text-muted-foreground">{copy.itemsCount(p.line.quantity)}</span>}
     {(type==="cart"&&!p.available)&&<button type="button" className="btn-quiet" onClick={()=>setLineQuantity(market,id,0)}>{copy.remove}</button>}
    </div>
    {type==="cart"&&p.available&&p.nextSaving>0n&&<button type="button" onClick={()=>setLineQuantity(market,id,p.line.quantity+1)} className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-semibold text-accent-foreground" data-quantity-nudge=""><Tag className="h-3.5 w-3.5" aria-hidden="true"/>{copy.addSecond(formatPrice(p.nextSaving,market))}</button>}
   </div>
  </li>;})}</ul>;

 if(type==="cart")return <section className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 md:pb-12 lg:px-8" data-shop-cart="">
  <h1 className="ym-h2 mb-5">{copy.cartTitle} <span className="font-sans text-sm font-normal text-muted-foreground">· {copy.itemsCount(cartCount(cart))}</span></h1>
  <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
   <div className="space-y-6">{list}
    {addOns.length>0&&<section aria-label={copy.addOnsTitle}><h2 className="ym-h3 mb-3">{copy.addOnsTitle}</h2><ul className="grid gap-2">{addOns.map(item=><AddOnRow key={item.listing_id} item={item} market={market} source="cart_add_on"/>)}</ul></section>}
   </div>
   <div className="space-y-3 lg:sticky lg:top-28">{summary}
    {priced.blocked&&<p role="alert" className="text-sm font-medium text-destructive">{copy.removeUnavailable}</p>}
    <a href={priced.blocked?undefined:path+"/checkout"} aria-disabled={priced.blocked} className={"btn-primary hidden w-full md:flex "+(priced.blocked?"pointer-events-none opacity-50":"")} data-continue="">{copy.continueToOrder}<ArrowLeft className="h-4 w-4" aria-hidden="true"/></a>
   </div>
  </div>
  <div className="fixed inset-x-0 bottom-0 z-[56] border-t border-border bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.625rem)] pt-2.5 backdrop-blur-lg md:hidden">
   <div className="mx-auto flex max-w-xl items-center gap-3"><div className="min-w-0 flex-1"><p className="text-[11px] text-muted-foreground">{total===null?copy.totalBeforeDelivery:copy.totalAtDoor}</p><p className="ym-price text-lg leading-6">{formatPrice(total??priced.subtotal,market)}</p></div>
    <a href={priced.blocked?undefined:path+"/checkout"} aria-disabled={priced.blocked} className={"btn-primary min-w-[9.5rem] flex-none "+(priced.blocked?"pointer-events-none opacity-50":"")}>{copy.continueToOrder}</a></div>
  </div>
 </section>;

 return <section className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 lg:px-8" data-shop-checkout="">
  <a href={path+"/cart"} className="mb-3 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">{copy.backToCart}</a>
  <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
   <div className="ym-card p-4 sm:p-6"><CodCheckoutForm market={market} onValidityChange={setFormValid}/>
    <button type="button" disabled aria-disabled="true" data-submit-order="" data-form-valid={formValid} className="btn-primary mt-5 w-full">{copy.confirmOrder}</button>
    <p role="note" className="mt-3 rounded-xl bg-muted px-4 py-3 text-sm leading-7 text-muted-foreground">{service.preCheckoutNotice}</p>
   </div>
   <div className="space-y-3 lg:sticky lg:top-28"><h2 className="ym-h3">{copy.orderSummary}</h2>{list}{summary}{priced.blocked&&<p role="alert" className="text-sm font-medium text-destructive">{copy.removeUnavailable}</p>}</div>
  </div>
 </section>;
}
