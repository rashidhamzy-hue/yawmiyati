import {paymentLabel} from "../../../supabase/functions/_shared/payment-policy";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { parseMinorUnits, type MarketCode } from "./markets";
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
      <p className="text-sm">{paymentLabel}</p>
      <p className="text-xl font-bold">{product.price}</p>
      {product.description.trim()&&<p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{product.description}</p>}
      {product.variants.length>0&&<fieldset className="space-y-2"><legend className="text-sm font-bold">الخيارات المعتمدة</legend><div className="flex flex-wrap gap-2">{product.variants.map(v=><button key={v.id} type="button" aria-pressed={chosenVariant?.id===v.id} onClick={()=>setVariantId(v.id)} className={`min-h-11 rounded-xl border px-4 py-2 text-sm ${chosenVariant?.id===v.id?"border-primary bg-muted font-bold":""}`}>{v.label}</button>)}</div><p className="text-xs text-muted-foreground">اختيار للعرض فقط؛ لا توجد معلومات مخزون أو شراء مؤكدة.</p></fieldset>}
      {product.specifications.length>0&&<section aria-label="المواصفات المعتمدة"><h2 className="mb-3 text-base font-bold">المواصفات</h2><dl className="divide-y rounded-xl border px-4">{product.specifications.map((s,index)=><div key={index} className="grid grid-cols-2 gap-3 py-3 text-sm"><dt className="font-semibold">{s.label}</dt><dd className="break-words text-muted-foreground">{s.value}</dd></div>)}</dl></section>}
      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">هذه معاينة للمنتج وليست صفحة لإتمام الطلب. لا تُجمع منها بيانات دفع أو يُنشأ بها طلب شراء.</p>
    </div>
  </article>;
}

export function ApprovedCatalogBrowser({market,products,onOpen,images={}}:{market:MarketCode;products:readonly PublicListing[];onOpen?:(slug:string)=>void;images?:Record<string,{url:string;alt:string}|null|undefined>}) {
  const [query,setQuery]=useState("");
  const [sort,setSort]=useState<ApprovedSort>("default");
  const [min,setMin]=useState("");
  const [max,setMax]=useState("");
  const [page,setPage]=useState(1);
  const parseBound=(value:string)=>value.trim()?parseMinorUnits(market,value.trim()):undefined;
  let minPriceMinor:number|undefined,maxPriceMinor:number|undefined,invalidRange=false;
  try { minPriceMinor=parseBound(min);maxPriceMinor=parseBound(max); }
  catch { invalidRange=true; }
  if(minPriceMinor!==undefined&&maxPriceMinor!==undefined&&minPriceMinor>maxPriceMinor)invalidRange=true;
  const result=invalidRange?null:filterApprovedListings(products,market,{query,sort,minPriceMinor,maxPriceMinor,page,pageSize:12});
  const reset=()=>{setQuery("");setSort("default");setMin("");setMax("");setPage(1);};
  const hasFilters=Boolean(query||min||max||sort!=="default");
  return <section dir="rtl" aria-label="تصفحي جميع المنتجات" className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-extrabold text-primary">كتالوج يومياتي</p><h2 className="font-display text-2xl font-extrabold sm:text-3xl">اكتشفي كل المنتجات</h2><p className="mt-1 text-sm text-muted-foreground">رتّبي المنتجات وحددي ميزانيتك للوصول إلى ما يناسبك.</p></div>
      <span className="rounded-full bg-primary-soft px-3 py-2 text-xs font-bold text-primary">{products.length} منتج متاح للعرض</span>
    </div>
    <div className="grid gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm font-bold lg:col-span-2">ابحثي في المنتجات
        <span className="relative mt-2 block"><input type="search" aria-label="بحث المنتجات" maxLength={120} value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="مثلاً: عناية، مطبخ، تنظيم..." className="field min-h-12 w-full pr-4"/></span>
      </label>
      <label className="text-sm font-bold">ترتيب حسب
        <select aria-label="ترتيب المنتجات" value={sort} onChange={e=>{setSort(e.target.value as ApprovedSort);setPage(1);}} className="field mt-2 min-h-12 w-full">
          <option value="default">الأكثر صلة</option><option value="price_asc">السعر: الأقل أولاً</option><option value="price_desc">السعر: الأعلى أولاً</option><option value="title">الاسم</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm font-bold">من السعر<input inputMode="decimal" aria-label="أقل سعر" placeholder="0" value={min} onChange={e=>{setMin(e.target.value);setPage(1);}} className="field mt-2 min-h-12 w-full"/></label>
        <label className="text-sm font-bold">إلى السعر<input inputMode="decimal" aria-label="أعلى سعر" placeholder="بدون حد" value={max} onChange={e=>{setMax(e.target.value);setPage(1);}} className="field mt-2 min-h-12 w-full"/></label>
      </div>
      <div className="flex items-center justify-between gap-3 sm:col-span-2 lg:col-span-4">
        <p role="status" className="text-xs text-muted-foreground">{invalidRange?"تحققي من نطاق السعر وإدخاله بشكل صحيح.":`${result!.total} نتيجة`}</p>
        {hasFilters&&<button type="button" onClick={reset} className="min-h-10 px-3 text-xs font-bold text-primary underline underline-offset-4">مسح التصفية</button>}
      </div>
    </div>
    {invalidRange?<p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm">أدخلي سعراً صحيحاً، وتأكدي أن الحد الأدنى لا يتجاوز الحد الأعلى.</p>:result!.total===0?
      <div className="rounded-2xl border bg-card px-5 py-12 text-center"><PackageSearchFallback/><h3 className="mt-3 font-bold">ما لقينا منتجات تطابق اختياراتك</h3><p className="mt-2 text-sm text-muted-foreground">جرّبي تخفيف التصفية أو تغيير كلمة البحث.</p><button type="button" onClick={reset} className="btn-outline mt-4 min-h-11">عرض كل المنتجات</button></div>:
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {result!.products.map(row=>{const image=images[row.listing_id];return <article key={row.listing_id} className="group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft transition-shadow hover:shadow-md">
          <a href={`/${market}/p/${encodeURIComponent(row.slug)}`} onClick={onOpen?e=>{e.preventDefault();onOpen(row.slug);}:undefined} aria-label={`تفاصيل ${row.title}`} className="block aspect-square overflow-hidden bg-muted">
            {image?<img src={image.url} alt={image.alt||row.title} loading="lazy" decoding="async" width={360} height={360} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"/>:<div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground"><ImageOff aria-hidden="true" className="h-8 w-8"/><span>الصورة غير متاحة</span></div>}
          </a>
          <div className="space-y-2 p-3 sm:p-4"><h3 className="line-clamp-2 min-h-12 text-sm font-bold leading-6"><a href={`/${market}/p/${encodeURIComponent(row.slug)}`} onClick={onOpen?e=>{e.preventDefault();onOpen(row.slug);}:undefined} className="hover:text-primary">{row.title}</a></h3><p className="font-extrabold text-primary">{formatListingPrice(row,market)}</p><a href={`/${market}/p/${encodeURIComponent(row.slug)}`} className="inline-flex min-h-10 items-center text-xs font-bold text-primary underline underline-offset-4">اكتشفي التفاصيل</a></div>
        </article>;})}
      </div>}
    {!invalidRange&&result!.pages>1&&<nav className="flex items-center justify-center gap-3" aria-label="صفحات المنتجات"><button type="button" className="min-h-11 rounded-xl border px-4 disabled:opacity-40" disabled={page===1} onClick={()=>setPage(x=>x-1)}>السابق</button><span className="text-sm">صفحة {page} من {result!.pages}</span><button type="button" className="min-h-11 rounded-xl border px-4 disabled:opacity-40" disabled={page>=result!.pages} onClick={()=>setPage(x=>x+1)}>التالي</button></nav>}
    <p className="text-xs leading-6 text-muted-foreground">نُظهر المنتجات المنشورة والمعتمدة لهذا السوق فقط. خيارات التصنيف والمخزون تظهر عند توفر بياناتها المعتمدة.</p>
  </section>;
}
function PackageSearchFallback(){return <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary"><ImageOff className="h-7 w-7" aria-hidden="true"/></span>}
