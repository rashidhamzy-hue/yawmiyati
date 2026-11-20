import {useEffect,useState} from "react";
import {ArrowLeft,ArrowUpLeft,ChevronDown,Check,Heart,Instagram,Menu,Package,Search,ShieldCheck,Sparkles,X, type LucideIcon} from "lucide-react";
import {img} from "@/lib/store/images";
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
 {icon:ShieldCheck,title:"الوضوح أولاً",description:"لا نعرض المنتجات للبيع قبل اعتماد معلوماتها وتوافرها."},
 {icon:Sparkles,title:"تجربة صُممت لك",description:"لغة عربية، تصفح مريح، واختيارات في مكان واحد."},
];
const questions=[
 {question:"هل يمكنني الطلب من يومياتي الآن؟",answer:"المتجر حالياً في مرحلة التحضير. لا نستقبل طلبات أو مدفوعات إلى أن تكتمل جاهزية المنتجات وعمليات الشحن."},
 {question:"متى ستظهر المنتجات والأسعار؟",answer:"ستظهر المنتجات المعتمدة وأسعارها عندما يتم التحقق من بيانات الموردين والتوافر وتفاصيل كل منتج. لن نعرض أسعاراً تجريبية على أنها أسعار حقيقية."},
 {question:"هل سيكون لكل بلد متجره الخاص؟",answer:"نعمل على تجارب مخصصة للسعودية والإمارات وعُمان ومصر والعراق، مع عملات وتفاصيل تناسب كل بلد."},
 {question:"كيف أعرف سياسة التوصيل والاسترجاع؟",answer:"سننشر معلومات التوصيل والدفع والاسترجاع لكل بلد عندما يتم تأكيد شركاء التشغيل وسياسات الخدمة، وقبل فتح الطلبات."},
] as const;

function SectionIntro({eyebrow,title,description}:{eyebrow:string;title:string;description?:string}){
 return <div className="space-y-2"><p className="text-xs font-extrabold tracking-wider text-primary">{eyebrow}</p><h2 className="font-display text-3xl font-extrabold leading-tight md:text-4xl">{title}</h2>{description&&<p className="max-w-2xl text-sm leading-8 text-muted-foreground md:text-base">{description}</p>}</div>;
}
function ShopCard({item,market}:{item:PublicListing;market:MarketCode}){
 return <article className="group flex h-full flex-col overflow-hidden rounded-[1.4rem] border border-border/70 bg-card shadow-soft transition-transform duration-300 hover:-translate-y-1">
  <a href={`/${market}/p/${encodeURIComponent(item.slug)}`} className="grid aspect-[4/4.7] place-items-center bg-muted" aria-label={item.title}><Package className="h-12 w-12 text-primary/35" aria-hidden="true"/></a>
  <div className="flex flex-1 flex-col gap-3 p-4"><a href={`/${market}/p/${encodeURIComponent(item.slug)}`} className="font-bold leading-7 hover:text-primary">{item.title}</a><p className="mt-auto text-lg font-extrabold text-primary">{formatListingPrice(item,market)}</p><span className="text-xs text-muted-foreground">معاينة تفاصيل المنتج</span></div>
 </article>;
}
export function MarketPreview({market,slug,searchOnly=false,initialSearch=""}:{market:MarketCode;slug?:string;searchOnly?:boolean;initialSearch?:string}){
 const [rows,setRows]=useState<PublicListing[]|null>(null),[detail,setDetail]=useState<PublicDetail|null>(null);
 const [term,setTerm]=useState(initialSearch),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 const [menu,setMenu]=useState(false);
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
  <div className="bg-primary px-4 py-2.5 text-center text-[11px] font-bold tracking-wide text-primary-foreground sm:text-xs">قريباً · نصنع لك تجربة تسوّق أجمل في {names[market]}</div>
  <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-xl">
   <div className="mx-auto flex min-h-[76px] max-w-7xl items-center gap-5 px-4 sm:px-6 lg:px-8">
    <a href={path} className="shrink-0 font-display text-[1.85rem] font-extrabold tracking-tight text-primary" aria-label={shopName+" — الرئيسية"}>يومياتي<span className="text-gold">.</span></a>
    <span className="hidden rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground sm:inline-flex">{names[market]}</span>
    <nav aria-label="التنقل الرئيسي" className="mr-6 hidden items-center gap-7 text-sm font-bold lg:flex">
     <a href={path+"#discover"} className="transition-colors hover:text-primary">اكتشفي الأقسام</a><a href={path+"#collection"} className="transition-colors hover:text-primary">المنتجات</a><a href={path+"#story"} className="transition-colors hover:text-primary">حكايتنا</a><a href={path+"#questions"} className="transition-colors hover:text-primary">الأسئلة الشائعة</a>
    </nav>
    <div className="mr-auto flex items-center gap-2">
     <span className="hidden rounded-full bg-primary-soft px-3 py-2 text-xs font-extrabold text-primary sm:inline-flex">{markets[market].currency}</span>
     <a href={path+"#collection"} aria-label="ابحثي في المنتجات" className="tap grid place-items-center rounded-full border border-border bg-card hover:border-primary"><Search className="h-5 w-5"/></a>
     <button type="button" className="tap grid place-items-center rounded-full border border-border bg-card lg:hidden" onClick={()=>setMenu(v=>!v)} aria-label={menu?"إغلاق القائمة":"فتح القائمة"} aria-expanded={menu} aria-controls="mobile-yawmiyati-menu">{menu?<X className="h-5 w-5"/>:<Menu className="h-5 w-5"/>}</button>
    </div>
   </div>
   {menu&&<nav id="mobile-yawmiyati-menu" aria-label="قائمة الجوال" className="grid gap-0 border-t bg-card px-5 py-2 text-sm font-bold lg:hidden">{[["اكتشفي الأقسام","#discover"],["المنتجات","#collection"],["حكايتنا","#story"],["الأسئلة الشائعة","#questions"]].map(([label,hash])=><a key={hash} href={path+hash} onClick={()=>setMenu(false)} className="min-h-12 border-b border-border/50 py-3 last:border-0">{label}</a>)}</nav>}
  </header>

  <main id="main-content">
   {!slug&&!searchOnly&&<>
    <section aria-label="مقدمة يومياتي" className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
     <div className="relative isolate min-h-[510px] overflow-hidden rounded-[2rem] bg-foreground sm:min-h-[560px] lg:min-h-[610px]">
      <img src={img.hero} alt="ركن منزلي بألوان هادئة وإضاءة دافئة" fetchPriority="high" width={1600} height={900} className="absolute inset-0 h-full w-full object-cover object-center"/>
      <div className="absolute inset-0 bg-gradient-to-l from-black/75 via-black/40 to-black/10"/>
      <div className="relative flex min-h-[510px] flex-col justify-center px-7 py-14 text-white sm:min-h-[560px] sm:px-12 lg:min-h-[610px] lg:px-20">
       <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/40 bg-white/15 px-4 py-2 text-xs font-bold backdrop-blur-sm"><Sparkles className="h-4 w-4"/> تفاصيل صغيرة، حياة أجمل</span>
       <h1 className="max-w-[650px] font-display text-[clamp(2.75rem,6vw,5.2rem)] font-extrabold leading-[1.18] tracking-tight">كل يوم يستحق<br/><span className="text-[#f5dab1]">لمسة أجمل.</span></h1>
       <p className="mt-6 max-w-[465px] text-base leading-8 text-white/90 sm:text-lg">من راحة البيت إلى تفاصيل العناية والقهوة، نجهّز لك اختيارات تلهم اللحظات التي تحبينها.</p>
       <div className="mt-9 flex flex-wrap gap-3"><a href={path+"#discover"} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 font-extrabold text-foreground transition-colors hover:bg-[#f5dab1]">اكتشفي عالم يومياتي <ArrowLeft className="h-4 w-4"/></a><a href={path+"#collection"} className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/60 px-6 font-bold text-white hover:bg-white/10">المنتجات المعتمدة</a></div>
       <p className="mt-8 text-xs font-medium text-white/80">المتجر قيد التحضير · لا نستقبل طلبات أو مدفوعات حالياً</p>
      </div>
     </div>
    </section>
    <section className="mx-auto grid max-w-7xl gap-2 px-4 pt-5 sm:grid-cols-3 sm:gap-4 sm:px-6 lg:px-8" aria-label="قيم يومياتي">{values.map(({icon:Icon,title,description})=><div key={title} className="flex items-center gap-3 rounded-2xl border bg-card/80 p-4 sm:p-5"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><Icon className="h-5 w-5"/></span><div><h2 className="text-sm font-extrabold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div></div>)}</section>
    <section id="discover" className="mx-auto max-w-7xl scroll-mt-32 px-4 pb-3 pt-20 sm:px-6 lg:px-8">
     <div className="flex flex-wrap items-end justify-between gap-5"><SectionIntro eyebrow="عالم يومياتي" title="كل ما يلهم تفاصيل يومك" description="ستة عوالم من الأفكار، صُممت لتكون بداية لاكتشاف اختياراتك القادمة."/><span className="rounded-full border px-4 py-2 text-xs text-muted-foreground">أقسام استكشافية · المنتجات قريباً</span></div>
     <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-6">{categories.map((c,i)=><div key={c.name} className="group"><div className="aspect-[4/5] overflow-hidden rounded-[1.3rem] bg-muted"><img src={c.picture} alt={c.name} width={400} height={500} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/></div><h3 className="mt-3 text-sm font-extrabold sm:text-base">{c.name}</h3><p className="mt-1 text-xs text-muted-foreground">{c.caption}</p></div>)}</div>
    </section>
    <section id="story" className="mx-auto max-w-7xl scroll-mt-32 px-4 pt-20 sm:px-6 lg:px-8">
     <div className="grid overflow-hidden rounded-[2rem] bg-accent md:grid-cols-2"><div className="relative min-h-[370px] md:min-h-[520px]"><img src={img["cat-kitchen"]} alt="تفاصيل ركن القهوة والمطبخ" loading="lazy" className="absolute inset-0 h-full w-full object-cover"/></div><div className="flex flex-col justify-center p-7 sm:p-12 lg:p-16"><SectionIntro eyebrow="حكاية يومياتي" title="الجمال في التفاصيل التي نعيشها كل يوم" description="نؤمن أن أسلوب الحياة الجميل يبدأ من أبسط الأشياء؛ فنجان قهوة، ركن مرتب، أو لحظة للعناية بالنفس."/><p className="mt-5 text-sm leading-8 text-accent-foreground">نبني مساحة عربية تجمع الإلهام واختيارات الاستخدام اليومي، مع معلومات واضحة قبل أي عملية شراء. نحن الآن في مرحلة الإعداد، ونفضّل أن نأخذ وقتنا على أن نعرض وعوداً لم نتحقق منها.</p><a href={path+"#collection"} className="btn-outline mt-7 w-fit">شاهدي ما نجهّزه <ArrowUpLeft className="h-4 w-4"/></a></div></div>
    </section>
    <section className="mx-auto grid max-w-7xl gap-5 px-4 pt-6 sm:grid-cols-2 sm:px-6 lg:px-8">
     <div className="group relative min-h-[340px] overflow-hidden rounded-[1.75rem]"><img src={img["cat-beauty"]} alt="مجموعة مستوحاة من الجمال والعناية" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"/><div className="absolute bottom-0 p-7 text-white"><p className="text-xs font-bold text-white/80">العناية تبدأ من التفاصيل</p><h3 className="mt-2 font-display text-2xl font-extrabold">وقت لنفسك، كل يوم</h3></div></div>
     <div className="group relative min-h-[340px] overflow-hidden rounded-[1.75rem]"><img src={img["cat-home"]} alt="تفاصيل منزلية دافئة" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"/><div className="absolute bottom-0 p-7 text-white"><p className="text-xs font-bold text-white/80">بيت يشبهك</p><h3 className="mt-2 font-display text-2xl font-extrabold">مساحات لها روح</h3></div></div>
    </section>
   </>}
   <section id="collection" className="mx-auto max-w-7xl scroll-mt-32 px-4 pb-16 pt-20 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-end justify-between gap-5"><SectionIntro eyebrow={shopName} title={slug?"تفاصيل المنتج":searchOnly?"ابحثي في منتجات يومياتي":"منتجاتنا المعتمدة"} description={slug?undefined:"هنا ستجدين منتجات يومياتي بعد التحقق من الأسعار والمعلومات والتوافر. نعرض الحقيقة فقط، وليس كتالوجاً تجريبياً."}/>{!slug&&<label className="relative block w-full sm:w-auto"><Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"/><input className="field w-full pr-12 sm:w-72" value={term} onChange={e=>setTerm(e.target.value)} placeholder="ابحثي بين المنتجات" aria-label="بحث المنتجات المعتمدة"/></label>}</div>
    {!origin||!key?<EmptyProducts title="اختياراتنا في الطريق" message="نجهز مجموعاتنا ونستكمل ربط المتجر بمصادر المنتجات المعتمدة."/>
    :error?<div role="alert" className="mt-8 rounded-3xl border bg-card p-8 text-center"><h3 className="font-bold">تعذّر تحميل المنتجات في الوقت الحالي</h3><button type="button" className="btn-outline mt-4" onClick={()=>setAttempt(v=>v+1)}>إعادة المحاولة</button></div>
    :rows===null?<div role="status" aria-live="polite" className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">{Array.from({length:4},(_,i)=><div key={i} className="animate-pulse rounded-2xl border bg-card p-3"><div className="aspect-square rounded-xl bg-muted"/><div className="mt-3 h-4 w-3/4 rounded bg-muted"/><div className="mt-3 h-4 w-1/2 rounded bg-muted"/></div>)}</div>
    :slug?detail?<div className="mt-8 grid gap-8 rounded-[2rem] border bg-card p-5 shadow-soft sm:p-8 lg:grid-cols-2"><div className="grid aspect-square place-items-center rounded-[1.5rem] bg-muted"><Package className="h-20 w-20 text-primary/25" aria-hidden="true"/></div><div className="flex flex-col justify-center gap-5"><a href={path} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4 rotate-180"/>العودة إلى يومياتي</a><h2 className="font-display text-3xl font-extrabold leading-tight">{detail.title}</h2><p className="text-3xl font-extrabold text-primary">{formatListingPrice(detail,market)}</p><p className="whitespace-pre-line text-sm leading-8">{detail.description}</p><div className="rounded-xl bg-muted px-4 py-3 text-sm"><Check className="ml-2 inline h-4 w-4 text-primary"/>المنتج للمعاينة فقط؛ الطلبات غير مفعّلة.</div></div></div>
    :<EmptyProducts title="هذا المنتج غير متاح حالياً" message="قد تتغير حالة المنتجات بحسب اعتماد البيانات والتوافر."/>
    :matching.length?<div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{matching.map(item=><ShopCard key={item.listing_id} item={item} market={market}/>)}</div>
    :<EmptyProducts title={rows.length?"لم نجد منتجات مطابقة":"قريباً، اختيارات تستحق الانتظار"} message={rows.length?"جرّبي البحث بكلمة مختلفة.":"ما زلنا نراجع المنتجات ونجهّز المجموعة الأولى. ستظهر المنتجات هنا بعد اعتمادها."}/>}
   </section>
   {!slug&&!searchOnly&&<>
    <section className="bg-primary-soft"><div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><SectionIntro eyebrow="لماذا يومياتي؟" title="فكرة بسيطة… تجربة أجمل" description="تجربة مصممة لتجعل التصفح واضحاً، والاختيار أسهل عندما نفتح أبواب المتجر."/><div className="mt-8 grid gap-4 md:grid-cols-3">{values.map(({icon:Icon,title,description},i)=><div key={title} className="rounded-3xl border border-white/60 bg-card p-7"><span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Icon className="h-6 w-6"/></span><h3 className="mt-5 text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p></div>)}</div></div></section>
    <section id="questions" className="mx-auto grid max-w-7xl scroll-mt-32 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[.75fr_1.25fr] lg:px-8"><div><SectionIntro eyebrow="كل ما تحتاجين معرفته" title="أسئلة تتكرر كثيراً" description="نفضّل الإجابات الواضحة قبل بدء الطلبات. هذه هي حالة المتجر الآن."/><p className="mt-5 text-xs text-muted-foreground">سنحدّث الإجابات عندما تتوفر سياسات التشغيل المؤكدة لكل بلد.</p></div><div className="space-y-3">{questions.map((q,i)=><details key={q.question} className="group rounded-2xl border bg-card px-5 py-4" open={undefined}><summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 font-extrabold marker:hidden">{q.question}<ChevronDown className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden="true"/></summary><p className="pb-2 pt-3 text-sm leading-8 text-muted-foreground">{q.answer}</p></details>)}</div></section>
   </>}
  </main>
  <footer className="bg-foreground text-background"><div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.35fr_1fr_1fr] lg:px-8"><div><a href={path} className="font-display text-3xl font-extrabold">يومياتي<span className="text-gold">.</span></a><p className="mt-4 max-w-xs text-sm leading-8 text-white/70">من الإلهام إلى التفاصيل اليومية الجميلة. تجربة تسوّق عربية نعمل على تجهيزها بعناية.</p><span className="mt-4 inline-block rounded-full border border-white/20 px-4 py-2 text-xs text-white/80">معاينة قبل الإطلاق</span></div><nav aria-label="روابط المتجر"><h2 className="font-bold">استكشفي</h2><div className="mt-4 grid gap-3 text-sm text-white/70"><a href={path+"#discover"} className="hover:text-white">الأقسام</a><a href={path+"#collection"} className="hover:text-white">المنتجات</a><a href={path+"#story"} className="hover:text-white">حكايتنا</a><a href={path+"#questions"} className="hover:text-white">الأسئلة الشائعة</a></div></nav><nav aria-label="اختيار البلد"><h2 className="font-bold">بلدك</h2><div className="mt-4 grid grid-cols-2 gap-3 text-sm">{(Object.keys(names) as MarketCode[]).map(code=><a key={code} href={"/"+code} aria-current={code===market?"page":undefined} className={code===market?"font-extrabold text-white":"text-white/70 hover:text-white"}>{names[code]}</a>)}</div><p className="mt-5 text-xs text-white/60">العملة: {markets[market].currency}</p></nav></div><div className="border-t border-white/15 px-4 py-5 text-center text-xs text-white/60">© ٢٠٢٦ يومياتي · هذا الموقع للمعاينة فقط ولا يستقبل طلبات أو مدفوعات.</div></footer>
 </div>;
}
function EmptyProducts({title,message}:{title:string;message:string}){
 return <div role="status" className="mt-8 rounded-[2rem] border bg-card px-5 py-14 text-center shadow-soft sm:py-20"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary"><Heart className="h-8 w-8"/></span><h3 className="mt-5 font-display text-xl font-extrabold">{title}</h3><p className="mx-auto mt-3 max-w-md text-sm leading-8 text-muted-foreground">{message}</p></div>;
}
