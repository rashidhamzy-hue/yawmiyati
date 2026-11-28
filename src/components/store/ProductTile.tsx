import {Layers,Tag} from "lucide-react";
import type {ReactNode} from "react";
import type {MarketCode} from "@/lib/store/markets";
import {formatPrice,type PublicListing} from "@/lib/store/public-catalog";
import {productMediaPath} from "@/lib/store/product-media";
import {shopCopy} from "@/lib/store/shop-copy";

export type TileImage={url:string;alt:string}|null|undefined;
export const listingImage=(item:PublicListing):TileImage=>item.image?{url:productMediaPath(item.image,360),alt:item.title}:null;
export const productHref=(market:MarketCode,slug:string)=>`/${market}/p/${encodeURIComponent(slug)}`;

/** One product card for every grid and rail. Shows only what the released listing carries. */
export function ProductTile({item,market,image,eager=false,showOffer=false,className=""}:{item:PublicListing;market:MarketCode;image?:TileImage;eager?:boolean;showOffer?:boolean;className?:string}){
 const copy=shopCopy(market),picture=image===undefined?listingImage(item):image,href=productHref(market,item.slug);
 return <article className={"group relative min-w-0 "+className} data-product-tile="">
  <a href={href} aria-label={item.title} className="flex h-full flex-col rounded-2xl">
   <span className="relative block aspect-square overflow-hidden rounded-2xl bg-surface">
    {picture?<img src={picture.url} alt={picture.alt||item.title} width={360} height={360} loading={eager?"eager":"lazy"} decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"/>
     :<span className="grid h-full w-full place-items-center font-display text-2xl text-muted-foreground/50" aria-hidden="true">يومياتي</span>}
    {(item.kind==="bundle"||(showOffer&&item.offer))&&<span className="pointer-events-none absolute start-2 top-2 flex flex-col items-start gap-1">
     {item.kind==="bundle"&&<span className="ym-chip ym-chip-ink"><Layers className="h-3 w-3" aria-hidden="true"/>{copy.bundleChip}</span>}
     {showOffer&&item.offer&&item.kind!=="bundle"&&<span className="ym-chip bg-card/95 shadow-sm"><Tag className="h-3 w-3" aria-hidden="true"/>{copy.offerChip}</span>}
    </span>}
   </span>
   <span className="flex flex-1 flex-col px-0.5 pt-2.5">
    <h3 className="line-clamp-2 min-h-[2.75rem] font-sans text-[13px] font-medium leading-[1.375rem] text-foreground group-hover:underline sm:text-sm">{item.title}</h3>
    <span className="ym-price mt-1.5 block text-[15px] sm:text-base">{formatPrice(item.price_minor,market)}</span>
   </span>
  </a>
 </article>;
}
export function TileSkeleton(){
 return <div aria-hidden="true"><div className="ym-skeleton aspect-square rounded-2xl"/><div className="ym-skeleton mt-3 h-3.5 w-11/12"/><div className="ym-skeleton mt-2 h-3.5 w-1/2"/></div>;
}
export const gridClass="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-8";
export function ProductGrid({children}:{children:ReactNode}){return <div className={gridClass}>{children}</div>;}
export function GridSkeleton({count=8}:{count?:number}){
 return <div role="status" aria-live="polite" aria-label="جارٍ تحميل المنتجات" className={gridClass}>{Array.from({length:count},(_,i)=><TileSkeleton key={i}/>)}</div>;
}
/** Horizontal rail: thumb-scrollable on phones, a 4–6 column row on wide screens. */
export function ProductRail({title,href,linkLabel,children,id}:{title:string;href?:string;linkLabel?:string;children:ReactNode;id?:string}){
 return <section aria-label={title} id={id} className="ym-section">
  <div className="mb-4 flex items-end justify-between gap-3"><h2 className="ym-h2">{title}</h2>{href&&<a href={href} className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold underline underline-offset-4">{linkLabel}</a>}</div>
  <div className="ym-scroller -mx-4 px-4 sm:mx-0 sm:px-0 [&>*]:w-[42%] sm:[&>*]:w-[30%] md:[&>*]:w-[23%] lg:[&>*]:w-[calc((100%-3.75rem)/6)]">{children}</div>
 </section>;
}
