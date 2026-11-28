import {lazy,Suspense,useEffect,useState,type ReactNode} from "react";
import {Check,ChevronDown,HandCoins,MessageCircle,Package,RotateCcw,Truck} from "lucide-react";
import {assistantCopy} from "@/lib/store/assistant-copy";
import {openAssistant} from "@/lib/store/assistant-open";
import {type MarketCode} from "@/lib/store/markets";
import {customerServiceCopy} from "@/lib/store/customer-service-copy";
import {fetchPublicProductPage,formatPrice,type PublicDetail,type PublicProductPage} from "@/lib/store/public-catalog";
import {productMediaPath} from "@/lib/store/product-media";
import {shopCopy} from "@/lib/store/shop-copy";
import {ProductGallery} from "./ProductGallery";
import {BuyBox} from "./BuyBox";
import {track} from "@/lib/analytics/analytics";
import {OfferUntil} from "./FreeDeliveryBar";
// The cart-progress bar reads the cart and its offers: loaded after the page, only for products that count.
const ProductFreeDelivery=lazy(()=>import("./FreeDelivery"));

/**
 * Product page for a released listing whose owner-approved page comes from `public_product_page`.
 * Renders only what that release-gated RPC returns; while it loads or when there is no such page,
 * the fallback (plain approved detail) is shown. No order is created from this page.
 */
export function ProductPageView({page,detail,market}:{page:PublicProductPage;detail:PublicDetail;market:MarketCode}){
 const service=customerServiceCopy[market],copy=shopCopy(market);
 const [more,setMore]=useState(false);
 const long=page.description.length>420;
 const pieces=page.bundle.reduce((n,b)=>n+b.quantity,0);
 // An approved time-limited price that is still running replaces the normal price everywhere on the page.
 const sale=page.sale&&BigInt(page.sale.price_minor)<BigInt(detail.price_minor)?page.sale:null;
 const price=sale?String(sale.price_minor):detail.price_minor;
 // Funnel step 1 (view): what the shopper was shown, never who she is.
 useEffect(()=>{track("product_viewed",{market,slug:detail.slug,value_minor:price,on_offer:!!sale,quantity_offers:page.quantity_offers.length,is_set:page.bundle.length>0,
  free_delivery:page.free_delivery,delivery_included:page.delivery_included,low_stock:page.stock_signal==="low"});},[market,detail.slug]); // eslint-disable-line react-hooks/exhaustive-deps
 return <article dir="rtl" aria-label={copy.productDetails} className="space-y-10">
  <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
   <div className="min-w-0 lg:sticky lg:top-28 lg:self-start"><ProductGallery market={market} images={page.images} videos={page.videos}/></div>
   <div className="min-w-0 space-y-5">
    <div className="space-y-2">
     {(page.bundle.length>0||page.stock_signal==="low")&&<p className="flex flex-wrap gap-2">
      {page.bundle.length>0&&<span className="ym-chip ym-chip-ink"><Package className="h-3 w-3" aria-hidden="true"/>{copy.inThisSet(pieces)}</span>}
      {page.stock_signal==="low"&&<span className="ym-chip ym-chip-sand" data-stock-signal="">{copy.lowStock}</span>}
     </p>}
     <h1 className="ym-h2 break-words">{page.title}</h1>
     {(page.benefit_line||page.subtitle)&&<p className="ym-body" data-benefit-line="">{page.benefit_line||page.subtitle}</p>}
    </div>
    <div className="space-y-1.5">
     <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className={"ym-price text-[1.75rem] leading-none "+(sale?"text-sale":"")} data-price="">{formatPrice(price,market)}</span>
      {/* Crossed out only when the database confirms the product was sold at that price before the offer. */}
      {sale?.was_price_minor&&<s className="text-base text-muted-foreground" data-was-price="">{formatPrice(String(sale.was_price_minor),market)}</s>}</p>
     {sale&&<OfferUntil market={market} endsAt={sale.ends_at}/>}
     {page.delivery_included&&<p className="flex items-center gap-2 text-sm font-semibold text-success" data-delivery-included=""><Truck className="h-4 w-4" aria-hidden="true"/>{copy.deliveryIncludedNote}</p>}
    </div>
    <BuyBox market={market} target={{listing_id:detail.listing_id,slug:detail.slug,title:page.title,image:page.images[0]?.id??null,price_minor:price}} offers={page.quantity_offers}/>
    {page.free_delivery&&!page.delivery_included&&<Suspense fallback={null}><ProductFreeDelivery market={market}/></Suspense>}
    <button type="button" className="btn-quiet w-full justify-center text-sm" onClick={()=>openAssistant(assistantCopy(market).productQuestion(page.title))} data-ask-assistant=""><MessageCircle className="h-4 w-4" aria-hidden="true"/>{assistantCopy(market).askAboutProduct}</button>
    <ul className="ym-card divide-y divide-border px-4 text-sm leading-7">
     <li className="flex items-start gap-3 py-3"><HandCoins className="mt-1 h-5 w-5 shrink-0" strokeWidth={1.6} aria-hidden="true"/><span><span className="font-semibold">{service.paymentHeading}</span><span className="block text-muted-foreground">{copy.reassureCall}</span></span></li>
     <li className="flex items-start gap-3 py-3"><Truck className="mt-1 h-5 w-5 shrink-0" strokeWidth={1.6} aria-hidden="true"/><span className="text-muted-foreground">{service.shipping} {service.delivery}</span></li>
     <li className="flex items-start gap-3 py-3"><RotateCcw className="mt-1 h-5 w-5 shrink-0" strokeWidth={1.6} aria-hidden="true"/><span className="text-muted-foreground">{service.returns}</span></li>
    </ul>
    {page.bullets.length>0&&<ul className="space-y-2.5 text-[15px] leading-7">
     {page.bullets.map((b,i)=><li key={i} className="flex items-start gap-3"><Check className="mt-1.5 h-4 w-4 shrink-0" aria-hidden="true"/><span className="min-w-0 break-words">{b}</span></li>)}
    </ul>}
   </div>
  </div>
  {page.bundle.length>0&&<section aria-label={copy.bundleContents} className="max-w-3xl">
   <h2 className="ym-h3 mb-3">{copy.bundleContents}</h2>
   <ul className="grid gap-2 sm:grid-cols-2">{page.bundle.map((b,i)=><li key={i} className="ym-card flex items-center gap-3 p-3 text-sm">
    {b.image?<img src={productMediaPath(b.image,360)} alt="" width={56} height={56} loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded-xl bg-surface object-cover"/>:<span className="h-14 w-14 shrink-0 rounded-xl bg-surface" aria-hidden="true"/>}
    <span className="min-w-0 flex-1 break-words leading-6">{b.name}</span><span className="shrink-0 font-bold tabular-nums">× {b.quantity}</span>
   </li>)}</ul>
  </section>}
  <section aria-label={copy.aboutProduct} className="max-w-3xl">
   <h2 className="ym-h3 mb-3">{copy.aboutProduct}</h2>
   <p id="product-description" className={"whitespace-pre-wrap break-words text-[15px] leading-8 text-muted-foreground "+(long&&!more?"line-clamp-6":"")}>{page.description}</p>
   {long&&<button type="button" aria-expanded={more} aria-controls="product-description" onClick={()=>setMore(v=>!v)} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">{more?copy.readLess:copy.readMore}</button>}
  </section>
  {page.in_box.length>0&&<section aria-label={copy.inBox} className="max-w-3xl">
   <h2 className="ym-h3 mb-3">{copy.inBox}</h2>
   <ul className="ym-card divide-y divide-border px-4 text-sm">{page.in_box.map((b,i)=><li key={i} className="flex items-start gap-3 py-3"><Package className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"/><span className="min-w-0 break-words">{b}</span></li>)}</ul>
  </section>}
  {page.how_to_use.length>0&&<section aria-label={copy.howToUse} className="max-w-3xl">
   <h2 className="ym-h3 mb-3">{copy.howToUse}</h2>
   <ol className="space-y-2.5 text-[15px] leading-7">{page.how_to_use.map((b,i)=><li key={i} className="flex items-start gap-3"><span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums" aria-hidden="true">{i+1}</span><span className="min-w-0 break-words">{b}</span></li>)}</ol>
  </section>}
  {page.specs.length>0&&<section aria-label={copy.specs} className="max-w-3xl">
   <h2 className="ym-h3 mb-3">{copy.specs}</h2>
   <dl className="ym-card divide-y divide-border px-4">{page.specs.map((s,i)=><div key={i} className="grid grid-cols-[2fr_3fr] gap-3 py-3 text-sm"><dt className="font-semibold">{s.label}</dt><dd className="min-w-0 break-words text-muted-foreground">{s.value}</dd></div>)}</dl>
  </section>}
  {page.faq.length>0&&<section aria-label={copy.productFaq} className="max-w-3xl">
   <h2 className="ym-h3 mb-3">{copy.productFaq}</h2>
   <div className="space-y-2">{page.faq.map((f,i)=><details key={i} className="group ym-card px-5 py-3">
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold marker:hidden">{f.q}<ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true"/></summary>
    <p className="pb-2 pt-2 text-sm leading-8 text-muted-foreground">{f.a}</p></details>)}</div>
  </section>}
  {page.category&&copy.sectionNames[page.category]&&<p className="max-w-3xl"><a href={`/${market}/c/${page.category}`} data-section-link="" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">{copy.moreFromSection(copy.sectionNames[page.category])}</a></p>}
 </article>;
}

export function ReleasedProductPage({origin,apiKey,market,detail,fallback}:{origin:string;apiKey:string;market:MarketCode;detail:PublicDetail;fallback:ReactNode}){
 const [page,setPage]=useState<PublicProductPage|null>(null);
 useEffect(()=>{
  let active=true;setPage(null);
  fetchPublicProductPage(origin,apiKey,market,detail.slug,detail.listing_id).then(p=>{if(active)setPage(p);}).catch(()=>{});
  return()=>{active=false;};
 },[origin,apiKey,market,detail.slug,detail.listing_id]);
 useEffect(()=>{
  if(!page?.seo.title)return;
  const previous=document.title,meta=document.querySelector<HTMLMetaElement>('meta[name="description"]'),desc=meta?.content;
  document.title=page.seo.title;if(meta&&page.seo.description)meta.content=page.seo.description;
  return()=>{if(document.title===page.seo.title)document.title=previous;if(meta&&desc!==undefined&&meta.content===page.seo.description)meta.content=desc;};
 },[page]);
 return page?<ProductPageView page={page} detail={detail} market={market}/>:<>{fallback}</>;
}
