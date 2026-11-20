import {ArrowLeft,ArrowRight,ShoppingBag,PackageSearch,ShieldCheck,Search} from "lucide-react";
import {StoreFrame} from "./StoreChrome";
import {ShoppingAssistant} from "./ShoppingAssistant";
import {img} from "@/lib/store/images";
import type {MarketCode} from "@/lib/store/markets";
import {marketExperience} from "@/lib/store/market-experience";
const content={
 cart:{eyebrow:"سلة يومياتي",title:"سلتك بانتظار اختياراتك",desc:"المنتجات المتاحة للطلب تعتمد على المخزون وطرق الدفع والتوصيل المعتمدة. حالياً تقدرين تكتشفين الأقسام والمجموعات من غير ما يتم إنشاء طلب.",image:img["cat-home"],alt:"أفكار منزلية دافئة",icon:ShoppingBag},
 checkout:{eyebrow:"إتمام الطلب",title:"الطلب يحتاج منتجات معتمدة",desc:"ما فيه منتجات جاهزة لإتمام الطلب في سلتك حالياً. عشان تكون التجربة واضحة وآمنة، ما نطلب أي معلومات شخصية أو دفعات قبل تفعيل طرق الشراء الموثوقة.",image:img["cat-kitchen"],alt:"تفاصيل ركن القهوة",icon:ShieldCheck},
 order:{eyebrow:"متابعة الطلب",title:"ما لقينا معلومات مؤكدة لهذا الطلب",desc:"ما نعرض حالة طلب إلا بعد التحقق من وصوله لنظام يومياتي. تأكدي من الرابط أو ارجعي للصفحة الرئيسية لاستكشاف المجموعات.",image:img["cat-organize"],alt:"مساحة منزلية مرتبة",icon:PackageSearch}
} as const;
export function StoreCommerceGuard({market,type}:{market:MarketCode;type:keyof typeof content}){
 const entry=content[type],Icon=entry.icon,path="/"+market;
 const experience=marketExperience[market];
 const checkoutNotice=market==="sa"?"عند تفعيل الطلبات سيكون الدفع عند الاستلام فقط. لا توجد مدفوعات أو طلبات مفعّلة حالياً.":market==="eg"?"الطلبات لسه مش متاحة؛ وقت التفعيل هيكون الدفع كاش عند الاستلام بس.":market==="iq"?"الطلبات مو مفعّلة هسه؛ الدفع كاش عند الاستلام فقط لما تتفعّل.":market==="ae"?"الطلبات مب مفعّلة للحين؛ الدفع عند الاستلام فقط يوم تبدأ الخدمة.":"الطلبات غير مفعّلة الآن؛ الدفع عند الاستلام فقط عندما تبدأ الخدمة.";
 const description=type==="checkout"?checkoutNotice:entry.desc;
 return <StoreFrame market={market}>
  <section className="mx-auto max-w-6xl px-4 pb-20 pt-7 sm:px-6 sm:pt-12 lg:px-8">
   <nav aria-label="مسار الصفحة" className="mb-6 text-sm text-muted-foreground"><a href={path} className="hover:text-primary">يومياتي</a> / {entry.eyebrow}</nav>
   <div className="grid overflow-hidden rounded-[2rem] border bg-card shadow-soft md:grid-cols-2">
    <img src={entry.image} alt={entry.alt} loading="lazy" className="h-64 w-full object-cover md:h-full md:min-h-[480px]"/>
    <div className="flex flex-col justify-center p-7 sm:p-12">
     <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary"><Icon className="h-7 w-7"/></span>
     <p className="text-sm font-extrabold text-primary">{entry.eyebrow}</p>
     <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-4xl">{entry.title}</h1>
     <p className="mt-5 text-sm leading-8 text-muted-foreground sm:text-base">{description}</p>
     <div className="mt-8 flex flex-wrap gap-3">
      <a href={path+"#discover"} className="btn-primary inline-flex min-h-12 items-center gap-2">{market==="sa"?"اكتشفي الأقسام":experience.discoverCta} <ArrowLeft className="h-4 w-4"/></a>
      <button type="button" onClick={()=>document.dispatchEvent(new CustomEvent("yawmiyati:open-search"))} className="btn-outline inline-flex min-h-12 items-center gap-2"><Search className="h-4 w-4"/> {market==="sa"?"ابحثي في يومياتي":experience.searchCta}</button>
     </div>
     <p className="mt-6 text-xs leading-6 text-muted-foreground">تظهر الأسعار ومعلومات المنتجات بعد اعتمادها، ولا نطلب أي بيانات دفع. <a href={path+"/info/shipping-returns"} className="font-bold text-primary underline underline-offset-2">اقرئي تفاصيل التوصيل والاسترجاع</a>.</p>
    </div>
   </div>
  </section>
  <ShoppingAssistant market={market} products={[]}/>
 </StoreFrame>;
}
