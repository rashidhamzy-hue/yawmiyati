import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { MarketCode } from "./markets";
import { formatListingPrice, type PublicDetail, type PublicListing } from "./public-catalog";
import { filterApprovedListings, presentApprovedDetail, type ApprovedExtra, type ApprovedSort } from "./approved-product-experience";

/**
 * Reusable public-catalog presentation components.
 * Deliberately NO import of fictional catalog or simulation modules, no
 * checkout actions, and no product claims beyond released RPC fields.
 * Approval extras must come only from a future release-gated public RPC.
 */
export function ApprovedProductGallery({detail,market,extras}:{detail:PublicDetail;market:MarketCode;extras?:ApprovedExtra}) {
  const product=presentApprovedDetail(detail,market,extras);
  const [selected,setSelected]=useState(0);
  const [variantId,setVariantId]=useState("");
  const image=product.images[selected] ?? product.images[0];
  const chosenVariant=product.variants.find(v=>v.id===variantId);
  return <article dir="rtl" className="grid gap-6 lg:grid-cols-2" aria-label="تفاصيل المنتج">
    <div className="space-y-3">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border bg-muted">
        {image?<img key={image.id} src={image.url} alt={image.alt} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain"/>:
        <div className="flex flex-col items-center gap-3 px-5 text-center text-muted-foreground"><ImageOff aria-hidden="true" className="h-12 w-12"/><span>لا تتوفر صورة معتمدة لهذا المنتج</span></div>}
      </div>
      {product.images.length>1&&<div role="group" aria-label="معرض صور المنتج" className="flex flex-wrap gap-2">
        {product.images.map((img,index)=><button key={img.id} type="button" aria-label={`عرض الصورة ${index+1}`} aria-pressed={image?.id===img.id} onClick={()=>setSelected(index)} className="h-16 w-16 overflow-hidden rounded-xl border-2 aria-current={false} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" style={{borderColor:image?.id===img.id?"currentColor":undefined}}><img src={img.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover"/></button>)}
      </div>}
    </div>
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold leading-relaxed">{product.title}</h1>
      <p className="text-xl font-bold">{product.price}</p>
      {product.description.trim()&&<p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{product.description}</p>}
      {product.variants.length>0&&<fieldset className="space-y-2"><legend className="text-sm font-bold">الخيارات المعتمدة</legend><div className="flex flex-wrap gap-2">{product.variants.map(v=><button key={v.id} type="button" aria-pressed={chosenVariant?.id===v.id} onClick={()=>setVariantId(v.id)} className={`min-h-11 rounded-xl border px-4 py-2 text-sm ${chosenVariant?.id===v.id?"border-primary bg-muted font-bold":""}`}>{v.label}</button>)}</div><p className="text-xs text-muted-foreground">اختيار للعرض فقط؛ لا توجد معلومات مخزون أو شراء مؤكدة.</p></fieldset>}
      {product.specifications.length>0&&<section aria-label="المواصفات المعتمدة"><h2 className="mb-3 text-base font-bold">المواصفات</h2><dl className="divide-y rounded-xl border px-4">{product.specifications.map((s,index)=><div key={index} className="grid grid-cols-2 gap-3 py-3 text-sm"><dt className="font-semibold">{s.label}</dt><dd className="break-words text-muted-foreground">{s.value}</dd></div>)}</dl></section>}
      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">الشراء غير متاح حالياً. تفاصيل التوفر والتوصيل والدفع غير مؤكدة.</p>
    </div>
  </article>;
}

export function ApprovedCatalogBrowser({market,products,onOpen}:{market:MarketCode;products:readonly PublicListing[];onOpen?:(slug:string)=>void}) {
  const [query,setQuery]=useState("");
  const [sort,setSort]=useState<ApprovedSort>("default");
  const [min,setMin]=useState("");
  const [max,setMax]=useState("");
  const [page,setPage]=useState(1);
  // Filter inputs represent minor units to avoid floating-point currency rounding.
  const minPriceMinor=min?Number(min):undefined;
  const maxPriceMinor=max?Number(max):undefined;
  const invalidRange=(min!==""&&(!/^\\d+$/.test(min)||!Number.isSafeInteger(minPriceMinor)))||
    (max!==""&&(!/^\\d+$/.test(max)||!Number.isSafeInteger(maxPriceMinor)))||
    (minPriceMinor!==undefined&&maxPriceMinor!==undefined&&minPriceMinor>maxPriceMinor);
  const result=invalidRange?null:filterApprovedListings(products,market,{query,sort,minPriceMinor,maxPriceMinor,page,pageSize:12});
  const change=()=>setPage(1);
  return <section dir="rtl" aria-label="المنتجات المعتمدة" className="space-y-5">
    <div className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm font-semibold">البحث<input type="search" aria-label="بحث المنتجات" maxLength={120} value={query} onChange={e=>{setQuery(e.target.value);change()}} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"/></label>
      <label className="text-sm font-semibold">الترتيب<select aria-label="ترتيب المنتجات" value={sort} onChange={e=>{setSort(e.target.value as ApprovedSort);change()}} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"><option value="default">الترتيب الأصلي</option><option value="price_asc">السعر: الأقل أولاً</option><option value="price_desc">السعر: الأعلى أولاً</option><option value="title">حسب الاسم</option></select></label>
      <label className="text-sm font-semibold">الحد الأدنى (وحدات صغرى)<input inputMode="numeric" aria-label="أقل سعر بالوحدات الصغرى" value={min} onChange={e=>{setMin(e.target.value);change()}} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"/></label>
      <label className="text-sm font-semibold">الحد الأعلى (وحدات صغرى)<input inputMode="numeric" aria-label="أعلى سعر بالوحدات الصغرى" value={max} onChange={e=>{setMax(e.target.value);change()}} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"/></label>
    </div>
    {invalidRange?<p role="alert" className="text-sm">نطاق السعر غير صالح.</p>:<>
      <p role="status" className="text-sm text-muted-foreground">{result!.total} منتج معتمد</p>
      {result!.total===0?<p className="rounded-xl border p-8 text-center">لا توجد منتجات معتمدة مطابقة.</p>:
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{result!.products.map(row=><article key={row.listing_id} className="overflow-hidden rounded-xl border bg-card"><div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-muted text-center text-xs text-muted-foreground"><ImageOff aria-hidden="true"/><span>الصورة غير متوفرة</span></div><div className="space-y-2 p-3"><h2 className="line-clamp-2 text-sm font-semibold">{row.title}</h2><p className="font-bold">{formatListingPrice(row,market)}</p>{onOpen&&<button type="button" onClick={()=>onOpen(row.slug)} className="min-h-11 text-sm font-semibold underline">عرض التفاصيل</button>}</div></article>)}</div>}
      {result!.pages>1&&<nav className="flex items-center justify-center gap-3" aria-label="صفحات المنتجات"><button type="button" className="min-h-11 rounded-lg border px-4 disabled:opacity-40" disabled={page===1} onClick={()=>setPage(x=>x-1)}>السابق</button><span>صفحة {page} من {result!.pages}</span><button type="button" className="min-h-11 rounded-lg border px-4 disabled:opacity-40" disabled={page>=result!.pages} onClick={()=>setPage(x=>x+1)}>التالي</button></nav>}
    </>}
    <p className="text-xs text-muted-foreground">تُعرض المنتجات المنشورة والمعتمدة فقط. لا تتوفر تصفية الفئات أو المخزون حتى يتيح المصدر العام بيانات موثقة.</p>
  </section>;
}
