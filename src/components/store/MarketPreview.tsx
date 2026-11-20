import {publicBrowserConfig} from "@/lib/store/staging-public-config";
import {useEffect,useState} from "react";
import {ArrowLeft,ArrowUpLeft,ChevronDown,Check,Heart,Instagram,Menu,Package,Search,ShieldCheck,Sparkles,X, type LucideIcon} from "lucide-react";
import {img} from "@/lib/store/images";
import {ShoppingAssistant} from "@/components/store/ShoppingAssistant";
import {StoreHeader,StoreFooter} from "@/components/store/StoreChrome";
import {MarketPromiseStrip} from "@/components/store/MarketPromiseStrip";
import {marketIdentity} from "@/lib/store/market-identity";
import {marketExperience} from "@/lib/store/market-experience";
import {saudiDelivery,saudiHomeQuestions} from "@/lib/store/saudi-commerce-content";
import {relatedVerifiedProducts} from "@/lib/store/verified-merchandising";
import {smartCatalogSearch,suggestEditorialCategories,SEARCH_GROUPS} from "@/lib/store/smart-search";
import {markets,type MarketCode} from "@/lib/store/markets";
import {fetchPublicCatalog,fetchPublicDetail,fetchPublicSearch,formatListingPrice,type PublicListing,type PublicDetail} from "@/lib/store/public-catalog";

const names:Record<MarketCode,string>={sa:"السعودية",ae:"الإمارات",om:"عُمان",eg:"مصر",iq:"العراق"};
const {origin,key}=publicBrowserConfig(import.meta.env.VITE_YAWMIYATI_SUPABASE_URL,import.meta.env.VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY);
const categories=[
 {slug:"home",name:"المنزل والديكور",caption:"لأجواء تشبهك",picture:img["cat-home"]},
 {slug:"kitchen",name:"المطبخ والقهوة",caption:"لحظات تستحق التذوّق",picture:img["cat-kitchen"]},
 {slug:"beauty",name:"الجمال والعناية",caption:"تفاصيل يومية ناعمة",picture:img["cat-beauty"]},
 {slug:"fashion",name:"الأزياء والإكسسوارات",caption:"إطلالة تعبر عنك",picture:img["cat-fashion"]},
 {slug:"wellness",name:"الراحة والرفاهية",caption:"مساحة لنفسك",picture:img["cat-wellness"]},
 {slug:"organize",name:"التنظيم الذكي",caption:"أقل فوضى، راحة أكثر",picture:img["cat-organize"]},
] as const;
const values:{icon:LucideIcon;title:string;description:string}[]=[
 {icon:Heart,title:"اختيارات على ذوقك",description:"أفكار وتفاصيل تناسب أسلوبك وحياتك اليومية."},
 {icon:ShieldCheck,title:"التفاصيل تفرق",description:"كل منتج معروض له معلومات واضحة تساعدك تختارين."},
 {icon:Sparkles,title:"كل شيء بمكان واحد",description:"تصفّح عربي بسيط، وأقسام تلهم كل يوم."},
];
const questions=[
 {question:"كيف ألقى الشيء اللي أدور عليه؟",answer:"تصفّحي الأقسام أو استخدمي البحث للوصول إلى المنتجات ومعلوماتها المتاحة."},
 {question:"وين ألقى سعر المنتج وتفاصيله؟",answer:"بتلقين السعر والتفاصيل في صفحة كل منتج متاح للعرض."},
 {question:"هل المنتجات نفسها في كل بلد؟",answer:"كل متجر يعرض اختياراته وعملته المحلية، وقد تختلف المنتجات والتفاصيل بين البلدان."},
 {question:"كيف أعرف تفاصيل الشحن والاسترجاع؟",answer:"تقدرين تراجعين صفحة الدفع والتوصيل والاسترجاع. تظهر الشروط المعتمدة عند توفر خدمة الطلب."},
] as const;

function SectionIntro({eyebrow,title,description}:{eyebrow:string;title:string;description?:string}){
 return <div className="space-y-2"><p className="text-xs font-extrabold tracking-wider text-primary">{eyebrow}</p><h2 className="font-display text-3xl font-extrabold leading-tight md:text-4xl">{title}</h2>{description&&<p className="max-w-2xl text-sm leading-8 text-muted-foreground md:text-base">{description}</p>}</div>;
}
function ShopCard({item,market}:{item:PublicListing;market:MarketCode}){
 return <article className="group flex h-full flex-col overflow-hidden rounded-[1.4rem] border border-border/70 bg-card shadow-soft transition-transform duration-300 hover:-translate-y-1">
  <a href={`/${market}/p/${encodeURIComponent(item.slug)}`} className="grid aspect-[4/4.7] place-items-center bg-muted" aria-label={item.title}><Package className="h-12 w-12 text-primary/35" aria-hidden="true"/></a>
  <div className="flex flex-1 flex-col gap-3 p-4"><a href={`/${market}/p/${encodeURIComponent(item.slug)}`} className="font-bold leading-7 hover:text-primary">{item.title}</a><p className="mt-auto text-lg font-extrabold text-primary">{formatListingPrice(item,market)}</p><span className="text-xs text-muted-foreground">تفاصيل المنتج</span></div>
 </article>;
}
export function MarketPreview({market,slug,searchOnly=false,initialSearch=""}:{market:MarketCode;slug?:string;searchOnly?:boolean;initialSearch?:string}){
 const [rows,setRows]=useState<PublicListing[]|null>(null),[detail,setDetail]=useState<PublicDetail|null>(null);
 const [term,setTerm]=useState(initialSearch),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 const [remoteSearch,setRemoteSearch]=useState<{query:string;rows:PublicListing[]}|null>(null);
 
 const path="/"+market;
 const experience=marketExperience[market];
 const orderedCategories=experience.categoryOrder.map(slug=>categories.find(c=>c.slug===slug)).filter((c):c is (typeof categories)[number]=>Boolean(c));
 const shopName="يومياتي "+marketIdentity[market].name;
 useEffect(()=>{
  if(!origin||!key)return;
  let active=true;setError(false);setRows(null);setDetail(null);
  const task=slug?Promise.all([fetchPublicDetail(origin,key,market,slug),fetchPublicCatalog(origin,key,market).catch(()=>[])]).then(([d,items])=>{if(active){setDetail(d);setRows(items);}})
   :fetchPublicCatalog(origin,key,market).then(data=>{if(active)setRows(data);});
  task.catch(()=>{if(active)setError(true);});
  return()=>{active=false};
 },[market,slug,attempt]);
 useEffect(()=>{
  if(!origin||!key||!rows||slug||term.trim().length<2)return;
  let alive=true;
  const timer=setTimeout(()=>{void fetchPublicSearch(origin,key,market,term).then(result=>{if(alive)setRemoteSearch({query:term,rows:result});}).catch(()=>{if(alive)setRemoteSearch(null);});},280);
  return()=>{alive=false;clearTimeout(timer);};
 },[market,rows,slug,term]);
 const localMatches=rows?smartCatalogSearch(term,rows):[];
 const remoteMatches=remoteSearch?.query===term?remoteSearch.rows:[];
 const matchedIds=new Set(localMatches.map(x=>x.listing_id));
 const matching=[...localMatches,...remoteMatches.filter(x=>!matchedIds.has(x.listing_id))];
 const suggestions=suggestEditorialCategories(term);
 return <div dir="rtl" data-yawmiyati-market={market} className="min-h-screen overflow-x-clip bg-background text-foreground">
  <a href="#main-content" className="skip-link">تخطي إلى المحتوى</a>
  <div className="bg-primary px-4 py-2.5 text-center text-[11px] font-bold tracking-wide text-primary-foreground sm:text-xs">{experience.announcement}</div>
  <StoreHeader market={market}/>

  <main id="main-content">
   {!slug&&!searchOnly&&<>
    <section aria-label="مقدمة يومياتي" className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
     <div className="relative isolate min-h-[510px] overflow-hidden rounded-[2rem] bg-foreground sm:min-h-[560px] lg:min-h-[610px]">
      <img src={img[experience.heroImage]} alt={experience.heroAlt} fetchPriority="high" width={1600} height={900} className="absolute inset-0 h-full w-full object-cover object-center"/>
      <div className="absolute inset-0 bg-gradient-to-l from-black/75 via-black/40 to-black/10"/>
      <div className="relative flex min-h-[510px] flex-col justify-center px-7 py-14 text-white sm:min-h-[560px] sm:px-12 lg:min-h-[610px] lg:px-20">
       <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/40 bg-white/15 px-4 py-2 text-xs font-bold backdrop-blur-sm"><Sparkles className="h-4 w-4"/> {experience.eyebrow}</span>
       <h1 className="max-w-[650px] font-display text-[clamp(2.7rem,5.8vw,5.1rem)] font-extrabold leading-[1.18] tracking-tight">{experience.heroStart}<br/><span className="text-[#f5dab1]">{experience.heroAccent}</span></h1>
       <p className="mt-6 max-w-[465px] text-base leading-8 text-white/90 sm:text-lg">{experience.heroDescription}</p>
       <div className="mt-9 flex flex-wrap gap-3"><a href={path+"#discover"} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 font-extrabold text-foreground transition-colors hover:bg-[#f5dab1]">{experience.discoverCta} <ArrowLeft className="h-4 w-4"/></a><button type="button" onClick={()=>document.dispatchEvent(new CustomEvent("yawmiyati:open-search"))} className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/60 px-6 font-bold text-white hover:bg-white/10">{experience.searchCta}</button></div>
       <p className="mt-7 text-xs font-medium text-white/85">{experience.announcement}</p>{market==="sa"&&<p className="mt-3 inline-flex max-w-full items-center gap-2 rounded-xl border border-white/30 bg-black/30 px-4 py-3 text-xs font-bold text-white/95"><Check className="h-4 w-4 shrink-0" aria-hidden="true"/> الدفع عند الاستلام فقط عند تفعيل الطلبات — بدون دفع إلكتروني</p>}
      </div>
     </div>
    </section>
    <section className="mx-auto grid max-w-7xl gap-2 px-4 pt-5 sm:grid-cols-3 sm:gap-4 sm:px-6 lg:px-8" aria-label="قيم يومياتي">{values.map(({icon:Icon,title,description})=><div key={title} className="flex items-center gap-3 rounded-2xl border bg-card/80 p-4 sm:p-5"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><Icon className="h-5 w-5"/></span><div><h2 className="text-sm font-extrabold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div></div>)}</section>
    {market==="sa"&&<section aria-label="الدفع والتوصيل في السعودية" className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8"><div className="grid gap-4 rounded-[1.75rem] border border-primary/15 bg-primary-soft p-5 sm:grid-cols-3 sm:p-7"><div><p className="text-xs font-extrabold text-primary">طريقة الدفع</p><h2 className="mt-2 text-lg font-extrabold">عند الاستلام وبس</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">{saudiDelivery.payment}</p></div><div><p className="text-xs font-extrabold text-primary">الشحن المرجعي</p><h2 className="mt-2 text-lg font-extrabold">٢٨ ر.س لجميع المناطق</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">حسب معلومات التشغيل المقدّمة، تُؤكّد التكلفة النهائية قبل أي طلب بعد إطلاق الشراء.</p></div><div><p className="text-xs font-extrabold text-primary">التوصيل والاسترجاع</p><h2 className="mt-2 text-lg font-extrabold">تفاصيل واضحة قبل الطلب</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">تقديرات حسب المدينة وشروط استرجاع مبدئية، مع حفظ الحقوق النظامية.</p><a href={path+"/info/shipping-returns"} className="mt-3 inline-flex min-h-11 items-center gap-2 font-extrabold text-primary underline underline-offset-4">شوفي سياسة الشحن والاسترجاع <ArrowLeft className="h-4 w-4" aria-hidden="true"/></a></div></div></section>}
    {market!=="sa"&&<MarketPromiseStrip market={market}/>}
    <section id="discover" className="mx-auto max-w-7xl scroll-mt-32 px-4 pb-3 pt-20 sm:px-6 lg:px-8">
     <div className="flex flex-wrap items-end justify-between gap-5"><SectionIntro eyebrow="عالم يومياتي" title={experience.discoverTitle} description={experience.discoverDescription}/><span className="rounded-full border px-4 py-2 text-xs text-muted-foreground">ستة أقسام تستحق الاكتشاف</span></div>
     <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-6">{orderedCategories.map(c=><a key={c.slug} href={path+"/c/"+c.slug} className="group block focus-visible:rounded-xl"><div className="aspect-[4/5] overflow-hidden rounded-[1.3rem] bg-muted"><img src={c.picture} alt={c.name} width={400} height={500} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/></div><h3 className="mt-3 text-sm font-extrabold sm:text-base group-hover:text-primary">{c.name}</h3><p className="mt-1 text-xs text-muted-foreground">{experience.categoryCaptions[c.slug]??c.caption}</p></a>)}</div>
    </section>
    <section id="story" className="mx-auto max-w-7xl scroll-mt-32 px-4 pt-20 sm:px-6 lg:px-8">
     <div className="grid overflow-hidden rounded-[2rem] bg-accent md:grid-cols-2"><div className="relative min-h-[370px] md:min-h-[520px]"><img src={img[market==="sa"?"cat-kitchen":market==="ae"?"cat-fashion":market==="om"?"cat-home":market==="eg"?"cat-kitchen":"cat-wellness"]} alt="صورة تحريرية من تفاصيل يومياتي" loading="lazy" className="absolute inset-0 h-full w-full object-cover"/></div><div className="flex flex-col justify-center p-7 sm:p-12 lg:p-16"><SectionIntro eyebrow={experience.storyEyebrow} title={experience.storyTitle} description={experience.storyDescription}/><p className="mt-5 text-sm leading-8 text-accent-foreground">يومياتي مساحة لاكتشاف أفكار البيت والجمال والعناية، بأسلوب بسيط وقريب من تفاصيل حياتنا.</p><a href="#discover" onClick={e=>{const target=document.getElementById("discover");if(target){e.preventDefault();target.scrollIntoView({behavior:(typeof window.matchMedia==="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)?"auto":"smooth",block:"start"});}}} className="btn-outline mt-7 w-fit">اختاري اللي يعجبك <ArrowUpLeft className="h-4 w-4"/></a></div></div>
    </section>
    <section className="mx-auto grid max-w-7xl gap-5 px-4 pt-6 sm:grid-cols-2 sm:px-6 lg:px-8">
     <div className="group relative min-h-[340px] overflow-hidden rounded-[1.75rem]"><img src={img["cat-beauty"]} alt="مجموعة مستوحاة من الجمال والعناية" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"/><div className="absolute bottom-0 p-7 text-white"><p className="text-xs font-bold text-white/80">العناية تبدأ من التفاصيل</p><h3 className="mt-2 font-display text-2xl font-extrabold">{experience.beautyTitle}</h3><a href={path+"/c/beauty"} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-extrabold text-foreground transition-colors hover:bg-[#f5dab1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">اكتشفي عالم العناية <ArrowLeft className="h-4 w-4" aria-hidden="true"/></a></div></div>
     <div className="group relative min-h-[340px] overflow-hidden rounded-[1.75rem]"><img src={img["cat-home"]} alt="تفاصيل منزلية دافئة" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"/><div className="absolute bottom-0 p-7 text-white"><p className="text-xs font-bold text-white/80">بيت يعكس ذوقك</p><h3 className="mt-2 font-display text-2xl font-extrabold">{experience.homeTitle}</h3><a href={path+"/c/home"} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-extrabold text-foreground transition-colors hover:bg-[#f5dab1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">اكتشفي لمسات البيت <ArrowLeft className="h-4 w-4" aria-hidden="true"/></a></div></div>
    </section>
   </>}
   {searchOnly&&<section aria-label="اكتشفي المنتجات" className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
    <div className="relative isolate flex min-h-[200px] items-center overflow-hidden rounded-[1.75rem] bg-foreground sm:min-h-[260px]">
     <img src={img["cat-home"]} alt="" className="absolute inset-0 h-full w-full object-cover object-center" fetchPriority="high"/>
     <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/45 to-black/15"/>
     <div className="relative p-7 text-white sm:p-11"><span className="text-xs font-bold text-[#f5dab1]">البحث في يومياتي</span><h1 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">{experience.searchCta}</h1><p className="mt-3 max-w-xl text-sm leading-7 text-white/85">ابحثي باسم المنتج، أو اكتشفي الأقسام والأفكار اللي تناسب ذوقك.</p></div>
    </div>
   </section>}
   <section id="collection" className={"mx-auto max-w-7xl scroll-mt-32 px-4 pb-16 sm:px-6 lg:px-8 "+(searchOnly||slug?"pt-8 sm:pt-12":"pt-20")}>
    <div className="flex flex-wrap items-end justify-between gap-5"><SectionIntro eyebrow={shopName} title={slug?"تفاصيل المنتج":searchOnly?"ابحثي في منتجات يومياتي":experience.collectionTitle} description={slug?undefined:searchOnly?"البحث يفهم اختلاف كتابة الكلمات العربية، الكلمات القريبة، وأسماء المنتجات المتاحة للعرض.":"اكتشفي المنتجات وتفاصيلها وأسعارها في مكان واحد، واختاري اللي يناسبك."}/>{!slug&&<label className="relative block w-full sm:w-auto"><Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"/><input type="search" className="field w-full pr-12 sm:w-72" value={term} onChange={e=>setTerm(e.target.value)} placeholder="ابحثي بين المنتجات" aria-label="بحث المنتجات المعتمدة"/></label>}</div>
    {!slug&&<div className="mt-5 flex flex-wrap items-center gap-2" aria-label="اقتراحات البحث">
      {(term.trim()?suggestions:SEARCH_GROUPS).slice(0,6).map(group=><a key={group.slug} href={path+"/c/"+group.slug} className="inline-flex min-h-10 items-center rounded-full border border-border bg-card px-4 text-xs font-bold text-primary transition-colors hover:border-primary/40 hover:bg-primary-soft">{group.title}</a>)}
      {term.trim()&&<button type="button" onClick={()=>setTerm("")} className="min-h-10 rounded-full border px-4 text-xs font-semibold text-muted-foreground hover:text-primary">مسح البحث</button>}
    </div>}
    {!origin||!key?<EmptyProducts title="تعرّفي على مجموعات يومياتي" message="اكتشفي الأفكار والأقسام أعلاه. تظهر هنا المنتجات التي تتوافر لها بيانات معتمدة."/>
    :error?<div role="alert" className="mt-8 rounded-3xl border bg-card p-8 text-center"><h3 className="font-bold">تعذّر تحميل المنتجات في الوقت الحالي</h3><button type="button" className="btn-outline mt-4" onClick={()=>setAttempt(v=>v+1)}>إعادة المحاولة</button></div>
    :rows===null?<div role="status" aria-live="polite" className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">{Array.from({length:4},(_,i)=><div key={i} className="animate-pulse rounded-2xl border bg-card p-3"><div className="aspect-square rounded-xl bg-muted"/><div className="mt-3 h-4 w-3/4 rounded bg-muted"/><div className="mt-3 h-4 w-1/2 rounded bg-muted"/></div>)}</div>
    :slug?detail?<div className="mt-8"><div className="grid gap-8 rounded-[2rem] border bg-card p-5 shadow-soft sm:p-8 lg:grid-cols-2"><div className="grid aspect-square place-items-center rounded-[1.5rem] bg-muted"><Package className="h-20 w-20 text-primary/25" aria-hidden="true"/></div><div className="flex flex-col justify-center gap-5"><a href={path} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4 rotate-180"/>العودة إلى يومياتي</a><h2 className="font-display text-3xl font-extrabold leading-tight">{detail.title}</h2><p className="text-3xl font-extrabold text-primary">{formatListingPrice(detail,market)}</p><p className="whitespace-pre-line text-sm leading-8">{detail.description}</p><div className="rounded-xl bg-muted px-4 py-3 text-sm"><Check className="ml-2 inline h-4 w-4 text-primary"/>تُعرض المعلومات الحالية للمنتج. إتمام الطلب يتطلب تفعيل خدمة الشراء والتحقق من توافره.</div></div></div><div className="mt-8"><h3 className="mb-4 font-display text-xl font-extrabold">اختيارات أخرى من يومياتي</h3>{relatedVerifiedProducts(detail,rows).length?<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{relatedVerifiedProducts(detail,rows).map(item=><ShopCard key={item.listing_id} item={item} market={market}/>)}</div>:<p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">تصفحي المزيد من الأقسام والمنتجات المعتمدة في يومياتي.</p>}</div></div>
    :<EmptyProducts title="هذا المنتج غير متاح حالياً" message="قد تتغير حالة المنتجات بحسب اعتماد البيانات والتوافر."/>
    :matching.length?<div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{matching.map(item=><ShopCard key={item.listing_id} item={item} market={market}/>)}</div>
    :<EmptyProducts title={rows.length?"لم نجد منتجات مطابقة":"من هنا تبدأ اختياراتك"} message={rows.length?"جرّبي البحث بكلمة مختلفة.":"تصفّحي الأقسام واستكشفي الأفكار اللي تعجبك."}/>}
   </section>
   {!slug&&!searchOnly&&<>
    <section className="bg-primary-soft"><div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><SectionIntro eyebrow="لماذا يومياتي؟" title="تجربة خفيفة على القلب" description="كل تفصيلة في يومياتي مصممة لتجعل الاكتشاف أسهل وألطف."/><div className="mt-8 grid gap-4 md:grid-cols-3">{values.map(({icon:Icon,title,description},i)=><div key={title} className="rounded-3xl border border-white/60 bg-card p-7"><span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Icon className="h-6 w-6"/></span><h3 className="mt-5 text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p></div>)}</div></div></section>
    <section id="questions" className="mx-auto grid max-w-7xl scroll-mt-32 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[.75fr_1.25fr] lg:px-8"><div><SectionIntro eyebrow="كل ما تحتاجين معرفته" title={experience.faqTitle} description={experience.faqDescription}/><p className="mt-5 text-xs text-muted-foreground">تختلف تفاصيل الطلب والتوصيل باختلاف البلد والمنتج.</p></div><div className="space-y-3">{(market==="sa"?[...questions,...saudiHomeQuestions]:experience.questions).map((q,i)=><details key={q.question} className="group rounded-2xl border bg-card px-5 py-4" open={undefined}><summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 font-extrabold marker:hidden">{q.question}<ChevronDown className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden="true"/></summary><p className="pb-2 pt-3 text-sm leading-8 text-muted-foreground">{q.answer}</p></details>)}</div></section>
   </>}
  </main>
  <ShoppingAssistant market={market} products={rows??[]} productPage={Boolean(slug)}/>
  <StoreFooter market={market}/>
 </div>;
}
function EmptyProducts({title,message}:{title:string;message:string}){
 return <div role="status" className="mt-8 rounded-[2rem] border bg-card px-5 py-14 text-center shadow-soft sm:py-20"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary"><Heart className="h-8 w-8"/></span><h3 className="mt-5 font-display text-xl font-extrabold">{title}</h3><p className="mx-auto mt-3 max-w-md text-sm leading-8 text-muted-foreground">{message}</p></div>;
}
