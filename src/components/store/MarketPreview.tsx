import {useEffect,useState} from "react";
import {markets,type MarketCode} from "@/lib/store/markets";
import {fetchPublicCatalog,fetchPublicDetail,formatListingPrice,type PublicListing,type PublicDetail} from "@/lib/store/public-catalog";
const countries:Record<MarketCode,string>={sa:"السعودية",ae:"الإمارات",om:"عُمان",eg:"مصر",iq:"العراق"};
const origin=import.meta.env.VITE_YAWMIYATI_SUPABASE_URL;
const key=import.meta.env.VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY;
export function MarketPreview({market,slug}:{market:MarketCode;slug?:string}){
 const [rows,setRows]=useState<PublicListing[]|null>(null),[detail,setDetail]=useState<PublicDetail|null>(null),[query,Q]=useState(""),[error,E]=useState(false),[attempt,A]=useState(0);
 useEffect(()=>{
  if(!origin||!key)return;let active=true;E(false);setRows(null);setDetail(null);
  (slug?fetchPublicDetail(origin,key,market,slug).then(d=>{if(active){setDetail(d);setRows([]);}}):fetchPublicCatalog(origin,key,market).then(r=>{if(active)setRows(r)})).catch(()=>{if(active)E(true)});
  return()=>{active=false};
 },[market,slug,attempt]);
 return <main dir="rtl" className="mx-auto max-w-6xl space-y-5 px-4 py-8">
  <nav className="flex items-center justify-between gap-3"><a href="/" className="text-2xl font-bold text-primary">يومياتي</a><span className="rounded-full border px-3 py-1 text-sm">{countries[market]}</span></nav>
  <h1 className="font-display text-3xl font-bold">{slug?"تفاصيل المنتج":"منتجات يومياتي — "+countries[market]}</h1>
  <p className="rounded-xl border bg-muted p-4 text-sm">هذه نسخة اختبارية للعرض فقط. لا نستقبل طلبات أو مدفوعات حالياً.</p>
  {!origin||!key?<p role="status">لم يتم إعداد الاتصال بالمتجر بعد.</p>
   :error?<div role="alert"><p>تعذر تحميل بيانات المنتجات المعتمدة.</p><button className="mt-3 rounded border px-4 py-2" onClick={()=>A(n=>n+1)}>إعادة المحاولة</button></div>
   :rows===null?<p role="status">جاري تحميل المنتجات...</p>
   :slug?detail?<article className="space-y-4 rounded-xl border p-5"><h2 className="text-2xl font-bold">{detail.title}</h2><p className="font-bold text-primary">{formatListingPrice(detail,market)}</p><p className="whitespace-pre-line leading-7">{detail.description}</p><p className="text-sm">الشراء غير متاح حالياً.</p><a href={`/${market}`} className="underline">العودة إلى المتجر</a></article>:<p>المنتج غير متاح حالياً.</p>
   :<><label className="block text-sm">ابحث عن منتج<input className="mt-2 block w-full max-w-md rounded border bg-background p-3" value={query} onChange={e=>Q(e.target.value)} placeholder="اسم المنتج"/></label>
    {rows.filter(row=>row.title.toLowerCase().includes(query.trim().toLowerCase())).length===0?<p>لا توجد منتجات معتمدة ومتاحة حالياً.</p>
    :<div className="grid grid-cols-2 gap-4 md:grid-cols-4">{rows.filter(row=>row.title.toLowerCase().includes(query.trim().toLowerCase())).map(row=><article key={row.listing_id} className="space-y-3 rounded-xl border p-4"><a className="font-bold hover:text-primary" href={`/${market}/p/${encodeURIComponent(row.slug)}`}>{row.title}</a><p className="font-semibold">{formatListingPrice(row,market)}</p></article>)}</div>}
   </>}
  <footer className="border-t pt-5 text-xs text-muted-foreground">يومياتي · {markets[market].currency} · لا يوجد شراء أو شحن في هذه النسخة التجريبية.</footer>
 </main>;
}
