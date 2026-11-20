import {useEffect,useState} from "react";
import {ArrowLeft,ArrowUpLeft,ChevronDown,Check,Heart,Instagram,Menu,Package,Search,ShieldCheck,Sparkles,X, type LucideIcon} from "lucide-react";
import {img} from "@/lib/store/images";
import {ShoppingAssistant} from "@/components/store/ShoppingAssistant";
import {StoreHeader,StoreFooter} from "@/components/store/StoreChrome";
import {markets,type MarketCode} from "@/lib/store/markets";
import {fetchPublicCatalog,fetchPublicDetail,formatListingPrice,type PublicListing,type PublicDetail} from "@/lib/store/public-catalog";

const names:Record<MarketCode,string>={sa:"السعودية",ae:"الإمارات",om:"عُمان",eg:"مصر",iq:"العراق"};
const origin=import.meta.env.VITE_YAWMIYATI_SUPABASE_URL;
const key=import.meta.env.VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY;
const categories=[
 {name:"المنزل والديكور",caption:"لأجواء تشبهك",picture:img["cat-home"]},
 {name:"المطبخ والقهوة",caption:"لحظات تستحق التذوّق",picture:img["cat-kitchen"]},
 {name:"الجمال والعناية",caption:"تفاصيل يومية ناعمة",picture:img["cat-beauty"]},
 {name:"الأزياء والإكسسوارات",caption:"إطلالة تعبر عنك",picture:img["cat-fashion"]},
 {name:"الراحة والرفاهية",caption:"مساحة لنفسك",picture:img["cat-wellness"]},
 {name:"التنظيم الذكي",caption:"أقل فوضى، راحة أكثر",picture:img["cat-organize"]},
] as const;
const values:{icon:LucideIcon;title:string;description:string}[]=[
 {icon:Heart,title:"اختيارات لها معنى",description:"نبحث عن قطع تتناسب مع التفاصيل الصغيرة في يومك."},
 {icon:ShieldCheck,title:"الوضوح أولاً",description:"نراجع معلومات المنتجات قبل عرضها."},
 {icon:Sparkles,title:"تجربة صُممت لك",description:"لغة عربية، تصفح مريح، واختيارات في مكان واحد."},
];
const questions=[
 {question:"كيف أختار منتجات يومياتي؟",answer:"يمكنك استكشاف الأقسام والمنتجات المتاحة للعرض. تفعيل إتمام الطلب يعتمد على حالة التشغيل والمخزون المعتمد في بلدك."},
 {question:"كيف أجد سعر المنتج وتفاصيله؟",answer:"نعرض الأسعار والتفاصيل فقط للمنتجات التي تملك بيانات مورد ومخزون معتمدة، ونتجنب عرض أسعار تخمينية."},
 {question:"هل تختلف المنتجات حسب البلد؟",answer:"يومياتي لديها صفحات مخصصة للسعودية والإمارات وعُمان ومصر والعراق، وتعرض كل صفحة العملة والمنتجات المرتبطة ببلدها."},
 {question:"أين أجد معلومات التوصيل والاسترجاع؟",answer:"تختلف هذه السياسات حسب البلد والمنتج. لا نعتمد أي رسوم أو مدد أو شروط ما لم تكن مؤكدة في صفحة المنتج أو سياسة المتجر."},
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
 
 const path="/"+market;
 const shopName="يومياتي "+names[market];
 useEffect(()=>{
  if(!origin||!key)return;
  let active=true;setError(false);setRows(null);setDetail(null);
  const task=slug?fetchPublicDetail(origin,key,market,slug).then(d=>{if(active){setDetail(d);setRows([]);}})
   :fetchPublicCatalog(origin,key,market).then(data=>{if(active)setRows(data);});
  task.catch(()=>{if(active)setError(true);});
  return()=>{active=false};
 },[market,slug,attempt]);
 const matching=rows?.filter(item=>item.title.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase()))??[];
 return <div dir="rtl" className="min-h-screen overflow-x-clip bg-background text-foreground">
  <a href="#main-content" className="skip-link">تخطي إلى المحتوى</a>
  <div className="bg-primary px-4 py-2.5 text-center text-[11px] font-bold tracking-wide text-primary-foreground sm:text-xs">اختيارات يومية للبيت والجمال والعناية · {names[market]}</div>
  <StoreHeader market={market}/>

  <main id="main-content">
   {!slug&&!searchOnly&&<>
    <section aria-label="مقدمة يومياتي" className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
     <div className="relative isolate min-h-[510px] overflow-hidden rounded-[2rem] bg-foreground sm:min-h-[560px] lg:min-h-[610px]">
      <img src={img.hero} alt="ركن منزلي بألوان هادئة وإضاءة دافئة" fetchPriority="high" width={1600} height={900} className="absolute inset-0 h-full w-full object-cover object-center"/>
      <div className="absolute inset-0 bg-gradient-to-l from-black/75 via-black/40 to-black/10"/>
      <div className="relative flex min-h-[510px] flex-col justify-center px-7 py-14 text-white sm:min-h-[560px] sm:px-12 lg:min-h-[610px] lg:px-20">
       <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/40 bg-white/15 px-4 py-2 text-xs font-bold backdrop-blur-sm"><Sparkles className="h-4 w-4"/> تفاصيل صغيرة، حياة أجمل</span>
       <h1 className="max-w-[650px] font-display text-[clamp(2.75rem,6vw,5.2rem)] font-extrabold leading-[1.18] tracking-tight">كل يوم يستحق<br/><span className="text-[#f5dab1]">لمسة أجمل.</span></h1>
       <p className="mt-6 max-w-[465px] text-base leading-8 text-white/90 sm:text-lg">من راحة البيت إلى تفاصيل العناية والقهوة، نشاركك اختيارات وأفكاراً تلهم اللحظات التي تحبينها.</p>
       <div className="mt-9 flex flex-wrap gap-3"><a href={path+"#discover"} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 font-extrabold text-foreground transition-colors hover:bg-[#f5dab1]">اكتشفي عالم يومياتي <ArrowLeft className="h-4 w-4"/></a><a href={path+"#collection"} className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/60 px-6 font-bold text-white hover:bg-white/10">استكشفي المنتجات</a></div>
       <p className="mt-8 text-xs font-medium text-white/80">اكتشفي الأفكار والأقسام واستكشفي المنتجات في يومياتي</p>
      </div>
     </div>
    </section>
    <section className="mx-auto grid max-w-7xl gap-2 px-4 pt-5 sm:grid-cols-3 sm:gap-4 sm:px-6 lg:px-8" aria-label="قيم يومياتي">{values.map(({icon:Icon,title,description})=><div key={title} className="flex items-center gap-3 rounded-2xl border bg-card/80 p-4 sm:p-5"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><Icon className="h-5 w-5"/></span><div><h2 className="text-sm font-extrabold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div></div>)}</section>
    <section id="discover" className="mx-auto max-w-7xl scroll-mt-32 px-4 pb-3 pt-20 sm:px-6 lg:px-8">
     <div className="flex flex-wrap items-end justify-between gap-5"><SectionIntro eyebrow="عالم يومياتي" title="كل ما يلهم تفاصيل يومك" description="ستة عوالم من الأفكار، صُممت لتكون بداية لاكتشاف اختياراتك القادمة."/><span className="rounded-full border px-4 py-2 text-xs text-muted-foreground">تصفحي مجموعات يومياتي</span></div>
     <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-6">{categories.map((c,i)=><a key={c.name} href={path+"/c/"+(["home","kitchen","beauty","fashion","wellness","organize"][i])} className="group block focus-visible:rounded-xl"><div className="aspect-[4/5] overflow-hidden rounded-[1.3rem] bg-muted"><img src={c.picture} alt={c.name} width={400} height={500} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/></div><h3 className="mt-3 text-sm font-extrabold sm:text-base group-hover:text-primary">{c.name}</h3><p className="mt-1 text-xs text-muted-foreground">{c.caption}</p></a>)}</div>
    </section>
    <section id="story" className="mx-auto max-w-7xl scroll-mt-32 px-4 pt-20 sm:px-6 lg:px-8">
     <div className="grid overflow-hidden rounded-[2rem] bg-accent md:grid-cols-2"><div className="relative min-h-[370px] md:min-h-[520px]"><img src={img["cat-kitchen"]} alt="تفاصيل ركن القهوة والمطبخ" loading="lazy" className="absolute inset-0 h-full w-full object-cover"/></div><div className="flex flex-col justify-center p-7 sm:p-12 lg:p-16"><SectionIntro eyebrow="حكاية يومياتي" title="الجمال في التفاصيل التي نعيشها كل يوم" description="نؤمن أن أسلوب الحياة الجميل يبدأ من أبسط الأشياء؛ فنجان قهوة، ركن مرتب، أو لحظة للعناية بالنفس."/><p className="mt-5 text-sm leading-8 text-accent-foreground">نقدّم مساحة عربية تجمع الإلهام واختيارات الاستخدام اليومي، مع تصميم مريح ومعلومات واضحة تجعل اكتشاف التفاصيل أسهل.</p><a href={path+"#collection"} className="btn-outline mt-7 w-fit">شاهدي ما نجهّزه <ArrowUpLeft className="h-4 w-4"/></a></div></div>
    </section>
    <section className="mx-auto grid max-w-7xl gap-5 px-4 pt-6 sm:grid-cols-2 sm:px-6 lg:px-8">
     <div className="group relative min-h-[340px] overflow-hidden rounded-[1.75rem]"><img src={img["cat-beauty"]} alt="مجموعة مستوحاة من الجمال والعناية" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"/><div className="absolute bottom-0 p-7 text-white"><p className="text-xs font-bold text-white/80">العناية تبدأ من التفاصيل</p><h3 className="mt-2 font-display text-2xl font-extrabold">وقت لنفسك، كل يوم</h3></div></div>
     <div className="group relative min-h-[340px] overflow-hidden rounded-[1.75rem]"><img src={img["cat-home"]} alt="تفاصيل منزلية دافئة" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"/><div className="absolute bottom-0 p-7 text-white"><p className="text-xs font-bold text-white/80">بيت يشبهك</p><h3 className="mt-2 font-display text-2xl font-extrabold">مساحات لها روح</h3></div></div>
    </section>
   </>}
   <section id="collection" className={"mx-auto max-w-7xl scroll-mt-32 px-4 pb-16 sm:px-6 lg:px-8 "+(searchOnly||slug?"pt-8 sm:pt-12":"pt-20")}>
    <div className="flex flex-wrap items-end justify-between gap-5"><SectionIntro eyebrow={shopName} title={slug?"تفاصيل المنتج":searchOnly?"ابحثي في منتجات يومياتي":"اختيارات يومياتي"} description={slug?undefined:"تصفّحي المنتجات وتعرّفي على تفاصيلها بوضوح. تظهر المعلومات والأسعار الفعلية فقط عندما تتوفر بيانات موثوقة."}/>{!slug&&<label className="relative block w-full sm:w-auto"><Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"/><input type="search" className="field w-full pr-12 sm:w-72" value={term} onChange={e=>setTerm(e.target.value)} placeholder="ابحثي بين المنتجات" aria-label="بحث المنتجات المعتمدة"/></label>}</div>
    {!origin||!key?<EmptyProducts title="تعرّفي على مجموعات يومياتي" message="اكتشفي الأفكار والأقسام أعلاه. تظهر هنا المنتجات التي تتوافر لها بيانات معتمدة."/>
    :error?<div role="alert" className="mt-8 rounded-3xl border bg-card p-8 text-center"><h3 className="font-bold">تعذّر تحميل المنتجات في الوقت الحالي</h3><button type="button" className="btn-outline mt-4" onClick={()=>setAttempt(v=>v+1)}>إعادة المحاولة</button></div>
    :rows===null?<div role="status" aria-live="polite" className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">{Array.from({length:4},(_,i)=><div key={i} className="animate-pulse rounded-2xl border bg-card p-3"><div className="aspect-square rounded-xl bg-muted"/><div className="mt-3 h-4 w-3/4 rounded bg-muted"/><div className="mt-3 h-4 w-1/2 rounded bg-muted"/></div>)}</div>
    :slug?detail?<div className="mt-8 grid gap-8 rounded-[2rem] border bg-card p-5 shadow-soft sm:p-8 lg:grid-cols-2"><div className="grid aspect-square place-items-center rounded-[1.5rem] bg-muted"><Package className="h-20 w-20 text-primary/25" aria-hidden="true"/></div><div className="flex flex-col justify-center gap-5"><a href={path} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4 rotate-180"/>العودة إلى يومياتي</a><h2 className="font-display text-3xl font-extrabold leading-tight">{detail.title}</h2><p className="text-3xl font-extrabold text-primary">{formatListingPrice(detail,market)}</p><p className="whitespace-pre-line text-sm leading-8">{detail.description}</p><div className="rounded-xl bg-muted px-4 py-3 text-sm"><Check className="ml-2 inline h-4 w-4 text-primary"/>تُعرض المعلومات الحالية للمنتج. إتمام الطلب يتطلب تفعيل خدمة الشراء والتحقق من توافره.</div></div></div>
    :<EmptyProducts title="هذا المنتج غير متاح حالياً" message="قد تتغير حالة المنتجات بحسب اعتماد البيانات والتوافر."/>
    :matching.length?<div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{matching.map(item=><ShopCard key={item.listing_id} item={item} market={market}/>)}</div>
    :<EmptyProducts title={rows.length?"لم نجد منتجات مطابقة":"اختيارات تستحق الاكتشاف"} message={rows.length?"جرّبي البحث بكلمة مختلفة.":"تصفّحي الأقسام الملهمة أعلاه. لا توجد منتجات معتمدة معروضة حالياً."}/>}
   </section>
   {!slug&&!searchOnly&&<>
    <section className="bg-primary-soft"><div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><SectionIntro eyebrow="لماذا يومياتي؟" title="فكرة بسيطة… تجربة أجمل" description="تجربة مصممة لتجعل التصفح واضحاً، والاختيار أسهل عندما نفتح أبواب المتجر."/><div className="mt-8 grid gap-4 md:grid-cols-3">{values.map(({icon:Icon,title,description},i)=><div key={title} className="rounded-3xl border border-white/60 bg-card p-7"><span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Icon className="h-6 w-6"/></span><h3 className="mt-5 text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p></div>)}</div></div></section>
    <section id="questions" className="mx-auto grid max-w-7xl scroll-mt-32 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[.75fr_1.25fr] lg:px-8"><div><SectionIntro eyebrow="كل ما تحتاجين معرفته" title="أسئلة تتكرر كثيراً" description="نفضّل الإجابات الواضحة قبل بدء الطلبات. هنا تجدين الإجابات الأساسية عن تجربة يومياتي."/><p className="mt-5 text-xs text-muted-foreground">معلومات الدفع والتوصيل تختلف حسب البلد وتظهر بعد التحقق منها.</p></div><div className="space-y-3">{questions.map((q,i)=><details key={q.question} className="group rounded-2xl border bg-card px-5 py-4" open={undefined}><summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 font-extrabold marker:hidden">{q.question}<ChevronDown className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden="true"/></summary><p className="pb-2 pt-3 text-sm leading-8 text-muted-foreground">{q.answer}</p></details>)}</div></section>
   </>}
  </main>
  <ShoppingAssistant market={market} products={rows??[]} productPage={Boolean(slug)}/>
  <StoreFooter market={market}/>
 </div>;
}
function EmptyProducts({title,message}:{title:string;message:string}){
 return <div role="status" className="mt-8 rounded-[2rem] border bg-card px-5 py-14 text-center shadow-soft sm:py-20"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary"><Heart className="h-8 w-8"/></span><h3 className="mt-5 font-display text-xl font-extrabold">{title}</h3><p className="mx-auto mt-3 max-w-md text-sm leading-8 text-muted-foreground">{message}</p></div>;
}
