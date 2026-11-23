import {publicBrowserConfig} from "@/lib/store/staging-public-config";
import {useEffect,useState} from "react";
import {ArrowLeft,ArrowUpLeft,ChevronDown,Heart,Package,Search,Sparkles, type LucideIcon} from "lucide-react";
import {Button} from "@/components/ui/button";
import {img} from "@/lib/store/images";
import {editorialSrcSet} from "@/lib/store/editorial-srcset";
import {ShoppingAssistant} from "@/components/store/ShoppingAssistant";
import {StoreHeader,StoreFooter} from "@/components/store/StoreChrome";
import {MarketPromiseStrip} from "@/components/store/MarketPromiseStrip";
import {marketIdentity} from "@/lib/store/market-identity";
import {marketExperience} from "@/lib/store/market-experience";
import {brandStory} from "@/lib/store/brand-story";
import {saudiDelivery,saudiHomeQuestions} from "@/lib/store/saudi-commerce-content";
import {relatedVerifiedProducts} from "@/lib/store/verified-merchandising";
import {ReleasedEditorial} from "./EditorialPage";
import {ApprovedProductGallery} from "@/lib/store/ApprovedProductExperience";
import {smartCatalogSearch,suggestEditorialCategories,SEARCH_GROUPS} from "@/lib/store/smart-search";
import {type MarketCode} from "@/lib/store/markets";
import {fetchPublicCatalog,fetchPublicDetail,fetchPublicSearch,formatListingPrice,type PublicListing,type PublicDetail} from "@/lib/store/public-catalog";
import {useOfferVersions} from "@/lib/store/offer-source";
import {offerListing} from "@/lib/store/offer-version";
import {OfferProductPanel,FixtureNotice} from "./OfferProductPanel";

const {origin,key}=publicBrowserConfig(import.meta.env["VITE_YAWMIYATI_SUPABASE_URL"],import.meta.env["VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY"]);
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
 {icon:Search,title:"التفاصيل تفرق",description:"كل منتج معروض له معلومات واضحة تساعدك تختارين."},
 {icon:Sparkles,title:"كل شيء بمكان واحد",description:"تصفّح عربي بسيط، وأقسام تلهم كل يوم."},
];

function SectionIntro({eyebrow,title,description}:{eyebrow:string;title:string;description?:string|undefined}){
 return <div className="space-y-2"><p className="text-xs font-extrabold tracking-wider text-primary">{eyebrow}</p><h2 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl md:text-4xl">{title}</h2>{description&&<p className="max-w-2xl text-sm leading-8 text-muted-foreground md:text-base">{description}</p>}</div>;
}
// Product-type photography links to a department until released listings are available.
const browseTiles=[
 {image:"/browse/coffee-frother.webp",title:"خفّاقات الحليب",department:"kitchen"},
 {image:"/browse/hair-styling.webp",title:"أدوات تصفيف الشعر",department:"beauty"},
 {image:"/browse/spice-jars.webp",title:"عبوات التوابل",department:"organize"},
 {image:"/browse/bath-set.webp",title:"أطقم الحمّام",department:"home"},
] as const;
function BrowseProducts({market}:{market:MarketCode}){
 return <nav aria-label="تصفّحي حسب نوع المنتج" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-5">
  {browseTiles.map(tile=>{
   const category=categories.find(c=>c.slug===tile.department)!;
   return <a key={tile.image} href={`/${market}/c/${category.slug}`} className="group overflow-hidden rounded-xl border bg-card">
    <img src={tile.image} alt="" width={360} height={270} className="aspect-square w-full bg-[#efe6d7] object-contain"/>
    <div className="space-y-1 p-3 sm:p-4"><span className="block font-bold">{tile.title}</span><span className="inline-flex items-center gap-1 text-xs text-primary">تصفّحي {category.name} <ArrowLeft size={14}/></span></div>
   </a>
  })}
 </nav>;
}
function ShopCard({item,market,image}:{item:PublicListing;market:MarketCode;image?:{url:string;alt:string}|null}){
 const href=`/${market}/p/${encodeURIComponent(item.slug)}`;
 return <article className="group h-full overflow-hidden rounded-xl border border-border/70 bg-card shadow-soft transition-shadow hover:shadow-md">
  <a href={href} aria-label={item.title} className="flex h-full min-h-36 flex-col gap-3 p-4 focus-visible:outline focus-visible:outline-primary sm:p-5">
   {image?<img src={image.url} alt={image.alt} width={360} height={360} className="-mx-4 -mt-4 aspect-square w-[calc(100%+2rem)] max-w-none bg-[#efe6d7] object-contain sm:-mx-5 sm:-mt-5 sm:w-[calc(100%+2.5rem)]"/>:<Package className="h-5 w-5 text-primary/70" aria-hidden="true"/>}
   <h3 className="text-base font-bold leading-6 group-hover:text-primary sm:text-lg">{item.title}</h3>
   <p className="mt-auto text-lg font-extrabold text-primary">{formatListingPrice(item,market)}</p>
   <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">تفاصيل المنتج <ArrowLeft size={14} aria-hidden="true"/></span>
  </a>
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
 // Approved offer versions (isolated fixtures today) take over the catalog without touching Supabase.
 const offers=useOfferVersions(market);
 const offerVersions=offers.state==="ready"?offers.versions:null;
 const offerVersion=slug&&offerVersions?offerVersions.find(v=>v.slug===slug)??null:null;
 const imageFor=(item:PublicListing)=>offerVersions?.find(v=>v.listing_id===item.listing_id)?.image??null;
 useEffect(()=>{
  if(offers.state==="loading"){setRows(null);setDetail(null);return;}
  if(offers.state==="ready"){
   setError(false);
   const listings=offers.versions.map(offerListing);
   const version=slug?offers.versions.find(v=>v.slug===slug):undefined;
   setRows(listings);
   setDetail(version?{...offerListing(version),description:version.description}:null);
   return;
  }
  if(!origin||!key)return;
  let active=true;setError(false);setRows(null);setDetail(null);
  const task=slug?Promise.all([fetchPublicDetail(origin,key,market,slug),fetchPublicCatalog(origin,key,market).catch(()=>[])]).then(([d,items])=>{if(active){setDetail(d);setRows(items);}})
   :fetchPublicCatalog(origin,key,market).then(data=>{if(active)setRows(data);});
  task.catch(()=>{if(active)setError(true);});
  return()=>{active=false};
 },[market,slug,attempt,offers]);
 useEffect(()=>{
  if(offers.state!=="off"||!origin||!key||!rows||slug||term.trim().length<2)return;
  let alive=true;
  const timer=setTimeout(()=>{void fetchPublicSearch(origin,key,market,term).then(result=>{if(alive)setRemoteSearch({query:term,rows:result});}).catch(()=>{if(alive)setRemoteSearch(null);});},280);
  return()=>{alive=false;clearTimeout(timer);};
 },[market,rows,slug,term,offers.state]);
 const localMatches=rows?smartCatalogSearch(term,rows):[];
 const remoteMatches=remoteSearch?.query===term?remoteSearch.rows:[];
 const matchedIds=new Set(localMatches.map(x=>x.listing_id));
 const matching=[...localMatches,...remoteMatches.filter(x=>!matchedIds.has(x.listing_id))];
 const suggestions=suggestEditorialCategories(term);
 const homePage=!searchOnly&&!slug;
 const browseEmpty=homePage&&!term.trim()&&offers.state==="off"&&(!origin||!key||rows?.length===0);
 return <div dir="rtl" data-yawmiyati-market={market} className="min-h-screen overflow-x-clip bg-background text-foreground">
  <a href="#main-content" className="skip-link">تخطي إلى المحتوى</a>
  <div className="bg-primary px-4 py-2.5 text-center text-[11px] font-bold tracking-wide text-primary-foreground sm:text-xs">{experience.announcement}</div>
  <StoreHeader market={market}/>

  <main id="main-content">
   {searchOnly&&<section aria-label="اكتشفي المنتجات" className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
    <div className="relative isolate flex min-h-[200px] items-center overflow-hidden rounded-[1.75rem] bg-foreground sm:min-h-[260px]">
     <img src={img["cat-home"]} alt="" className="absolute inset-0 h-full w-full object-cover object-center" fetchPriority="high"/>
     <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/45 to-black/15"/>
     <div className="relative p-7 text-white sm:p-11"><span className="text-xs font-bold text-[#f5dab1]">البحث في يومياتي</span><h1 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">{experience.searchCta}</h1><p className="mt-3 max-w-xl text-sm leading-7 text-white/85">ابحثي باسم المنتج، أو اكتشفي الأقسام والأفكار اللي تناسب ذوقك.</p></div>
    </div>
   </section>}
   <section id="collection" className={"mx-auto max-w-7xl scroll-mt-4 px-4 pb-16 sm:px-6 lg:px-8 "+(searchOnly||slug?"pt-8 sm:pt-12":"pt-4 sm:pt-6")}>
    <div className="flex flex-wrap items-end justify-between gap-5"><SectionIntro eyebrow={shopName} title={slug?"تفاصيل المنتج":searchOnly?"ابحثي في منتجات يومياتي":experience.collectionTitle} description={slug?undefined:searchOnly?"البحث يفهم اختلاف كتابة الكلمات العربية، الكلمات القريبة، وأسماء المنتجات المتاحة للعرض.":undefined}/>{!slug&&<label className="relative block w-full sm:w-auto"><Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"/><input type="search" className="field w-full pr-12 sm:w-72" value={term} onChange={e=>setTerm(e.target.value)} placeholder="ابحثي بين المنتجات" aria-label="بحث المنتجات المعتمدة"/></label>}</div>
    {!slug&&<div className={(searchOnly||term.trim()?"mt-5 flex":"hidden")+" flex-wrap items-center gap-2"} aria-label="اقتراحات البحث">
      {(term.trim()?suggestions:SEARCH_GROUPS).slice(0,6).map(group=><a key={group.slug} href={path+"/c/"+group.slug} className="inline-flex min-h-10 items-center rounded-full border border-border bg-card px-4 text-xs font-bold text-primary transition-colors hover:border-primary/40 hover:bg-primary-soft">{group.title}</a>)}
      {term.trim()&&<Button variant="outline" onClick={()=>setTerm("")} className="min-h-11 rounded-full px-4 text-xs font-semibold text-muted-foreground">مسح البحث</Button>}
    </div>}
    {browseEmpty?<BrowseProducts market={market}/>:offers.state==="off"&&(!origin||!key)?<EmptyProducts title="تعرّفي على مجموعات يومياتي" message="تظهر هنا المنتجات التي تتوافر لها بيانات معتمدة. اكتشفي أقسام البيت والجمال والعناية."/>
    :error?<div role="alert" className="mt-8 rounded-3xl border bg-card p-8 text-center"><h3 className="font-bold">تعذّر تحميل المنتجات في الوقت الحالي</h3><Button variant="outline" className="mt-4 min-h-11" onClick={()=>setAttempt(v=>v+1)}>إعادة المحاولة</Button></div>
    :rows===null?<div role="status" aria-live="polite" className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">{Array.from({length:4},(_,i)=><div key={i} className="animate-pulse rounded-2xl border bg-card p-3"><div className="aspect-square rounded-xl bg-muted"/><div className="mt-3 h-4 w-3/4 rounded bg-muted"/><div className="mt-3 h-4 w-1/2 rounded bg-muted"/></div>)}</div>
    :slug&&offerVersion&&offerVersions?<div className="mt-8"><OfferProductPanel key={offerVersion.version_id} market={market} version={offerVersion} versions={offerVersions}/>
      <div className="mt-8"><h3 className="mb-4 font-display text-xl font-extrabold">اختيارات أخرى من يومياتي</h3><div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{offerVersions.filter(v=>v.slug!==slug).map(v=><ShopCard key={v.listing_id} item={offerListing(v)} market={market} image={v.image}/>)}</div></div></div>
    :slug&&offerVersions?<EmptyProducts title="هذا المنتج غير موجود في الكتالوج" message="قد تتغير حالة المنتجات بحسب اعتماد البيانات والتوافر."/>
    :slug?detail?<div className="mt-8"><ReleasedEditorial key={market+slug} origin={origin} apiKey={key} market={market} slug={slug} fallback={<ApprovedProductGallery key={detail.listing_id} market={market} detail={detail}/>}/>
      <div className="mt-8"><h3 className="mb-4 font-display text-xl font-extrabold">اختيارات أخرى من يومياتي</h3>{relatedVerifiedProducts(detail,rows).length?<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{relatedVerifiedProducts(detail,rows).map(item=><ShopCard key={item.listing_id} item={item} market={market}/>)}</div>:<p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">تصفحي المزيد من الأقسام والمنتجات المعتمدة في يومياتي.</p>}</div></div>
    :<EmptyProducts title="هذا المنتج غير موجود في الكتالوج" message="قد تتغير حالة المنتجات بحسب اعتماد البيانات والتوافر."/>
    :matching.length?<>{offerVersions&&<div className="mt-5"><FixtureNotice/></div>}<div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{matching.map(item=><ShopCard key={item.listing_id} item={item} market={market} image={imageFor(item)}/>)}</div></>
    :<EmptyProducts title={rows.length?"لم نجد منتجات مطابقة":"من هنا تبدأ اختياراتك"} message={rows.length?"جرّبي البحث بكلمة مختلفة.":"تصفّحي الأقسام واستكشفي الأفكار اللي تعجبك."}/>}
   </section>
   {!slug&&!searchOnly&&<>
    <section aria-label="مقدمة يومياتي" className="storefront-hero relative isolate overflow-hidden bg-foreground">
     <img src={img[experience.heroImage]} srcSet={editorialSrcSet(img[experience.heroImage])} sizes="100vw" alt={experience.heroAlt} fetchPriority="high" width={1600} height={900} className="absolute inset-0 h-full w-full object-cover object-center"/>
     <div className="absolute inset-0 bg-hero-fade"/>
     <div className="relative mx-auto flex w-full max-w-7xl flex-col justify-center px-5 py-8 text-photo-foreground sm:px-6 sm:py-10 lg:px-8">
      <p className="mb-3 flex items-center gap-2 text-xs font-bold"><Sparkles className="h-4 w-4" aria-hidden="true"/>{experience.eyebrow}</p>
      <h1 className="storefront-hero-title max-w-2xl font-display font-extrabold leading-tight">{experience.heroStart}<br/><span className="text-photo-accent">{experience.heroAccent}</span></h1>
      <p className="mt-4 max-w-md text-sm leading-7 text-photo-foreground/90 sm:text-base">{experience.heroDescription}</p>
      <div className="mt-5 flex flex-wrap gap-3">
       <Button asChild className="h-auto min-h-11 rounded-full bg-photo-foreground px-5 py-3 font-extrabold text-foreground hover:bg-photo-accent"><a href={path+"#collection"}>اكتشفي المنتجات <ArrowLeft aria-hidden="true"/></a></Button>
       <Button variant="outline" onClick={()=>document.dispatchEvent(new CustomEvent("yawmiyati:open-search"))} className="h-auto min-h-11 rounded-full border-photo-foreground/60 bg-transparent px-5 py-3 text-photo-foreground hover:bg-photo-foreground/15 hover:text-photo-foreground"><Search aria-hidden="true"/>{experience.searchCta}</Button>
      </div>
     </div>
    </section>
    <section id="discover" aria-labelledby="discover-title" className="mx-auto max-w-7xl scroll-mt-4 px-4 pt-6 sm:px-6 lg:px-8">
     <div className="flex items-center justify-between gap-3"><h2 id="discover-title" className="font-display text-lg font-extrabold sm:text-xl">{experience.discoverTitle}</h2><span className="hidden text-xs text-muted-foreground sm:inline">على ذوقك، من البيت للعناية</span></div>
     <nav aria-label="تسوقي حسب القسم" className="storefront-category-strip mt-4">{orderedCategories.map(c=><a key={c.slug} href={path+"/c/"+c.slug} className="group flex min-w-0 flex-col items-center gap-2 rounded-lg px-1 py-1 text-center"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-muted sm:h-20 sm:w-20"><img src={c.picture} srcSet={editorialSrcSet(c.picture)} sizes="(max-width: 640px) 64px, 80px" alt="" width={80} height={80} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"/></div><h3 className="text-xs font-bold leading-5 group-hover:text-primary sm:text-sm">{c.name}</h3></a>)}</nav>
    </section>
   </>}
   {!slug&&!searchOnly&&<>
    <section className="mx-auto grid max-w-7xl gap-5 px-4 pt-0 sm:grid-cols-2 sm:px-6 lg:px-8">
     <div className="group relative min-h-[260px] sm:min-h-[320px] overflow-hidden rounded-lg"><img src={img["cat-beauty"]} srcSet={editorialSrcSet(img["cat-beauty"])} sizes="(max-width: 640px) 100vw, 50vw" alt="مجموعة مستوحاة من الجمال والعناية" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/><div className="absolute inset-0 bg-gradient-to-t from-photo-scrim/80 via-photo-scrim/10 to-transparent"/><div className="absolute bottom-0 p-7 text-photo-foreground"><p className="text-xs font-bold text-photo-foreground/80">العناية تبدأ من التفاصيل</p><h3 className="mt-2 font-display text-2xl font-extrabold">{experience.beautyTitle}</h3><a href={path+"/c/beauty"} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-photo-foreground px-5 py-2 text-sm font-extrabold text-foreground transition-colors hover:bg-photo-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photo-foreground">اكتشفي عالم العناية <ArrowLeft className="h-4 w-4" aria-hidden="true"/></a></div></div>
     <div className="group relative min-h-[260px] sm:min-h-[320px] overflow-hidden rounded-lg"><img src={img["cat-home"]} srcSet={editorialSrcSet(img["cat-home"])} sizes="(max-width: 640px) 100vw, 50vw" alt="تفاصيل منزلية دافئة" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/><div className="absolute inset-0 bg-gradient-to-t from-photo-scrim/80 via-photo-scrim/10 to-transparent"/><div className="absolute bottom-0 p-7 text-photo-foreground"><p className="text-xs font-bold text-photo-foreground/80">بيت يعكس ذوقك</p><h3 className="mt-2 font-display text-2xl font-extrabold">{experience.homeTitle}</h3><a href={path+"/c/home"} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-photo-foreground px-5 py-2 text-sm font-extrabold text-foreground transition-colors hover:bg-photo-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-photo-foreground">اكتشفي لمسات البيت <ArrowLeft className="h-4 w-4" aria-hidden="true"/></a></div></div>
    </section>
    <section id="story" aria-labelledby="story-title" className="mx-auto grid max-w-7xl items-center gap-6 px-4 py-12 sm:grid-cols-[1fr_2fr] sm:px-6 lg:gap-12 lg:px-8">
     <img src={img[market==="sa"?"cat-kitchen":market==="ae"?"cat-fashion":market==="om"?"cat-home":market==="eg"?"cat-kitchen":"cat-wellness"]} srcSet={editorialSrcSet(img[market==="sa"?"cat-kitchen":market==="ae"?"cat-fashion":market==="om"?"cat-home":market==="eg"?"cat-kitchen":"cat-wellness"])} sizes="(max-width: 640px) 100vw, 33vw" alt="تفاصيل من عالم يومياتي" width={600} height={400} loading="lazy" className="aspect-[3/2] w-full rounded-lg object-cover"/>
     <div><p className="text-xs font-bold text-primary">{brandStory[market].kicker}</p><h2 id="story-title" className="mt-2 font-display text-2xl font-extrabold leading-9">{brandStory[market].turningTitle}</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{brandStory[market].turning}</p><Button asChild variant="link" className="mt-3 h-auto min-h-11 px-0 font-bold"><a href={path+"/story"}>اقرئي قصتنا كاملة <ArrowUpLeft aria-hidden="true"/></a></Button><Button asChild variant="link" className="mr-4 mt-3 h-auto min-h-11 px-0 font-bold"><a href={path+"#discover"} onClick={e=>{const el=document.getElementById("discover");if(el){e.preventDefault();el.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});}}}>اختاري اللي يعجبك <ArrowLeft aria-hidden="true"/></a></Button></div>
    </section>
    <section aria-label="قيم يومياتي" className="border-y border-border bg-primary-soft"><div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6 lg:px-8">{values.map(({icon:Icon,title,description})=><div key={title} className="flex items-start gap-3"><Icon className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true"/><div><h2 className="text-sm font-extrabold">{title}</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p></div></div>)}</div></section>
    {market==="sa"?<section aria-label="الدفع والتوصيل في السعودية" className="mx-auto grid max-w-7xl gap-5 px-4 pt-10 sm:grid-cols-3 sm:px-6 lg:px-8"><div><h2 className="text-sm font-bold">الدفع عند الاستلام</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">{saudiDelivery.payment}</p></div><div><h2 className="text-sm font-bold">رسوم التوصيل</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">الدفع عند الاستلام · {saudiDelivery.shipping}</p></div><div><h2 className="text-sm font-bold">التوصيل والاسترجاع</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">{saudiDelivery.near}</p><Button asChild variant="link" className="mt-2 h-auto min-h-11 px-0 text-xs"><a href={path+"/info/shipping-returns"}>اعرفي أكثر عن الشحن والاسترجاع <ArrowLeft aria-hidden="true"/></a></Button></div></section>:<MarketPromiseStrip market={market}/>}
    <section id="questions" className="mx-auto max-w-5xl scroll-mt-4 px-4 py-16 sm:px-6 sm:py-20 lg:px-8"><div className="max-w-2xl"><SectionIntro eyebrow="كل ما تحتاجين معرفته" title={experience.faqTitle} description={experience.faqDescription}/><a href={path+"/info/shipping-returns"} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary underline underline-offset-4">تفاصيل الشحن والاسترجاع <ArrowLeft className="h-4 w-4" aria-hidden="true"/></a></div><div className="mt-7 grid items-start gap-3 sm:grid-cols-2">{(market==="sa"?saudiHomeQuestions:experience.questions).map((q,i)=><details key={q.question} className="group rounded-2xl border bg-card px-5 py-4" open={undefined}><summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 font-extrabold marker:hidden">{q.question}<ChevronDown className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden="true"/></summary><p className="pb-2 pt-3 text-sm leading-8 text-muted-foreground">{q.answer}</p></details>)}</div></section>
   </>}
  </main>
  <ShoppingAssistant market={market} products={rows??[]} productPage={Boolean(slug)}/>
  <StoreFooter market={market}/>
 </div>;
}
function EmptyProducts({title,message}:{title:string;message:string}){
 return <div role="status" className="mt-8 rounded-lg border bg-card px-5 py-7 text-center sm:py-9"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary"><Heart className="h-8 w-8"/></span><h3 className="mt-5 font-display text-xl font-extrabold">{title}</h3><p className="mx-auto mt-3 max-w-md text-sm leading-8 text-muted-foreground">{message}</p></div>;
}
