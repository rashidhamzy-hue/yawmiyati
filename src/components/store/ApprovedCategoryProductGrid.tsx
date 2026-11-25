import {useEffect,useState} from "react";
import {previewCatalogHostAllowed,useOfferVersions} from "@/lib/store/offer-source";
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
 useEffect(()=>setVisibleCount(16),[market,slug]);
 useEffect(()=>{
  if(previewCatalogHostAllowed(window.location.hostname)||offers.state!=="off"||!origin||!key){setCatalog([]);return;}
  let active=true;setCatalog([]);
  fetchPublicCatalog(origin,key,market).then(rows=>{if(active)setCatalog(rows);}).catch(()=>{if(active)setCatalog([]);});
  return ()=>{active=false;};
 },[market,offers.state]);
 const approved=(offers.state==="ready"?offers.versions.map(offerListing):catalog).filter(row=>row.approved_category_slugs?.includes(slug));
 if(!approved.length)return null;
 return <section aria-label="منتجات القسم" className="mt-12 space-y-6">
  <div className="flex flex-wrap items-end justify-between gap-3">
   <div><p className="text-xs font-extrabold text-primary">اختيارات يومياتي</p>
    <h2 className="mt-2 font-display text-2xl font-extrabold">منتجات {categoryTitle}</h2></div>
   <span className="text-xs text-muted-foreground">{approved.length} منتج</span>
  </div>
  {offers.state==="ready"&&<p role="note" className="rounded-xl border border-dashed p-3 text-xs">منتجات للمعاينة فقط، لا يمكن إرسال طلب فعلي.</p>}
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
   {approved.slice(0,visibleCount).map(item=><article key={item.listing_id} className="overflow-hidden rounded-2xl border bg-card">
    <a href={"/"+market+"/p/"+encodeURIComponent(item.slug)} aria-label={item.title} className="flex aspect-square items-center justify-center bg-muted">
      {offers.state==="ready"&&offers.versions.find(v=>v.listing_id===item.listing_id)?.image?<img src={offers.versions.find(v=>v.listing_id===item.listing_id)!.image!.url} alt={item.title} width={360} height={360} loading="lazy" decoding="async" className="h-full w-full object-contain"/>:<ImageOff className="h-9 w-9 text-muted-foreground/60" aria-hidden="true"/>}
    </a>
    <div className="space-y-2 p-4">
     <h3 className="line-clamp-2 text-sm font-bold leading-6"><a href={"/"+market+"/p/"+encodeURIComponent(item.slug)}>{item.title}</a></h3>
     <p className="text-sm font-extrabold text-primary">{formatListingPrice(item,market)}</p>
    </div>
   </article>)}
  </div>
  {approved.length>visibleCount&&<div className="text-center"><button className="btn-outline" onClick={()=>setVisibleCount(n=>n+16)}>عرض المزيد من المنتجات</button></div>}
 </section>;
}
