import {useEffect,useState,type ReactNode} from "react";
import {Check,ChevronDown,HandCoins,RotateCcw,Truck} from "lucide-react";
import {type MarketCode} from "@/lib/store/markets";
import {customerServiceCopy} from "@/lib/store/customer-service-copy";
import {fetchPublicProductPage,formatListingPrice,type PublicDetail,type PublicProductPage} from "@/lib/store/public-catalog";
import {productMediaPath} from "@/lib/store/product-media";

/**
 * Product page for a released listing whose owner-approved page comes from `public_product_page`.
 * Renders only what that release-gated RPC returns; while it loads or when there is no such page,
 * the fallback (plain approved detail) is shown. No order is created from this page.
 */
export function ProductPageView({page,detail,market}:{page:PublicProductPage;detail:PublicDetail;market:MarketCode}){
 const [selected,setSelected]=useState(0);
 const copy=customerServiceCopy[market];
 const image=page.images[selected]??page.images[0];
 return <article dir="rtl" aria-label="تفاصيل المنتج" className="space-y-8">
  <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
   <div className="space-y-3">
    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border bg-[#efe6d7]">
     {image&&<img key={image.id} src={productMediaPath(image.id)} alt={image.alt} width={800} height={800} fetchPriority="high" decoding="async" className="h-full w-full object-contain"/>}
    </div>
    {page.images.length>1&&<div role="group" aria-label="معرض صور المنتج" className="flex gap-2 overflow-x-auto pb-1">
     {page.images.map((img,index)=><button key={img.id} type="button" aria-label={`عرض الصورة ${index+1}`} aria-pressed={index===selected} onClick={()=>setSelected(index)}
       className={"h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-[#efe6d7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary "+(index===selected?"border-primary":"border-transparent")}>
       <img src={productMediaPath(img.id,360)} alt="" width={64} height={64} loading="lazy" decoding="async" className="h-full w-full object-cover"/></button>)}
    </div>}
   </div>
   <div className="space-y-5">
    <div className="space-y-2">
     <h1 className="font-display text-2xl font-extrabold leading-relaxed sm:text-3xl">{page.title}</h1>
     {page.subtitle&&<p className="text-sm leading-7 text-muted-foreground sm:text-base">{page.subtitle}</p>}
    </div>
    <p className="text-2xl font-extrabold text-primary">{formatListingPrice(detail,market)}</p>
    <ul className="grid gap-2 rounded-2xl border bg-card p-4 text-sm leading-7">
     <li className="flex items-start gap-3"><HandCoins className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true"/><span>{copy.paymentHeading}</span></li>
     <li className="flex items-start gap-3"><Truck className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true"/><span>{copy.shipping} {copy.delivery}</span></li>
     <li className="flex items-start gap-3"><RotateCcw className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true"/><span>{copy.returns}</span></li>
    </ul>
    {page.bullets.length>0&&<ul className="space-y-2 text-sm leading-7 sm:text-base">
     {page.bullets.map((b,i)=><li key={i} className="flex items-start gap-3"><Check className="mt-1.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true"/><span>{b}</span></li>)}
    </ul>}
    <p className="rounded-xl bg-muted px-4 py-3 text-sm leading-7 text-muted-foreground">{copy.preCheckoutNotice}</p>
   </div>
  </div>
  <section aria-label="وصف المنتج" className="max-w-3xl space-y-3">
   <h2 className="font-display text-xl font-extrabold">عن المنتج</h2>
   <p className="whitespace-pre-wrap break-words text-sm leading-8 text-muted-foreground sm:text-base">{page.description}</p>
  </section>
  {page.specs.length>0&&<section aria-label="المواصفات" className="max-w-3xl">
   <h2 className="mb-3 font-display text-xl font-extrabold">المواصفات</h2>
   <dl className="divide-y rounded-xl border bg-card px-4">{page.specs.map((s,i)=><div key={i} className="grid grid-cols-2 gap-3 py-3 text-sm"><dt className="font-semibold">{s.label}</dt><dd className="break-words text-muted-foreground">{s.value}</dd></div>)}</dl>
  </section>}
  {page.faq.length>0&&<section aria-label="أسئلة عن المنتج" className="max-w-3xl">
   <h2 className="mb-3 font-display text-xl font-extrabold">أسئلة شائعة</h2>
   <div className="space-y-2">{page.faq.map((f,i)=><details key={i} className="group rounded-2xl border bg-card px-5 py-4">
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-bold marker:hidden">{f.q}<ChevronDown className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden="true"/></summary>
    <p className="pb-2 pt-3 text-sm leading-8 text-muted-foreground">{f.a}</p></details>)}</div>
  </section>}
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
