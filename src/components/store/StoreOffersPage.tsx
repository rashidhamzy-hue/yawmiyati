import {Check,Layers,Truck} from "lucide-react";
import type {MarketCode} from "@/lib/store/markets";
import {formatPrice,type PublicListing} from "@/lib/store/public-catalog";
import {productMediaPath} from "@/lib/store/product-media";
import {useStoreCatalog} from "@/lib/store/store-catalog";
import {useStoreOffers,type StoreBundle} from "@/lib/store/store-offers";
import {addToCart,useShopCart} from "@/lib/store/shop-cart";
import {customerServiceCopy} from "@/lib/store/customer-service-copy";
import {shopCopy} from "@/lib/store/shop-copy";
import {track} from "@/lib/analytics/analytics";
import {StoreFrame} from "./StoreChrome";
import {GridSkeleton,ProductTile,gridClass,productHref} from "./ProductTile";

type Resolved={bundle:StoreBundle;parts:{row:PublicListing;quantity:number}[];separate:bigint;saving:bigint};
/** A set is offered only while every piece is released and the set is cheaper than its pieces. */
export function resolveSets(bundles:readonly StoreBundle[],rows:readonly PublicListing[]):Resolved[]{
 return bundles.flatMap(bundle=>{
  const parts=bundle.items.map(i=>({row:rows.find(r=>r.listing_id===i.listing_id),quantity:i.quantity}));
  if(parts.some(p=>!p.row))return [];
  const ok=parts as {row:PublicListing;quantity:number}[];
  const separate=ok.reduce((s,p)=>s+BigInt(p.row.price_minor)*BigInt(p.quantity),0n),saving=separate-BigInt(bundle.price_minor);
  return saving>0n?[{bundle,parts:ok,separate,saving}]:[];
 });
}
const setHref=(market:MarketCode,slug:string)=>`/${market}/set/${encodeURIComponent(slug)}`;
function AddSet({market,set,wide=false,compact=false}:{market:MarketCode;set:Resolved;wide?:boolean;compact?:boolean}){
 const copy=shopCopy(market),cart=useShopCart(market),inCart=cart.lines.some(l=>l.kind==="bundle"&&l.bundle_id===set.bundle.id);
 const add=()=>{addToCart(market,{kind:"bundle",bundle_id:set.bundle.id,slug:set.bundle.slug,title:set.bundle.title,image:set.parts[0]!.row.image??null,quantity:1});track("add_to_cart",{market,slug:set.bundle.slug,quantity:1,value_minor:String(set.bundle.price_minor),source:"set"});};
 return inCart?<a href={"/"+market+"/cart"} className={"btn-outline whitespace-nowrap "+(wide?"w-full":"")+(compact?" min-h-11 px-3 text-sm":"")}><Check className="h-4 w-4" aria-hidden="true"/>{copy.viewCart}</a>
  :<button type="button" onClick={add} className={"btn-primary whitespace-nowrap "+(wide?"w-full":"")+(compact?" min-h-11 px-3 text-sm":"")} data-add-set="">{copy.addSet}</button>;
}
function Pieces({set,size}:{set:Resolved;size:"card"|"page"}){
 return <div className={"grid gap-1.5 overflow-hidden rounded-2xl bg-surface "+(set.parts.length===2?"grid-cols-2":"grid-cols-3")}>
  {set.parts.map(p=><div key={p.row.listing_id} className="aspect-square overflow-hidden bg-surface">{p.row.image&&<img src={productMediaPath(p.row.image,360)} alt={p.row.title} width={360} height={360} loading={size==="page"?"eager":"lazy"} decoding="async" className="h-full w-full object-cover"/>}</div>)}
 </div>;
}
function SetCard({market,set}:{market:MarketCode;set:Resolved}){
 const copy=shopCopy(market);
 return <article className="ym-card flex min-w-0 flex-col gap-2.5 p-2 sm:p-3" data-set-card="">
  <a href={setHref(market,set.bundle.slug)} aria-label={set.bundle.title} className="block"><Pieces set={set} size="card"/></a>
  <div className="flex flex-1 flex-col gap-2 px-1 pb-1">
   <span className="ym-chip ym-chip-ink self-start"><Layers className="h-3 w-3" aria-hidden="true"/>{copy.setChip}</span>
   <h3 className="line-clamp-2 font-sans text-sm font-medium leading-6"><a href={setHref(market,set.bundle.slug)} className="hover:underline">{set.bundle.title}</a></h3>
   <p className="flex flex-wrap items-baseline gap-x-2"><span className="ym-price text-base sm:text-lg">{formatPrice(set.bundle.price_minor,market)}</span><span className="text-xs text-muted-foreground">{copy.insteadOf(formatPrice(set.separate,market))}</span></p>
   <p className="text-xs font-semibold text-sale">{copy.save(formatPrice(set.saving,market))}</p>
   <div className="mt-auto pt-1"><AddSet market={market} set={set} wide compact/></div>
  </div>
 </article>;
}
/** Landing page for everything that raises order value: free delivery, our sets, ready-made sets, quantity deals. */
export function StoreOffersPage({market}:{market:MarketCode}){
 const copy=shopCopy(market),catalog=useStoreCatalog(market),offers=useStoreOffers(market);
 const rows=catalog.state==="ready"?catalog.rows:[];
 const sets=resolveSets(offers.bundles,rows),ready=rows.filter(r=>r.kind==="bundle"),deals=rows.filter(r=>r.offer&&r.kind!=="bundle");
 const nothing=catalog.state==="ready"&&!sets.length&&!ready.length&&!deals.length&&!offers.free_delivery;
 return <StoreFrame market={market}>
  <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8" data-offers-page="">
   <nav aria-label="مسار الصفحة" className="mb-3 text-sm text-muted-foreground"><a href={"/"+market} className="hover:underline">{copy.breadcrumbHome}</a> / {copy.offersNav}</nav>
   <header className="max-w-2xl"><h1 className="ym-h1">{copy.offersTitle}</h1><p className="ym-body mt-2">{copy.offersIntro}</p></header>
   {offers.free_delivery&&rows.length>0&&<p className="mt-5 flex items-center gap-3 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground" data-free-delivery-banner=""><Truck className="h-5 w-5 shrink-0" strokeWidth={1.6} aria-hidden="true"/>{copy.freeDeliveryFrom(formatPrice(offers.free_delivery.threshold_minor,market))}</p>}
   {catalog.state==="loading"&&<div className="mt-8"><GridSkeleton count={8}/></div>}
   {catalog.state==="error"&&<div className="ym-card mt-8 p-8 text-center" role="alert"><p className="ym-body">{copy.loadError}</p><button type="button" className="btn-outline mt-4" onClick={catalog.retry}>{copy.retry}</button></div>}
   {nothing&&<div className="ym-card mt-8 px-5 py-12 text-center" role="status"><h2 className="ym-h3">{copy.offersEmptyTitle}</h2><p className="ym-body mt-2">{copy.offersEmptyBody}</p><a href={"/"+market+"/search"} className="btn-outline mt-5">{copy.allProducts}</a></div>}
   {sets.length>0&&<section aria-label={copy.ourSetsTitle} className="mt-10"><h2 className="ym-h2 mb-4">{copy.ourSetsTitle}</h2><div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">{sets.map(s=><SetCard key={s.bundle.id} market={market} set={s}/>)}</div></section>}
   {ready.length>0&&<section aria-label={copy.readySetsTitle} className="mt-12"><h2 className="ym-h2 mb-4">{copy.readySetsTitle}</h2><div className={gridClass}>{ready.slice(0,8).map(item=><ProductTile key={item.listing_id} item={item} market={market}/>)}</div>{ready.length>8&&<div className="mt-6 text-center"><a href={"/"+market+"/search"} className="btn-outline">{copy.seeAll}</a></div>}</section>}
   {deals.length>0&&<section aria-label={copy.quantityDealsTitle} className="mt-12"><h2 className="ym-h2 mb-4">{copy.quantityDealsTitle}</h2><div className={gridClass}>{deals.slice(0,12).map(item=><ProductTile key={item.listing_id} item={item} market={market} showOffer/>)}</div></section>}
  </div>
 </StoreFrame>;
}
/** Page of one of our own sets: what is inside, the set price against buying singly, and one button to add it. */
export function StoreSetPage({market,slug}:{market:MarketCode;slug:string}){
 const copy=shopCopy(market),service=customerServiceCopy[market],catalog=useStoreCatalog(market),offers=useStoreOffers(market);
 const rows=catalog.state==="ready"?catalog.rows:[];
 const set=resolveSets(offers.bundles,rows).find(s=>s.bundle.slug===slug);
 return <StoreFrame market={market}>
  <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 lg:px-8" data-set-page="">
   <nav aria-label="مسار الصفحة" className="mb-4 text-sm text-muted-foreground"><a href={"/"+market} className="hover:underline">{copy.breadcrumbHome}</a> / <a href={"/"+market+"/offers"} className="hover:underline">{copy.offersNav}</a></nav>
   {catalog.state==="loading"?<div className="grid gap-6 lg:grid-cols-2" aria-busy="true"><div className="ym-skeleton aspect-[2/1]"/><div className="space-y-3"><div className="ym-skeleton h-8 w-3/4"/><div className="ym-skeleton h-6 w-1/3"/><div className="ym-skeleton h-14"/></div></div>
   :!set?<div className="ym-card px-5 py-12 text-center" role="status"><h1 className="ym-h3">{copy.setNotFoundTitle}</h1><a href={"/"+market+"/offers"} className="btn-outline mt-5">{copy.offersNav}</a></div>
   :<article className="grid gap-6 lg:grid-cols-2 lg:gap-12">
     <div className="min-w-0"><Pieces set={set} size="page"/></div>
     <div className="min-w-0 space-y-5">
      <div className="space-y-2"><span className="ym-chip ym-chip-ink"><Layers className="h-3 w-3" aria-hidden="true"/>{copy.setChip}</span><h1 className="ym-h2 break-words">{set.bundle.title}</h1></div>
      <div><p className="flex flex-wrap items-baseline gap-x-3"><span className="ym-price text-[1.75rem] leading-none">{formatPrice(set.bundle.price_minor,market)}</span><span className="text-sm text-muted-foreground">{copy.insteadOf(formatPrice(set.separate,market))}</span></p>
       <p className="mt-2 text-sm font-semibold text-sale">{copy.setSave(formatPrice(set.saving,market))}</p></div>
      <AddSet market={market} set={set} wide/>
      <section aria-label={copy.setContains}><h2 className="ym-h3 mb-3">{copy.setContains}</h2>
       <ul className="grid gap-2">{set.parts.map(p=><li key={p.row.listing_id} className="ym-card flex items-center gap-3 p-2.5">
        <a href={productHref(market,p.row.slug)} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface" tabIndex={-1} aria-hidden="true">{p.row.image&&<img src={productMediaPath(p.row.image,360)} alt="" width={64} height={64} loading="lazy" decoding="async" className="h-full w-full object-cover"/>}</a>
        <div className="min-w-0 flex-1"><a href={productHref(market,p.row.slug)} className="line-clamp-2 text-[13px] font-medium leading-5 hover:underline">{p.row.title}</a><p className="mt-0.5 text-xs text-muted-foreground">{formatPrice(p.row.price_minor,market)}</p></div>
        <span className="shrink-0 font-bold tabular-nums">× {p.quantity}</span></li>)}</ul></section>
      <p className="text-sm leading-7 text-muted-foreground">{service.paymentHeading} · {copy.reassureCall}. {service.shipping}</p>
     </div>
    </article>}
  </div>
 </StoreFrame>;
}
