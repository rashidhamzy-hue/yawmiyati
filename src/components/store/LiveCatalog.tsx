import {useEffect,useState} from "react";
import {Link} from "@tanstack/react-router";
import {fetchPublicCatalog,formatListingPrice,storefrontMode,type PublicListing} from "@/lib/store/public-catalog";
const origin=import.meta.env.VITE_YAWMIYATI_SUPABASE_URL;
const key=import.meta.env.VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY;
export const catalogMode=()=>storefrontMode(origin,key,import.meta.env.VITE_YAWMIYATI_DEMO);
export function LiveCatalog({slug,query=""}:{slug?:string;query?:string}){
 const [rows,setRows]=useState<PublicListing[]|null>(null);
 const [error,setError]=useState(false);
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(catalogMode()!=="catalog")return;
  let active=true;setRows(null);setError(false);
  fetchPublicCatalog(origin,key,"sa").then(result=>{if(active)setRows(result)}).catch(()=>{if(active)setError(true)});
  return()=>{active=false};
 },[attempt]);
 const heading=slug?"تفاصيل المنتج":"يومياتي السعودية";
 return <section dir="rtl" className="mx-auto max-w-6xl space-y-6 px-4 py-8">
 <h1 className="font-display text-3xl font-bold">{heading}</h1>
 <p className="rounded-xl bg-muted p-4 text-sm">نسخة اختبارية — لا يمكن تقديم طلبات أو دفع مبالغ حالياً.</p>
 {catalogMode()!=="catalog"?<p role="status">المتجر قيد التجهيز.</p>:error?<div role="alert"><p>تعذر تحميل المنتجات.</p><button className="btn-outline mt-3" onClick={()=>setAttempt(n=>n+1)}>إعادة المحاولة</button></div>:rows===null?<p role="status">جاري تحميل المنتجات...</p>:slug?<Detail row={rows.find(r=>r.slug===slug)}/>:<Results rows={rows.filter(r=>r.title.toLowerCase().includes(query.trim().toLowerCase()))}/>}
 </section>
}
function Detail({row}:{row?:PublicListing}){
 if(!row)return <div><p>هذا المنتج غير متاح حالياً.</p><Link to="/sa" className="btn-outline mt-4">العودة للمتجر</Link></div>;
 return <article className="space-y-4 rounded-2xl border bg-card p-6"><h2 className="text-2xl font-bold">{row.title}</h2><p className="text-xl font-bold text-primary">{formatListingPrice(row,"sa")}</p><p className="text-sm text-muted-foreground">الشراء غير متاح في النسخة الاختبارية.</p><Link to="/sa" className="btn-outline">العودة للمتجر</Link></article>
}
function Results({rows}:{rows:PublicListing[]}){
 if(!rows.length)return <p>لا توجد منتجات مطابقة ومتاحة حالياً.</p>;
 return <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{rows.map(r=><article key={r.listing_id} className="rounded-2xl border bg-card p-4"><Link to="/sa/p/$slug" params={{slug:r.slug}} className="block font-bold hover:text-primary">{r.title}</Link><p className="mt-2 font-bold text-primary">{formatListingPrice(r,"sa")}</p></article>)}</div>
}
