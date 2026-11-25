import {useEffect,useMemo,useState} from "react";
import {previewCatalogActive,useOfferVersions} from "@/lib/store/offer-source";
import {offerListing} from "@/lib/store/offer-version";
import {ImageOff} from "lucide-react";
import {publicBrowserConfig} from "@/lib/store/staging-public-config";
import type {MarketCode} from "@/lib/store/markets";
import {fetchPublicCatalog,formatListingPrice,type PublicCategorySlug,type PublicListing} from "@/lib/store/public-catalog";
const {origin,key}=publicBrowserConfig(import.meta.env.VITE_YAWMIYATI_SUPABASE_URL,import.meta.env.VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY);
/**
 * Shows real category products only when the public RPC returns explicitly
 * owner-approved category assignments on released, stock-verified listings.
 * Until that backend contract exists, the editorial category page stays intact.
 */
export function ApprovedCategoryProductGrid({market,slug,categoryTitle}:{market:MarketCode;slug:PublicCategorySlug;categoryTitle:string}){
 const [catalog,setCatalog]=useState<PublicListing[]>([]);
 const [visibleCount,setVisibleCount]=useState(16);
 const offers=useOfferVersions(market);
 const [sort,setSort]=useState("featured");
 const [query,setQuery]=useState("");
 useEffect(()=>{setVisibleCount(16);setQuery("");setSort("featured");},[market,slug]);
 useEffect(()=>setVisibleCount(16),[query,sort]);
 useEffect(()=>{
  if(previewCatalogActive()||offers.state!=="off"||!origin||!key){setCatalog([]);return;}
  let active=true;setCatalog([]);
  fetchPublicCatalog(origin,key,market).then(rows=>{if(active)setCatalog(rows);}).catch(()=>{if(active)setCatalog([]);});
  return ()=>{active=false;};
 },[market,offers.state]);
 const approved=(offers.state==="ready"?offers.versions.map(offerListing):catalog).filter(row=>row.approved_category_slugs?.includes(slug));
 const shown=useMemo(()=>{const normalized=query.trim().toLocaleLowerCase();const result=approved.filter(x=>!normalized||x.title.toLocaleLowerCase().includes(normalized));if(sort==="low"||sort==="high")result.sort((a,b)=>{const x=BigInt(a.price_minor),y=BigInt(b.price_minor);return (x===y?0:x<y?-1:1)*(sort==="low"?1:-1);});return result;},[approved,query,sort]);
 if(offers.state==="loading")return <section aria-label="منتجات القسم" className="mt-5 grid grid-cols-2 gap-3" aria-busy="true">{Array.from({length:4},(_,i)=><div key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-muted"/>)}</section>;
 if(!approved.length)return <section aria-label="منتجات القسم" className="mt-5 rounded-xl border bg-card p-5 text-center"><h2 className="font-bold">لا توجد منتجات معروضة في هذا القسم</h2><p className="mt-2 text-sm text-muted-foreground">تصفّحي المنتجات الأخرى في يومياتي.</p><a href={"/"+market+"#collection"} className="btn-outline mt-4 inline-flex min-h-11 items-center">عرض جميع المنتجات</a></section>;
 return <section aria-label="منتجات القسم" className="mt-5 space-y-4">
  <div className="flex flex-wrap items-end justify-between gap-3">
   <div><p className="text-xs font-extrabold text-primary">اختيارات يومياتي</p>
    <h2 className="mt-2 font-display text-2xl font-extrabold">منتجات {categoryTitle}</h2></div>
   <span className="text-xs text-muted-foreground">{approved.length} منتج</span>
  </div>
  {offers.state==="ready"&&<p role="note" className="rounded-xl border border-dashed p-3 text-xs">منتجات للمعاينة فقط، لا يمكن إرسال طلب فعلي.</p>}
  <div className="flex flex-wrap gap-2"><input type="search" aria-label="البحث في هذا القسم" placeholder="ابحثي في هذا القسم" value={query} onChange={e=>setQuery(e.target.value)} className="field min-w-0 flex-1 text-sm"/><select aria-label="ترتيب المنتجات" value={sort} onChange={e=>setSort(e.target.value)} className="field max-w-full text-xs"><option value="featured">مختارات يومياتي</option><option value="low">السعر: الأقل أولاً</option><option value="high">السعر: الأعلى أولاً</option></select></div>
  {!shown.length&&<p role="status" className="rounded-xl border p-4 text-sm">لا توجد نتائج مطابقة. جرّبي كلمة أخرى.</p>}
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
   {shown.slice(0,visibleCount).map(item=><article key={item.listing_id} className="overflow-hidden rounded-2xl border bg-card">
    <a href={"/"+market+"/p/"+encodeURIComponent(item.slug)} aria-label={item.title} className="flex aspect-square items-center justify-center bg-muted">
      {offers.state==="ready"&&offers.versions.find(v=>v.listing_id===item.listing_id)?.image?<img src={offers.versions.find(v=>v.listing_id===item.listing_id)!.image!.url} alt={item.title} width={360} height={360} loading="lazy" decoding="async" className="h-full w-full object-contain"/>:<ImageOff className="h-9 w-9 text-muted-foreground/60" aria-hidden="true"/>}
    </a>
    <div className="space-y-2 p-4">
     <h3 className="line-clamp-2 text-sm font-bold leading-6"><a href={"/"+market+"/p/"+encodeURIComponent(item.slug)}>{item.title}</a></h3>
     <p className="text-sm font-extrabold text-primary">{formatListingPrice(item,market)}</p>
    </div>
   </article>)}
  </div>
  {shown.length>visibleCount&&<div className="text-center"><button className="btn-outline" onClick={()=>setVisibleCount(n=>n+16)}>عرض المزيد من المنتجات</button></div>}
 </section>;
}
