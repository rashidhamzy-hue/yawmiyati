import {useEffect,useState} from "react";
import {Search,ArrowLeft, Sparkles,ShieldCheck,Heart,Package,MapPin,Menu,X} from "lucide-react";
import {img} from "@/lib/store/images";
import {markets,type MarketCode} from "@/lib/store/markets";
import {fetchPublicCatalog,fetchPublicDetail,formatListingPrice,type PublicListing,type PublicDetail} from "@/lib/store/public-catalog";

const names:Record<MarketCode,string>={sa:"السعودية",ae:"الإمارات",om:"عُمان",eg:"مصر",iq:"العراق"};
const origins=import.meta.env.VITE_YAWMIYATI_SUPABASE_URL;
const publishableKey=import.meta.env.VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY;
const inspiration=[
 {name:"المنزل",picture:img["cat-home"]},
 {name:"المطبخ والقهوة",picture:img["cat-kitchen"]},
 {name:"الجمال",picture:img["cat-beauty"]},
 {name:"الأزياء",picture:img["cat-fashion"]},
 {name:"العناية",picture:img["cat-wellness"]},
 {name:"التنظيم",picture:img["cat-organize"]},
];

export function MarketPreview({market,slug}:{market:MarketCode;slug?:string}){
 const [rows,setRows]=useState<PublicListing[]|null>(null),[detail,setDetail]=useState<PublicDetail|null>(null);
 const [search,Q]=useState(""),[error,E]=useState(false),[attempt,A]=useState(0),[menu,M]=useState(false);
 useEffect(()=>{
  if(!origins||!publishableKey)return;
  let active=true;E(false);setRows(null);setDetail(null);
  (slug?fetchPublicDetail(origins,publishableKey,market,slug).then(d=>{if(active){setDetail(d);setRows([]);}}):fetchPublicCatalog(origins,publishableKey,market).then(r=>{if(active)setRows(r)})).catch(()=>{if(active)E(true)});
  return()=>{active=false};
 },[market,slug,attempt]);
 const available=rows?.filter(r=>r.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))??[];
 const listPath="/"+market;
 return <div dir="rtl" className="min-h-screen bg-background text-foreground">
  <div className="bg-primary px-4 py-2 text-center text-xs font-medium text-primary-foreground">يومياتي {names[market]} · معاينة التصميم قبل الإطلاق · الطلبات غير متاحة حالياً</div>
  <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
   <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
    <a href={listPath} className="font-display text-2xl font-extrabold tracking-tight text-primary">يومياتي</a>
    <span className="hidden items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground sm:flex"><MapPin className="h-3.5 w-3.5"/>{names[market]}</span>
    <nav className="mr-4 hidden gap-5 text-sm md:flex"><a href={listPath+"#discover"} className="hover:text-primary">استكشفي</a><a href={listPath+"#collection"} className="hover:text-primary">المنتجات</a><a href={listPath+"#about"} className="hover:text-primary">عن يومياتي</a></nav>
    <div className="mr-auto flex items-center gap-3"><span className="rounded-full border px-3 py-1 text-xs">{markets[market].currency}</span><button type="button" onClick={()=>M(v=>!v)} className="tap rounded-full border px-3 md:hidden" aria-label="القائمة" aria-expanded={menu}>{menu?<X className="h-5 w-5"/>:<Menu className="h-5 w-5"/>}</button></div>
   </div>
   {menu&&<nav className="flex gap-5 border-t px-4 py-3 text-sm md:hidden"><a href={listPath+"#discover"} onClick={()=>M(false)}>استكشفي</a><a href={listPath+"#collection"} onClick={()=>M(false)}>المنتجات</a><a href={listPath+"#about"} onClick={()=>M(false)}>عن يومياتي</a></nav>}
  </header>
  <main>
   {!slug&&<><section className="mx-auto max-w-6xl px-4 pt-5"><div className="relative overflow-hidden rounded-3xl">
     <img src={img.hero} alt="ركن منزلي أنيق" width={1600} height={900} className="h-[420px] w-full object-cover md:h-[520px]"/>
     <div className="absolute inset-0 bg-hero-fade"/>
     <div className="absolute inset-y-0 right-0 flex max-w-md flex-col justify-center gap-4 p-6 text-background md:p-12">
      <span className="flex w-fit items-center gap-1.5 rounded-full bg-background/20 px-3 py-1 text-xs backdrop-blur"><Sparkles className="h-3.5 w-3.5"/> اختيارات تُلهم يومك</span>
      <h1 className="font-display text-4xl font-extrabold leading-tight md:text-5xl">اجعلي يومك أسهل… وأجمل</h1>
      <p className="max-w-sm text-base opacity-95">عالم من الأفكار للبيت والجمال واللحظات الصغيرة. نجهز مجموعاتنا لتناسب يومك.</p>
      <a href={listPath+"#discover"} className="btn-primary w-fit">استكشفي يومياتي <ArrowLeft className="h-4 w-4"/></a>
     </div>
    </div></section>
    <section id="discover" className="mx-auto max-w-6xl scroll-mt-28 px-4 pt-12">
     <div className="flex items-end justify-between gap-3"><h2 className="font-display text-2xl font-bold">اكتشفي عالم يومياتي</h2><span className="text-xs text-muted-foreground">إلهام لأقسام قادمة</span></div>
     <div className="mt-5 grid grid-cols-3 gap-3 md:grid-cols-6">{inspiration.map(c=><div key={c.name} className="group text-center">
      <div className="aspect-square overflow-hidden rounded-2xl bg-muted"><img src={c.picture} alt={c.name} width={300} height={300} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/></div>
      <p className="mt-2 text-sm font-medium">{c.name}</p></div>)}</div>
    </section>
    <section className="mx-auto max-w-6xl px-4 pt-14"><div className="grid items-center gap-6 overflow-hidden rounded-3xl bg-accent md:grid-cols-2">
      <img src={img["cat-kitchen"]} alt="أفكار للمطبخ والقهوة" loading="lazy" className="aspect-[4/3] w-full object-cover"/>
      <div className="space-y-4 p-6 md:p-10"><span className="text-sm font-bold text-primary">لحظات تستحق العناية</span><h2 className="font-display text-3xl font-extrabold">تفاصيل صغيرة، فرق كبير</h2><p className="text-sm leading-7 text-accent-foreground">من ركن القهوة إلى تفاصيل المنزل، نختار أفكاراً تناسب أسلوب حياتك.</p><a href={listPath+"#collection"} className="btn-outline w-fit">تعرّفي على المجموعة <ArrowLeft className="h-4 w-4"/></a></div>
    </div></section></>}
   <section id="collection" className="mx-auto max-w-6xl scroll-mt-28 px-4 pb-14 pt-14">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><span className="text-xs font-bold text-primary">يومياتي {names[market]}</span><h2 className="font-display text-2xl font-bold">{slug?"تفاصيل المنتج":"المنتجات المعتمدة"}</h2></div>{!slug&&<label className="relative block"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><input className="w-64 max-w-full rounded-full border bg-card py-3 pl-4 pr-10 text-sm" value={search} onChange={e=>Q(e.target.value)} placeholder="ابحثي عن منتج" aria-label="بحث المنتجات"/></label>}</div>
    {!origins||!publishableKey?<div role="status" className="mt-5 rounded-2xl border bg-card p-8 text-center"><Package className="mx-auto h-8 w-8 text-primary"/><h3 className="mt-3 font-bold">مجموعاتنا في التحضير</h3><p className="mt-2 text-sm text-muted-foreground">نجهّز المنتجات ونتحقق من تفاصيلها قبل عرضها.</p></div>
     :error?<div role="alert" className="mt-5 rounded-2xl border bg-card p-8 text-center"><p>تعذّر تحميل المنتجات المعتمدة.</p><button className="btn-outline mt-4" onClick={()=>A(i=>i+1)}>إعادة المحاولة</button></div>
     :rows===null?<p role="status" className="mt-5 rounded-2xl bg-muted p-7">جاري التحقق من المنتجات...</p>
     :slug?detail?<article className="mt-5 grid gap-8 rounded-3xl bg-card p-6 shadow-soft md:grid-cols-2">
       <div className="grid aspect-square place-items-center rounded-2xl bg-muted"><Package className="h-16 w-16 text-primary/40"/></div>
       <div className="space-y-5"><h3 className="font-display text-3xl font-bold">{detail.title}</h3><p className="text-2xl font-bold text-primary">{formatListingPrice(detail,market)}</p><p className="whitespace-pre-line leading-8">{detail.description}</p><p className="rounded-xl bg-muted p-3 text-sm">الطلب غير متاح في نسخة المعاينة.</p><a href={listPath} className="btn-outline">العودة إلى المتجر</a></div>
      </article>:<p className="mt-5 rounded-2xl bg-muted p-8">هذا المنتج غير متاح حالياً.</p>
     :available.length===0?<div className="mt-5 rounded-2xl border bg-card p-10 text-center shadow-soft"><Heart className="mx-auto h-9 w-9 text-primary"/><h3 className="mt-3 font-display text-xl font-bold">نختار لكِ بعناية</h3><p className="mt-2 text-sm text-muted-foreground">{rows.length===0?"لا توجد منتجات معتمدة للعرض بعد. سنعرضها بعد اكتمال التحقق.":"لا توجد نتائج مطابقة لبحثك حالياً."}</p></div>
     :<div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">{available.map(r=><article key={r.listing_id} className="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-soft"><a href={listPath+"/p/"+encodeURIComponent(r.slug)} className="grid aspect-square place-items-center bg-muted"><Package className="h-12 w-12 text-primary/40"/></a><div className="flex flex-1 flex-col gap-2 p-4"><a href={listPath+"/p/"+encodeURIComponent(r.slug)} className="font-semibold leading-snug group-hover:text-primary">{r.title}</a><p className="mt-auto font-bold text-primary">{formatListingPrice(r,market)}</p><span className="text-xs text-muted-foreground">معاينة المنتج فقط</span></div></article>)}</div>}
   </section>
   <section id="about" className="bg-primary-soft"><div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:grid-cols-3">{[
    [Heart,"مختارات بعناية","نهتم بالتفاصيل قبل إضافة أي منتج"],
    [ShieldCheck,"معلومات موثوقة","لا نعرض منتجاً قبل اعتماده"],
    [Sparkles,"تجربة عربية","واجهة بسيطة تتناسب مع يومك"]
    ].map(([Icon,t,d])=>{const IconComponent=Icon as typeof Heart;return <div key={t as string} className="text-center"><IconComponent className="mx-auto h-7 w-7 text-primary"/><h3 className="mt-2 font-bold">{t as string}</h3><p className="mt-1 text-sm text-muted-foreground">{d as string}</p></div>})}</div></section>
  </main>
  <footer className="border-t bg-secondary"><div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-2"><div><p className="font-display text-2xl font-extrabold text-primary">يومياتي</p><p className="mt-2 text-sm text-muted-foreground">أسلوب حياة أسهل وأجمل، خطوة بخطوة.</p></div><div><p className="font-bold">البلد</p><nav className="mt-3 flex flex-wrap gap-3 text-sm">{(Object.keys(names) as MarketCode[]).map(code=><a key={code} href={"/"+code} className={"hover:text-primary "+(code===market?"font-bold text-primary":"text-muted-foreground")}>{names[code]}</a>)}</nav></div></div><p className="border-t py-4 text-center text-xs text-muted-foreground">© ٢٠٢٦ يومياتي · معاينة التصميم · غير متاح للشراء</p></footer>
 </div>;
}
