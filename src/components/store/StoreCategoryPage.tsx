import {StoreFrame} from "./StoreChrome";
import {ShoppingAssistant} from "./ShoppingAssistantDeferred";
import {ApprovedCategoryProductGrid} from "./ApprovedCategoryProductGrid";
import {img} from "@/lib/store/images";
import {editorialSrcSet} from "@/lib/store/editorial-srcset";
import {marketExperience} from "@/lib/store/market-experience";
import type {MarketCode} from "@/lib/store/markets";
import {ArrowLeft,Search,Sparkles} from "lucide-react";
import {preload} from "react-dom";
export const EDITORIAL_CATEGORIES=[
 {slug:"home",title:"المنزل والديكور",subtitle:"تفاصيل تجعل مساحاتك أكثر دفئاً",image:img["cat-home"]},
 {slug:"kitchen",title:"المطبخ والقهوة",subtitle:"أفكار لأوقات القهوة والمطبخ",image:img["cat-kitchen"]},
 {slug:"beauty",title:"الجمال والعناية",subtitle:"لحظات صغيرة تعتنين فيها بنفسك",image:img["cat-beauty"]},
 {slug:"fashion",title:"الأزياء والإكسسوارات",subtitle:"لمسات تعكس أسلوبك",image:img["cat-fashion"]},
 {slug:"wellness",title:"الراحة والرفاهية",subtitle:"مساحتك الهادئة وسط تفاصيل اليوم",image:img["cat-wellness"]},
 {slug:"organize",title:"التنظيم الذكي",subtitle:"حلول وأفكار لمساحات مرتبة",image:img["cat-organize"]},
] as const;
const categoryUi:Record<MarketCode,{eyebrow:string;search:string;sectionEyebrow:string;sectionTitle:string;sectionDescription:string}>={
 sa:{eyebrow:"اكتشفي عالم يومياتي",search:"ابحثي بين المنتجات",sectionEyebrow:"تفاصيل تلهمك",sectionTitle:"اكتشفي ما يناسب يومك",sectionDescription:"تصفّحي أفكار هذا القسم وباقي اختيارات يومياتي. لو في بالك منتج معيّن، ابحثي عنه وشوفي تفاصيله المتاحة."},
 ae:{eyebrow:"اكتشفي عالمج",search:"دوّري بين المنتجات",sectionEyebrow:"تفاصيل على ذوقج",sectionTitle:"اختيارات تكمل يومج",sectionDescription:"لفّي على أفكار هالقسم وباقي اختيارات يومياتي. إذا في بالج منتج، دوّري عليه وشوفي التفاصيل المتاحة."},
 om:{eyebrow:"تفاصيل تناسب يومك",search:"ابحثي بين المنتجات",sectionEyebrow:"أفكار قريبة منك",sectionTitle:"اختيارات تناسب أسلوبك",sectionDescription:"استكشفي أفكار هذا القسم وبقية الأقسام. وإذا تبحثين عن منتج محدد، استخدمي البحث للاطلاع على تفاصيله المتاحة."},
 eg:{eyebrow:"اتفرّجي على يومياتي",search:"دوري على المنتجات",sectionEyebrow:"حاجات ممكن تعجبك",sectionTitle:"شوفي اللي يناسب يومك",sectionDescription:"اتفرّجي على أفكار القسم وباقي اختيارات يومياتي. لو بتدوري على حاجة معينة، استخدمي البحث وشوفي تفاصيلها المتاحة."},
 iq:{eyebrow:"اكتشفي يومياتچ",search:"دوّري على المنتجات",sectionEyebrow:"تفاصيل على ذوقچ",sectionTitle:"شوفي اللي يناسب يومچ",sectionDescription:"لفّي على أفكار هالقسم وبقية اختيارات يومياتي. وإذا ببالچ منتج معيّن، دوّري عليه وشوفي تفاصيله المتاحة."},
};
export function StoreCategoryPage({market,slug}:{market:MarketCode;slug:string}){
 const category=EDITORIAL_CATEGORIES.find(x=>x.slug===slug);
 if(!category)return <StoreFrame market={market}><section className="mx-auto max-w-5xl px-4 py-16"><h1 className="font-display text-3xl font-bold">القسم غير موجود</h1><a className="btn-outline mt-6" href={"/"+market}>العودة إلى يومياتي</a></section></StoreFrame>;
 // React 19 hoists this into <head> during SSR, so the LCP photo starts downloading
 // while the HTML is still being parsed (the category hero had no preload before).
 const heroSrcSet=editorialSrcSet(category.image);
 preload(category.image,{as:"image",fetchPriority:"high",...(heroSrcSet?{imageSrcSet:heroSrcSet,imageSizes:"(min-width: 1280px) 1216px, calc(100vw - 2rem)"}:{})});
 return <StoreFrame market={market}>
  <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
   <nav aria-label="مسار الصفحة" className="mb-3 text-sm text-muted-foreground"><a href={"/"+market} className="hover:text-primary">يومياتي</a> / {category.title}</nav>
   <section className="relative isolate flex min-h-[170px] items-center overflow-hidden rounded-2xl bg-foreground sm:min-h-[230px]">
    <img src={category.image} srcSet={heroSrcSet} sizes="(min-width: 1280px) 1216px, calc(100vw - 2rem)" alt={category.title} className="absolute inset-0 h-full w-full object-cover" fetchPriority="high"/>
    <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/45 to-black/10"/>
    <div className="relative max-w-xl px-5 py-5 text-white sm:px-8 sm:py-8"><p className="mb-1 inline-flex items-center gap-2 text-xs font-bold"><Sparkles className="h-4 w-4"/> {categoryUi[market].eyebrow}</p>
      <h1 className="font-display text-2xl font-extrabold leading-tight sm:text-4xl">{category.title}</h1><p className="mt-1 text-sm leading-6 text-white/90">{marketExperience[market].categoryCaptions[slug]??category.subtitle}</p>
      <button type="button" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-foreground transition-colors hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" onClick={()=>document.dispatchEvent(new CustomEvent("yawmiyati:open-search"))}><Search className="h-4 w-4"/> {categoryUi[market].search}</button>
    </div>
   </section>
   <nav aria-label="تبديل الأقسام" className="mt-4 flex gap-2 overflow-x-auto pb-2">
    <a href={"/"+market+"/search"} className="inline-flex min-h-11 shrink-0 items-center rounded-full border bg-card px-4 text-xs font-bold">كل المنتجات</a>
    {EDITORIAL_CATEGORIES.map(c=><a key={c.slug} href={"/"+market+"/c/"+c.slug} aria-current={c.slug===slug?"page":undefined} className={"inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-xs font-bold "+(c.slug===slug?"border-primary bg-primary text-primary-foreground":"bg-card text-foreground")}>{c.title}</a>)}
   </nav>
   <ApprovedCategoryProductGrid market={market} slug={category.slug} categoryTitle={category.title}/>
   <section aria-label="أقسام أخرى" className="mt-12 grid gap-7 lg:grid-cols-[1fr_1.1fr]"><div><p className="text-xs font-extrabold text-primary">{categoryUi[market].sectionEyebrow}</p><h2 className="mt-2 font-display text-3xl font-bold">{categoryUi[market].sectionTitle}</h2><p className="mt-4 text-sm leading-8 text-muted-foreground">{categoryUi[market].sectionDescription}</p></div>
    <div className="grid grid-cols-2 gap-3">{EDITORIAL_CATEGORIES.filter(x=>x.slug!==slug).slice(0,4).map(x=><a key={x.slug} href={"/"+market+"/c/"+x.slug} className="group overflow-hidden rounded-2xl border bg-card"><img src={x.image} srcSet={editorialSrcSet(x.image)} sizes="(min-width: 1024px) 220px, 45vw" alt="" loading="lazy" decoding="async" width={360} height={270} className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-105"/><div className="flex items-center justify-between gap-2 p-3 text-xs font-bold">{x.title}<ArrowLeft className="h-4 w-4 text-primary"/></div></a>)}</div></section>
  </div>
  <ShoppingAssistant market={market} products={[]}/>
 </StoreFrame>;
}
