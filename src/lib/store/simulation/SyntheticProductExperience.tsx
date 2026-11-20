/**
 * OWNER/TEST DEMO ONLY — never mount in public storefront routes.
 * All merchandise, stock, images and specifications below are synthetic.
 * There is intentionally no checkout or customer-facing purchase action.
 */
import {useMemo,useState} from "react";
import {ArrowLeft,ArrowRight,CheckCircle2,ImageOff,Package,Search,SlidersHorizontal} from "lucide-react";
import {markets,type MarketCode} from "../markets";
import {createSyntheticCatalog,type SimCategory,type SimProduct} from "./fixtures";
import {CATEGORY_TITLES,SIM_CATEGORIES,demoAvailability,demoListing,formatDemoMoney,type DemoSort,type DemoStockFilter} from "./product-experience";

const countryNames:Record<MarketCode,string>={sa:"السعودية",ae:"الإمارات",om:"عُمان",eg:"مصر",iq:"العراق"};
const labels=["الواجهة","من زاوية أخرى","التفاصيل"] as const;
const scenes=["bg-gradient-to-br from-amber-100 via-stone-100 to-emerald-100","bg-gradient-to-br from-sky-100 via-indigo-50 to-amber-100","bg-gradient-to-br from-rose-100 via-amber-50 to-teal-100"] as const;
function Illustration({name,index,compact=false}:{name:string;index:number;compact?:boolean}){
 return <div className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden ${scenes[index%scenes.length]}`} aria-label={name} role="img">
  <div className={`absolute -left-10 -top-10 rounded-full border-[16px] border-white/45 ${compact?"h-24 w-24":"h-56 w-56"}`}/>
  <div className={`absolute -bottom-16 -right-10 rotate-12 rounded-[3rem] bg-white/35 ${compact?"h-32 w-32":"h-60 w-60"}`}/>
  <Package aria-hidden="true" className={`relative text-primary/45 ${compact?"h-8 w-8":"h-20 w-20"}`} strokeWidth={1.3}/>
  {!compact&&<span className="relative mt-5 rounded-full bg-white/85 px-4 py-2 text-xs font-extrabold text-foreground">{name}</span>}
 </div>;
}
export function SyntheticProductExperience({initialMarket="sa"}:{initialMarket?:MarketCode}){
 const [market,setMarket]=useState<MarketCode>(initialMarket);
 const [search,setSearch]=useState("");
 const [category,setCategory]=useState<SimCategory|"all">("all");
 const [stock,setStock]=useState<DemoStockFilter>("all");
 const [sort,setSort]=useState<DemoSort>("recommended");
 const [page,setPage]=useState(1);
 const [selectedSku,setSelectedSku]=useState<string|null>(null);
 const [variantSku,setVariantSku]=useState("");
 const [imageIndex,setImageIndex]=useState(0);
 const all=useMemo(()=>createSyntheticCatalog(market),[market]);
 const result=useMemo(()=>demoListing({market,search,category,stock,sort,page,pageSize:9},all),[market,search,category,stock,sort,page,all]);
 const selected=all.find(x=>x.sku===selectedSku)??null;
 const chosenVariant=selected?selected.variants.find(v=>v.sku===variantSku)??selected.variants[0]:null;
 function resetFilters(){setSearch("");setCategory("all");setStock("all");setSort("recommended");setPage(1);}
 function changeMarket(next:MarketCode){setMarket(next);resetFilters();setSelectedSku(null);setVariantSku("");setImageIndex(0);}
 function openDetail(item:SimProduct){setSelectedSku(item.sku);setVariantSku(item.variants[0].sku);setImageIndex(0);}
 return <section dir="rtl" aria-label="تجربة المنتجات الاصطناعية" data-simulation-only="true" className="mx-auto max-w-7xl space-y-7 px-4 py-7 text-foreground sm:px-6 lg:px-8">
  <div className="rounded-[1.6rem] border-2 border-dashed border-amber-500/60 bg-amber-50 p-5 text-amber-950 sm:p-6">
   <div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-amber-900 px-3 py-1 text-xs font-extrabold text-white">DEMO · SIMULATION ONLY</span><span className="text-xs font-bold">بيانات اختبار فقط — ليست منتجات للبيع</span></div>
   <h1 className="mt-3 font-display text-2xl font-extrabold sm:text-3xl">مختبر تجربة منتجات يومياتي</h1>
   <p className="mt-2 max-w-2xl text-sm leading-7">تجربة داخلية لتطوير البحث والتصفية والخيارات والعرض. جميع الأسعار والمخزون والمواصفات والرسومات اصطناعية؛ لا توجد عمليات شراء أو تواصل مع مورّد.</p>
  </div>
  <div className="grid gap-4 rounded-[1.5rem] border bg-card p-4 sm:p-6 lg:grid-cols-[1fr_1fr_1fr]">
   <label className="text-xs font-bold">الدولة
    <select aria-label="دولة التجربة" className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm" value={market} onChange={e=>changeMarket(e.target.value as MarketCode)}>{(Object.keys(markets) as MarketCode[]).map(m=><option key={m} value={m}>{countryNames[m]} · {markets[m].currency}</option>)}</select>
   </label>
   <label className="text-xs font-bold lg:col-span-2">البحث في المنتجات التجريبية
    <span className="relative mt-2 block"><Search className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-muted-foreground" aria-hidden="true"/><input aria-label="بحث المنتجات التجريبية" type="search" placeholder="جرّبي: تنظيم، مطبخ، SIM-SA-001" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} className="min-h-11 w-full rounded-xl border bg-background pr-10 pl-3 text-sm"/></span>
   </label>
   <label className="text-xs font-bold">القسم
    <select aria-label="تصفية القسم" className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm" value={category} onChange={e=>{setCategory(e.target.value as SimCategory|"all");setPage(1)}}><option value="all">كل الأقسام</option>{SIM_CATEGORIES.map(c=><option value={c} key={c}>{CATEGORY_TITLES[c]}</option>)}</select>
   </label>
   <label className="text-xs font-bold">التوفر
    <select aria-label="تصفية المخزون" className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm" value={stock} onChange={e=>{setStock(e.target.value as DemoStockFilter);setPage(1)}}><option value="all">الكل</option><option value="available">متوفر افتراضياً</option><option value="unavailable">غير متوفر</option><option value="unknown">لم يتم التحقق</option></select>
   </label>
   <label className="text-xs font-bold">الترتيب
    <select aria-label="ترتيب المنتجات" className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm" value={sort} onChange={e=>{setSort(e.target.value as DemoSort);setPage(1)}}><option value="recommended">الترتيب الافتراضي</option><option value="price_asc">السعر: الأقل أولاً</option><option value="price_desc">السعر: الأعلى أولاً</option><option value="title">حسب الاسم</option></select>
   </label>
  </div>
  {selected?
   <div className="space-y-5">
    <button onClick={()=>{setSelectedSku(null);setVariantSku("");setImageIndex(0)}} className="inline-flex min-h-11 items-center gap-2 rounded-full border px-5 py-2 text-sm font-bold"><ArrowRight className="h-4 w-4" aria-hidden="true"/> العودة إلى نتائج التجربة</button>
    <article className="grid gap-8 rounded-[1.7rem] border bg-card p-4 sm:p-7 lg:grid-cols-2">
     <div className="space-y-3">
      <div className="aspect-square overflow-hidden rounded-[1.3rem] border"><Illustration name={labels[imageIndex]+" — رسم تجريبي وليس صورة للمنتج"} index={imageIndex}/></div>
      <div className="grid grid-cols-3 gap-3" role="group" aria-label="صور المنتج التجريبية">{labels.map((label,index)=><button type="button" key={label} aria-label={"عرض "+label} aria-pressed={imageIndex===index} onClick={()=>setImageIndex(index)} className={`overflow-hidden rounded-xl border-2 text-xs font-bold ${imageIndex===index?"border-primary":"border-transparent"}`}><div className="aspect-[4/3]"><Illustration name={label} index={index} compact/></div><span className="block py-2">{label}</span></button>)}</div>
     </div>
     <div className="flex flex-col gap-4">
      <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">منتج اصطناعي · ممنوع النشر</span>
      <h2 className="font-display text-2xl font-extrabold leading-snug">{selected.title}</h2>
      <p className="text-sm leading-7 text-muted-foreground">{selected.description}</p>
      <p className="text-2xl font-extrabold text-primary">{formatDemoMoney(market,selected.priceMinor)} <span className="text-xs font-normal text-muted-foreground">سعر تجريبي فقط</span></p>
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-extrabold">اختاري الخيار التجريبي</legend><div className="flex flex-wrap gap-2">{selected.variants.map(v=><button type="button" key={v.sku} aria-pressed={chosenVariant?.sku===v.sku} onClick={()=>setVariantSku(v.sku)} className={`min-h-11 rounded-full border px-4 py-2 text-sm font-bold ${chosenVariant?.sku===v.sku?"border-primary bg-primary text-primary-foreground":"bg-background"}`}>{v.label}</button>)}</div></fieldset>
      {chosenVariant&&<div role="status" className="rounded-xl bg-muted px-4 py-3 text-sm"><strong>حالة المخزون التجريبي:</strong> {chosenVariant.stock==="available"?"متوفر افتراضياً":chosenVariant.stock==="unknown"?"غير مؤكّد":"غير متوفر"} · {chosenVariant.sku}</div>}
      <div className="rounded-xl border p-4"><h3 className="mb-3 font-extrabold">مواصفات تجريبية</h3><dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-y-3 text-sm"><dt className="text-muted-foreground">القسم</dt><dd>{CATEGORY_TITLES[selected.category]}</dd><dt className="text-muted-foreground">الرمز</dt><dd className="break-all">{selected.sku}</dd><dt className="text-muted-foreground">العملة</dt><dd>{selected.currency}</dd><dt className="text-muted-foreground">المصدر</dt><dd>Fixture اصطناعي</dd></dl></div>
      <p className="inline-flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-xs leading-6 text-amber-950"><ImageOff className="mt-1 h-4 w-4 shrink-0" aria-hidden="true"/>هذه الواجهة للعرض الداخلي فقط. لا توجد صور فعلية أو مواصفات مزوّد أو إمكانية شراء.</p>
     </div>
    </article>
   </div>:
   <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-2xl font-extrabold">الاختيارات التجريبية</h2><p role="status" className="mt-2 text-sm text-muted-foreground">{result.total} نتيجة اصطناعية · {countryNames[market]}</p></div><button type="button" onClick={resetFilters} className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold"><SlidersHorizontal className="h-4 w-4" aria-hidden="true"/> مسح الفلاتر</button></div>
    {result.total===0?<div className="rounded-[1.5rem] border bg-card px-6 py-14 text-center"><Search className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true"/><h3 className="mt-4 font-bold">ما لقينا نتائج تجريبية مطابقة</h3><p className="mt-2 text-sm text-muted-foreground">جرّبي تغيير القسم أو كلمة البحث.</p><button onClick={resetFilters} className="mt-5 min-h-11 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">عرض جميع النتائج</button></div>:
     <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">{result.products.map(item=><article key={item.sku} className="overflow-hidden rounded-[1.3rem] border bg-card shadow-sm"><button type="button" aria-label={"عرض تفاصيل "+item.title} className="block w-full text-right" onClick={()=>openDetail(item)}><div className="relative aspect-[4/3]"><Illustration name="رسم تجريبي" index={SIM_CATEGORIES.indexOf(item.category)} compact/><span className="absolute right-2 top-2 rounded-full bg-amber-900 px-2 py-1 text-[10px] font-bold text-white">تجريبي</span></div><div className="space-y-2 p-3 sm:p-4"><h3 className="min-h-12 text-sm font-extrabold leading-6">{item.title}</h3><p className="text-base font-extrabold text-primary">{formatDemoMoney(market,item.priceMinor)}</p><p className="text-xs text-muted-foreground">{demoAvailability(item)==="available"?"متوفر افتراضياً":demoAvailability(item)==="unknown"?"غير مؤكّد":"غير متوفر"}</p><span className="inline-flex items-center gap-1 text-xs font-bold text-primary">التفاصيل <ArrowLeft className="h-3 w-3" aria-hidden="true"/></span></div></button></article>)}</div>}
    {result.pages>1&&<div className="flex items-center justify-center gap-4"><button type="button" aria-label="الصفحة السابقة" className="min-h-11 rounded-full border px-4 text-sm disabled:opacity-40" disabled={page===1} onClick={()=>setPage(n=>n-1)}>السابق</button><span className="text-sm">صفحة {page} من {result.pages}</span><button type="button" aria-label="الصفحة التالية" className="min-h-11 rounded-full border px-4 text-sm disabled:opacity-40" disabled={page>=result.pages} onClick={()=>setPage(n=>n+1)}>التالي</button></div>}
   </div>
  }
  <div className="flex flex-wrap items-center gap-2 border-t pt-5 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true"/> لا إرسال للطلبات · لا مشاركة بيانات · لا تكامل مع الموردين · لا نشر عام</div>
 </section>;
}
