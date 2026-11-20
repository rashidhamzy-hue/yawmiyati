import {StoreFrame} from "./StoreChrome";
import {ShoppingAssistant} from "./ShoppingAssistant";
import {img} from "@/lib/store/images";
import {marketExperience} from "@/lib/store/market-experience";
import type {MarketCode} from "@/lib/store/markets";
import {ArrowLeft,Search,Sparkles} from "lucide-react";
export const EDITORIAL_CATEGORIES=[
 {slug:"home",title:"المنزل والديكور",subtitle:"تفاصيل تجعل مساحاتك أكثر دفئاً",image:img["cat-home"]},
 {slug:"kitchen",title:"المطبخ والقهوة",subtitle:"أفكار لأوقات القهوة والمطبخ",image:img["cat-kitchen"]},
 {slug:"beauty",title:"الجمال والعناية",subtitle:"لحظات صغيرة تعتنين فيها بنفسك",image:img["cat-beauty"]},
 {slug:"fashion",title:"الأزياء والإكسسوارات",subtitle:"لمسات تعكس أسلوبك",image:img["cat-fashion"]},
 {slug:"wellness",title:"الراحة والرفاهية",subtitle:"مساحتك الهادئة وسط تفاصيل اليوم",image:img["cat-wellness"]},
 {slug:"organize",title:"التنظيم الذكي",subtitle:"حلول وأفكار لمساحات مرتبة",image:img["cat-organize"]},
] as const;
export function StoreCategoryPage({market,slug}:{market:MarketCode;slug:string}){
 const category=EDITORIAL_CATEGORIES.find(x=>x.slug===slug);
 if(!category)return <StoreFrame market={market}><section className="mx-auto max-w-5xl px-4 py-16"><h1 className="font-display text-3xl font-bold">القسم غير موجود</h1><a className="btn-outline mt-6" href={"/"+market}>العودة إلى يومياتي</a></section></StoreFrame>;
 return <StoreFrame market={market}>
  <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
   <nav aria-label="مسار الصفحة" className="mb-6 text-sm text-muted-foreground"><a href={"/"+market} className="hover:text-primary">يومياتي</a> / {category.title}</nav>
   <section className="relative isolate flex min-h-[340px] items-center overflow-hidden rounded-[2rem] bg-foreground sm:min-h-[430px]">
    <img src={category.image} alt={category.title} className="absolute inset-0 h-full w-full object-cover" fetchPriority="high"/>
    <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/45 to-black/10"/>
    <div className="relative max-w-xl px-7 py-12 text-white sm:px-12"><p className="mb-4 inline-flex items-center gap-2 text-xs font-bold"><Sparkles className="h-4 w-4"/> {market==="eg"?"اكتشفي عالم يومياتي":market==="iq"?"اكتشفي يومياتچ":market==="ae"?"اكتشفي عالمج":market==="om"?"اكتشفي ما يناسبك":"اكتشفي عالم يومياتي"}</p>
      <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-5xl">{category.title}</h1><p className="mt-5 text-base leading-8 text-white/90">{marketExperience[market].categoryCaptions[slug]??category.subtitle}</p>
      <button type="button" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-foreground transition-colors hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" onClick={()=>document.dispatchEvent(new CustomEvent("yawmiyati:open-search"))}><Search className="h-4 w-4"/> ابحثي بين المنتجات</button>
    </div>
   </section>
   <section className="mt-12 grid gap-7 lg:grid-cols-[1fr_1.1fr]"><div><p className="text-xs font-extrabold text-primary">تفاصيل تلهمك</p><h2 className="mt-2 font-display text-3xl font-bold">اكتشفي ما يناسب يومك</h2><p className="mt-4 text-sm leading-8 text-muted-foreground">تجدين في يومياتي أفكاراً وصوراً تلهمك، بينما تُعرض المنتجات الفعلية فقط بمعلومات معتمدة. البحث يعرض المنتجات المتاحة على مستوى المتجر، ولا يدّعي تصنيف منتجات لم يتم التحقق من فئتها.</p></div>
    <div className="grid grid-cols-2 gap-3">{EDITORIAL_CATEGORIES.filter(x=>x.slug!==slug).slice(0,4).map(x=><a key={x.slug} href={"/"+market+"/c/"+x.slug} className="group overflow-hidden rounded-2xl border bg-card"><img src={x.image} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-105"/><div className="flex items-center justify-between gap-2 p-3 text-xs font-bold">{x.title}<ArrowLeft className="h-4 w-4 text-primary"/></div></a>)}</div></section>
  </div>
  <ShoppingAssistant market={market} products={[]}/>
 </StoreFrame>;
}
