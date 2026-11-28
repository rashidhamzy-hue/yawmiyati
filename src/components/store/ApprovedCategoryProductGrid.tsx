import {useEffect,useMemo,useState} from "react";
import {previewCatalogActive,useOfferVersions} from "@/lib/store/offer-source";
import {offerListing} from "@/lib/store/offer-version";
import {SlidersHorizontal} from "lucide-react";
import {ProductTile,GridSkeleton,gridClass,listingImage} from "./ProductTile";
import {byRank} from "@/lib/store/store-catalog";
import {shopCopy} from "@/lib/store/shop-copy";
import {publicBrowserConfig} from "@/lib/store/staging-public-config";
import {parseMinorUnits,type MarketCode} from "@/lib/store/markets";
import {fetchPublicCatalog,type PublicCategorySlug,type PublicListing} from "@/lib/store/public-catalog";
import {normalizeSearch} from "@/lib/store/smart-search";
const {origin,key}=publicBrowserConfig(import.meta.env.VITE_YAWMIYATI_SUPABASE_URL,import.meta.env.VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY);
/**
 * Shows real category products only when the public RPC returns explicitly
 * owner-approved category assignments on released, stock-verified listings.
 * Until that backend contract exists, the editorial category page stays intact.
 */
export function ApprovedCategoryProductGrid({market,slug,categoryTitle}:{market:MarketCode;slug:PublicCategorySlug;categoryTitle:string}){
 const [catalog,setCatalog]=useState<PublicListing[]|null>(null);
 const copy=shopCopy(market);
 const [visibleCount,setVisibleCount]=useState(16);
 const [filtersOpen,setFiltersOpen]=useState(false);
 const offers=useOfferVersions(market);
 const [sort,setSort]=useState("featured");
 const [query,setQuery]=useState("");
 const [minPrice,setMinPrice]=useState("");
 const [maxPrice,setMaxPrice]=useState("");
 useEffect(()=>{setVisibleCount(16);setQuery("");setSort("featured");},[market,slug]);
 useEffect(()=>setVisibleCount(16),[query,sort,minPrice,maxPrice]);
 useEffect(()=>{
  if(previewCatalogActive()||offers.state!=="off"||!origin||!key){setCatalog([]);return;}
  let active=true;setCatalog(null);
  fetchPublicCatalog(origin,key,market).then(rows=>{if(active)setCatalog(byRank(rows));}).catch(()=>{if(active)setCatalog([]);});
  return ()=>{active=false;};
 },[market,offers.state]);
 const versions=offers.state==="ready"?offers.versions:[];
 const imageByListing=useMemo(()=>new Map(versions.map(v=>[v.listing_id,v.image])),[versions]);
 const approved=(offers.state==="ready"?versions.map(offerListing):catalog??[]).filter(row=>row.approved_category_slugs?.includes(slug));
 let minMinor:number|undefined,maxMinor:number|undefined,invalidPrice=false;
 try{minMinor=minPrice?parseMinorUnits(market,minPrice):undefined;maxMinor=maxPrice?parseMinorUnits(market,maxPrice):undefined;}catch{invalidPrice=true;}
 if(minMinor!==undefined&&maxMinor!==undefined&&minMinor>maxMinor)invalidPrice=true;
 const shown=useMemo(()=>{const normalized=normalizeSearch(query);const result=approved.filter(x=>{const price=Number(x.price_minor);return (!normalized||normalizeSearch(x.title).includes(normalized))&&(minMinor===undefined||price>=minMinor)&&(maxMinor===undefined||price<=maxMinor);});if(sort==="popular")result.sort((a,b)=>(a.popularity_rank??Number.MAX_SAFE_INTEGER)-(b.popularity_rank??Number.MAX_SAFE_INTEGER));if(sort==="low"||sort==="high")result.sort((a,b)=>{const x=BigInt(a.price_minor),y=BigInt(b.price_minor);return (x===y?0:x<y?-1:1)*(sort==="low"?1:-1);});return result;},[approved,query,sort,minPrice,maxPrice,market]);
 if(offers.state==="loading"||(offers.state==="off"&&catalog===null))return <section aria-label="منتجات القسم" className="mt-6" aria-busy="true"><GridSkeleton count={8}/></section>;
 if(!approved.length)return <section aria-label="منتجات القسم" className="ym-card mt-6 px-5 py-10 text-center"><h2 className="ym-h3">{copy.sectionEmptyTitle}</h2><p className="ym-body mt-2">{copy.sectionEmptyBody}</p><a href={"/"+market+"/search"} className="btn-outline mt-5">{copy.allProducts}</a></section>;
 return <section aria-label="منتجات القسم" className="mt-6 space-y-4">
  <div className="flex items-end justify-between gap-3">
   <h2 className="ym-h2">منتجات {categoryTitle}</h2>
   <span className="text-xs text-muted-foreground">{copy.productsCount(approved.length)}</span>
  </div>
  {offers.state==="ready"&&<p role="note" className="rounded-xl border border-dashed p-3 text-xs">منتجات للمعاينة فقط، لا يمكن إرسال طلب فعلي.</p>}
  <div>
   <div className="flex items-center gap-2"><select aria-label={copy.sortLabel} value={sort} onChange={e=>setSort(e.target.value)} className="field min-h-11 min-w-0 flex-1 text-sm sm:max-w-xs">{approved.some(row=>row.popularity_rank!==undefined)&&<option value="popular">الأكثر رواجاً</option>}<option value="featured">{copy.sortFeatured}</option><option value="low">{copy.sortLow}</option><option value="high">{copy.sortHigh}</option></select><button type="button" aria-expanded={filtersOpen} aria-controls="category-filters" onClick={()=>setFiltersOpen(v=>!v)} className="btn-quiet shrink-0"><SlidersHorizontal className="h-4 w-4" aria-hidden="true"/>{copy.filter}{(query||minPrice||maxPrice)?" •":""}</button></div>
   <div id="category-filters" className={(filtersOpen?"grid":"hidden")+" mt-2 gap-2 sm:grid-cols-3"}><input type="search" aria-label="البحث في هذا القسم" placeholder={copy.searchInSection} value={query} onChange={e=>setQuery(e.target.value)} className="field min-h-11 min-w-0 text-sm sm:col-span-2"/><div className="grid grid-cols-2 gap-2"><input inputMode="decimal" aria-label="أقل سعر" placeholder={copy.priceFrom} value={minPrice} onChange={e=>setMinPrice(e.target.value)} className="field min-w-0 text-sm"/><input inputMode="decimal" aria-label="أعلى سعر" placeholder={copy.priceTo} value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} className="field min-w-0 text-sm"/></div></div>
  </div>
  {invalidPrice&&<p role="alert" className="text-sm text-destructive">{copy.priceRangeError}</p>}{!invalidPrice&&!shown.length&&<p role="status" className="ym-card p-4 text-sm">{copy.noResults}</p>}
  <div className={gridClass}>
   {shown.slice(0,visibleCount).map((item,i)=><ProductTile key={item.listing_id} item={item} market={market} image={imageByListing.get(item.listing_id)??listingImage(item)} eager={i<2}/>)}
  </div>
  {shown.length>visibleCount&&<div className="pt-2 text-center"><button className="btn-outline" onClick={()=>setVisibleCount(n=>n+16)}>{copy.loadMore}</button></div>}
 </section>;
}
