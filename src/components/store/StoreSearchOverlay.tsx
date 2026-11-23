import {useEffect,useRef,useState,type FormEvent} from "react";
import {ArrowLeft,Search,Sparkles,X,Package,LoaderCircle} from "lucide-react";
import type {MarketCode} from "@/lib/store/markets";
import {marketIdentity} from "@/lib/store/market-identity";
import {marketExperience} from "@/lib/store/market-experience";
import {publicBrowserConfig} from "@/lib/store/staging-public-config";
import {fetchPublicCatalog,fetchPublicSearch,formatListingPrice,type PublicListing} from "@/lib/store/public-catalog";
import {offerFixturesRequested,useOfferVersions} from "@/lib/store/offer-source";
import {offerListing} from "@/lib/store/offer-version";
import {smartCatalogSearch,suggestEditorialCategories,SEARCH_GROUPS} from "@/lib/store/smart-search";
import {img} from "@/lib/store/images";
import {customerServiceCopy} from "@/lib/store/customer-service-copy";
const {origin,key}=publicBrowserConfig(import.meta.env.VITE_YAWMIYATI_SUPABASE_URL,import.meta.env.VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY);
const categories=[
 {slug:"home",name:"البيت والديكور",photo:img["cat-home"]},
 {slug:"kitchen",name:"القهوة والمطبخ",photo:img["cat-kitchen"]},
 {slug:"beauty",name:"الجمال والعناية",photo:img["cat-beauty"]},
 {slug:"fashion",name:"الأزياء والإكسسوارات",photo:img["cat-fashion"]},
 {slug:"wellness",name:"الراحة والرفاهية",photo:img["cat-wellness"]},
 {slug:"organize",name:"التنظيم",photo:img["cat-organize"]}
] as const;
export function StoreSearchOverlay({market,open,onClose}:{market:MarketCode;open:boolean;onClose:()=>void}){
 const [q,setQ]=useState(""),[items,setItems]=useState<PublicListing[]|null>(null),[error,setError]=useState(false);
 const experience=marketExperience[market];
 const input=useRef<HTMLInputElement>(null),dialog=useRef<HTMLElement>(null);
 const [loadedMarket,setLoadedMarket]=useState<MarketCode|null>(null);
 const [serverResults,setServerResults]=useState<{market:MarketCode;query:string;rows:PublicListing[]}|null>(null);
 const [serverBusy,setServerBusy]=useState(false);
 const offers=useOfferVersions(market);
 const visibleItems=offerFixturesRequested
  ? (offers.state==="ready"?offers.versions.filter(v=>v.market===market).map(offerListing):null)
  : loadedMarket===market?items:null;
 useEffect(()=>{
  if(!open)return;
  const previouslyFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
  input.current?.focus();
  function esc(e:KeyboardEvent){if(e.key==="Escape")onClose();}
  window.addEventListener("keydown",esc);
  const old=document.body.style.overflow;document.body.style.overflow="hidden";
  return()=>{window.removeEventListener("keydown",esc);document.body.style.overflow=old;previouslyFocused?.focus();};
 },[open,onClose]);
 useEffect(()=>{
  if(offerFixturesRequested||!open||!origin||!key)return;
  let active=true;setError(false);setLoadedMarket(null);setItems(null);
  fetchPublicCatalog(origin,key,market).then(rows=>{if(active){setItems(rows);setLoadedMarket(market);}}).catch(()=>{if(active){setItems([]);setError(true);}});
  return()=>{active=false;};
 },[open,market]);
 useEffect(()=>{
  if(offerFixturesRequested||!open||!origin||!key||q.trim().length<2){setServerBusy(false);return;}
  let alive=true;setServerBusy(true);
  const timer=setTimeout(()=>{void fetchPublicSearch(origin,key,market,q).then(rows=>{if(alive)setServerResults({market,query:q,rows});}).catch(()=>{if(alive)setServerResults(null);}).finally(()=>{if(alive)setServerBusy(false);});},250);
  return()=>{alive=false;clearTimeout(timer);};
 },[open,market,q]);
 if(!open)return null;
 const localResults=visibleItems?smartCatalogSearch(q,visibleItems,10):[];
 const remoteResults=serverResults?.market===market&&serverResults.query===q?serverResults.rows:[];
 const seenIds=new Set(localResults.map(p=>p.listing_id));
 const results=[...localResults,...remoteResults.filter(p=>!seenIds.has(p.listing_id))].slice(0,12);
 const recommended=suggestEditorialCategories(q);
 const ordered=experience.categoryOrder.map(slug=>categories.find(c=>c.slug===slug)).filter((c):c is (typeof categories)[number]=>Boolean(c));
 const shown=q.trim()?ordered.filter(x=>recommended.some(s=>s.slug===x.slug)):ordered;
 function submit(event:FormEvent){event.preventDefault();input.current?.blur();}
 return <div className="fixed inset-0 z-[90] flex justify-center bg-foreground/70 p-0 backdrop-blur-sm sm:items-start sm:px-4 sm:pt-[7vh]" dir="rtl" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section ref={dialog} onKeyDown={e=>{if(e.key!=="Tab")return;const elements=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled])')??[]).filter(x=>x.getClientRects().length>0);if(!elements.length)return;const first=elements[0],last=elements[elements.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}} role="dialog" aria-modal="true" aria-label="بحث يومياتي الذكي" className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-background text-foreground shadow-2xl sm:h-auto sm:max-h-[87vh] sm:rounded-[2rem]">
   <header className="flex items-center justify-between gap-3 border-b px-5 py-4 sm:px-8">
    <div><span className="text-xs font-bold text-primary">يومياتي {marketIdentity[market].name}</span><h2 className="mt-1 font-display text-xl font-extrabold sm:text-2xl">{experience.searchCta}</h2></div>
    <button type="button" onClick={onClose} className="tap grid place-items-center rounded-full border bg-card" aria-label="إغلاق البحث"><X className="h-5 w-5"/></button>
   </header>
   <div className="overflow-y-auto px-5 pb-8 pt-5 sm:px-8">
    <form role="search" onSubmit={submit} className="relative"><Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary"/><input ref={input} type="search" aria-label="ابحثي في منتجات يومياتي" autoComplete="off" maxLength={120} value={q} onChange={e=>setQ(e.target.value)} placeholder={market==="eg"?"جرّبي: مطبخ، شنطة، عناية…":market==="iq"?"جرّبي: بيت، قهوة، عناية…":market==="ae"?"جرّبي: ديكور، عناية، إكسسوارات…":market==="om"?"جرّبي: قهوة، ترتيب، عناية…":"جرّبي: قهوة، دلة، شنطة، عناية…"} className="w-full rounded-2xl border-2 border-primary/25 bg-card py-4 pe-16 ps-12 text-base shadow-sm outline-none focus-visible:border-primary"/>{q&&<button type="button" onClick={()=>{setQ("");input.current?.focus();}} className="absolute left-1 top-1/2 flex min-h-11 min-w-12 -translate-y-1/2 items-center justify-center rounded-lg text-xs font-bold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" aria-label="مسح البحث">مسح</button>}</form>
    <p className="mt-3 flex items-center gap-2 text-xs leading-6 text-muted-foreground"><Sparkles className="h-4 w-4 shrink-0 text-primary"/>يفهم اختلاف كتابة الكلمات العربية ويقترح أقساماً تناسب بحثك.</p>
    <p className="mt-2 text-xs leading-6 text-muted-foreground">{customerServiceCopy[market].payment}</p>
    {q.trim()&&<section className="mt-7" aria-label="نتائج بحث المنتجات">
      <div className="flex items-center justify-between"><h3 className="font-display text-lg font-extrabold">نتائج المنتجات</h3>{visibleItems&&<span className="text-xs text-muted-foreground">{results.length} نتيجة معروضة</span>}</div>
      {!offerFixturesRequested&&(!origin||!key)?<p role="status" className="mt-3 rounded-xl bg-muted p-4 text-sm">تعذّر الاتصال بكتالوج المنتجات. تصفّحي الأقسام أدناه.</p>:error?<p role="alert" className="mt-3 rounded-xl bg-muted p-4 text-sm">تعذّر تحميل المنتجات حالياً. لا نعرض نتائج غير مؤكدة.</p>:visibleItems===null?<p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin"/> جاري البحث في المنتجات المعتمدة…</p>:results.length?<div className="mt-4 grid gap-2 sm:grid-cols-2">{results.map(x=><a key={x.listing_id} href={"/"+market+"/p/"+encodeURIComponent(x.slug)} className="flex items-center gap-3 rounded-2xl border bg-card p-4 hover:border-primary"><span className="grid h-12 w-12 place-items-center rounded-xl bg-primary-soft text-primary"><Package className="h-6 w-6"/></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{x.title}</strong><span className="text-xs font-bold text-primary">{formatListingPrice(x,market)}</span></span><ArrowLeft className="h-4 w-4 text-primary"/></a>)}</div>:serverBusy?<p role="status" className="mt-4 text-sm text-muted-foreground">جاري البحث في تفاصيل المنتجات المعتمدة…</p>:<div className="mt-4 rounded-2xl border bg-card p-5 text-sm text-muted-foreground">ما لقينا منتجات معتمدة تطابق بحثك حالياً. تصفّحي الأقسام الملهمة أدناه.</div>}
    </section>}
    <section className="mt-8" aria-label="الأقسام المقترحة"><div className="flex items-center justify-between"><h3 className="font-display text-lg font-extrabold">{q.trim()?"أقسام ممكن تعجبك":"اكتشفي حسب اهتماماتك"}</h3><a className="text-xs font-bold text-primary hover:underline" href={"/"+market+"#discover"} onClick={onClose}>كل الأقسام</a></div>
     {shown.length?<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{shown.map(x=><a key={x.slug} href={"/"+market+"/c/"+x.slug} className="group overflow-hidden rounded-2xl border bg-card hover:border-primary"><img src={x.photo} alt="" loading="lazy" className="aspect-[5/3] w-full object-cover transition-transform group-hover:scale-105"/><p className="px-3 py-3 text-xs font-bold sm:text-sm">{x.name}<span className="mt-1 block text-[11px] font-normal text-muted-foreground">{experience.categoryCaptions[x.slug]}</span></p></a>)}</div>:<p className="mt-4 text-sm text-muted-foreground">ما فيه أقسام مطابقة. جرّبي اسماً أبسط أو اختاري من الأقسام الرئيسية.</p>}
    </section>
   </div>
  </section>
 </div>;
}
