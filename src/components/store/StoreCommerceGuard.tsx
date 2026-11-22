import {ArrowLeft,ArrowRight,ShoppingBag,PackageSearch,ShieldCheck,Search} from "lucide-react";
import {StoreFrame} from "./StoreChrome";
import {ShoppingAssistant} from "./ShoppingAssistant";
import {img} from "@/lib/store/images";
import type {MarketCode} from "@/lib/store/markets";
import {marketExperience} from "@/lib/store/market-experience";
import {customerServiceCopy} from "@/lib/store/customer-service-copy";
const content={
 cart:{eyebrow:"سلة يومياتي",title:"سلتك بانتظار اختياراتك",desc:"تصفّحي الأقسام واختاري المنتجات اللي تناسبك. تظهر خيارات الطلب للمنتجات القابلة للشراء فقط.",image:img["cat-home"],alt:"أفكار منزلية دافئة",icon:ShoppingBag},
 checkout:{eyebrow:"إتمام الطلب",title:"راجعي تفاصيل سلتك",desc:"لا توجد منتجات قابلة لإتمام الطلب في هذه السلة. لا نطلب معلومات الدفع أو العنوان قبل توفر طلب صالح.",image:img["cat-kitchen"],alt:"تفاصيل ركن القهوة",icon:ShieldCheck},
 order:{eyebrow:"متابعة الطلب",title:"لا توجد بيانات لهذا الطلب",desc:"تظهر حالة الطلب عند إدخال رقم طلب مسجّل وصحيح. تأكدي من الرابط ورقم الطلب.",image:img["cat-organize"],alt:"مساحة منزلية مرتبة",icon:PackageSearch}
} as const;
const titles={
 sa:{cart:"سلتك فاضية… خلّينا نملأها بذوقك",checkout:"لا توجد منتجات جاهزة لإتمام الطلب",order:"ما لقينا بيانات لهذا الطلب"},
 ae:{cart:"سلتج بانتظار اختياراتج",checkout:"ما في منتجات جاهزة لإتمام الطلب",order:"ما لقينا بيانات الطلب"},
 om:{cart:"سلتك بانتظار اختياراتك",checkout:"لا توجد منتجات جاهزة للطلب",order:"لا توجد بيانات لهذا الطلب"},
 eg:{cart:"سلتك مستنية اختياراتك",checkout:"السلة مافيهاش منتجات جاهزة للطلب",order:"مش لاقيين بيانات الطلب"},
 iq:{cart:"سلتچ تنتظر اختياراتچ",checkout:"السلة ما بيها منتجات جاهزة للطلب",order:"ما لكينا بيانات الطلب"}
} as const;
export function StoreCommerceGuard({market,type}:{market:MarketCode;type:keyof typeof content}){
 const entry=content[type],Icon=entry.icon,path="/"+market;
 const copy=customerServiceCopy[market];
 return <StoreFrame market={market}>
  <section className="mx-auto max-w-6xl px-4 pb-20 pt-7 sm:px-6 sm:pt-12 lg:px-8">
   <nav aria-label="مسار الصفحة" className="mb-6 text-sm text-muted-foreground"><a href={path} className="hover:text-primary">يومياتي</a> / {entry.eyebrow}</nav>
   <div className="grid overflow-hidden rounded-[2rem] border bg-card shadow-soft md:grid-cols-2">
    <img src={entry.image} alt={entry.alt} loading="lazy" className="h-64 w-full object-cover md:h-full md:min-h-[480px]"/>
    <div className="flex flex-col justify-center p-7 sm:p-12">
     <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary"><Icon className="h-7 w-7"/></span>
     <p className="text-sm font-extrabold text-primary">{entry.eyebrow}</p>
     <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-4xl">{titles[market][type]??entry.title}</h1>
     <p className="mt-5 text-sm leading-8 text-muted-foreground sm:text-base">{type==="order"?copy.tracking:copy.preCheckoutNotice}</p>
     {type!=="order"&&<p className="mt-2 text-sm">{copy.payment}</p>}
     <div className="mt-8 flex flex-wrap gap-3">
      <a href={path+"#discover"} className="btn-primary inline-flex min-h-12 items-center gap-2">{market==="sa"?"اكتشفي الأقسام":marketExperience[market].discoverCta} <ArrowLeft className="h-4 w-4"/></a>
      <button type="button" onClick={()=>document.dispatchEvent(new CustomEvent("yawmiyati:open-search"))} className="btn-outline inline-flex min-h-12 items-center gap-2"><Search className="h-4 w-4"/> {market==="sa"?"ابحثي في يومياتي":marketExperience[market].searchCta}</button>
     </div>
     <p className="mt-6 text-xs leading-6 text-muted-foreground">{market==="sa"?"تصفّحي الأقسام واختاري ما يناسب ذوقك. ": "تصفّحي الأقسام واختاري ما يناسب ذوقك. "}<a href={path+"/info/shipping-returns"} className="font-bold text-primary underline underline-offset-2">تفاصيل الدفع والشحن والاسترجاع</a></p>
    </div>
   </div>
  </section>
  <ShoppingAssistant market={market} products={[]}/>
 </StoreFrame>;
}
