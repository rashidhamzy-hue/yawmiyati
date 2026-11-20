import {ArrowLeft,Clock3,HandCoins,ShieldCheck} from "lucide-react";
import type {MarketCode} from "@/lib/store/markets";

/**
 * Editorial prelaunch guidance only. Does not certify enabled checkout,
 * serviceability, stock, courier terms or statutory returns.
 */
type NonSaudiMarket=Exclude<MarketCode,"sa">;
const highlights:Record<NonSaudiMarket,{
 eyebrow:string;title:string;intro:string;
 cards:readonly {title:string;body:string}[];
 link:string;
}>={
 ae:{eyebrow:"من البداية… كل شيء واضح",title:"على ذوقج، وبخطوات واضحة",intro:"الدفع عند الاستلام هو الخيار المخطّط يوم نفتح الطلبات. شوفي التفاصيل التشغيلية قبل تختارين.",cards:[
  {title:"الدفع عند الاستلام",body:"بس بعد تفعيل الشراء، بدون دفع إلكتروني"},
  {title:"١٩ درهماً للشحن",body:"رسوم مرجعية لكل الإمارات وفق المعلومات المقدّمة"},
  {title:"٢٤–٤٨ ساعة",body:"تقدير توصيل غير مضمون بعد التأكيد والتجهيز"},
 ],link:"تفاصيل التوصيل والاسترجاع"},
 om:{eyebrow:"الوضوح يريح البال",title:"الدفع واضح، والتفاصيل قدّامك",intro:"عند تشغيل الطلبات، الدفع يكون نقداً عند الاستلام فقط. لا نعلن مدة توصيل غير معتمدة.",cards:[
  {title:"نقداً عند الاستلام",body:"الخيار الوحيد المخطط بعد التشغيل"},
  {title:"٣ ريالات عُمانية",body:"رسوم شحن مرجعية لجميع مناطق السلطنة"},
  {title:"الشروط قبل الطلب",body:"الاسترجاع للعيب أو عدم المطابقة بحسب الإجراء المُراجع"},
 ],link:"اقرئي التوصيل والاسترجاع"},
 eg:{eyebrow:"عشان تطلبي وإنتِ مطمّنة",title:"كاش عند الاستلام… ومن غير مفاجآت",intro:"الطلبات لسه مش مفعّلة، ولما نفتحها هتظهر تكلفة المنتج والشحن قبل ما تأكدي.",cards:[
  {title:"كاش عند الاستلام",body:"طريقة الدفع الوحيدة المخطط ليها"},
  {title:"الشحن حسب المحافظة",body:"الرسوم النهائية لسه تحت التحقق، ومش هنخمنها"},
  {title:"التوصيل حسب المنطقة",body:"التقديرات تبدأ بعد تأكيد الطلب وتجهيزه"},
 ],link:"اعرفي تفاصيل الشحن والمرتجعات"},
 iq:{eyebrow:"تفاصيل الطلب واضحة",title:"كاش عند الاستلام… والباقي ينوضح إلچ",intro:"حالياً ماكو طلبات مفعّلة. وقت التشغيل راح يظهر المجموع النهائي والتوصيل قبل تأكيد الطلب.",cards:[
  {title:"كاش عند الاستلام",body:"الخيار الوحيد المخطّط بعد تفعيل الطلبات"},
  {title:"٧٬٠٠٠ دينار للشحن",body:"رسم مرجعي موحّد وفق المعلومات المقدّمة"},
  {title:"استرجاع موضّح",body:"التفاصيل قيد المراجعة بسبب اختلاف مدد المصدر"},
 ],link:"شوفي تفاصيل الشحن والاسترجاع"},
};
export function MarketPromiseStrip({market}:{market:NonSaudiMarket}){
 const info=highlights[market];
 return <section aria-label={"تفاصيل التسوق في "+market} className="mx-auto max-w-7xl px-4 pt-9 sm:px-6 lg:px-8">
  <div className="overflow-hidden rounded-[1.8rem] border border-primary/15 bg-primary-soft p-5 sm:p-8">
   <div className="flex flex-wrap items-end justify-between gap-4">
    <div className="max-w-2xl"><p className="text-xs font-extrabold text-primary">{info.eyebrow}</p><h2 className="mt-2 font-display text-2xl font-extrabold leading-tight sm:text-3xl">{info.title}</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{info.intro}</p></div>
    <a href={"/"+market+"/info/shipping-returns"} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground">{info.link}<ArrowLeft className="h-4 w-4" aria-hidden="true"/></a>
   </div>
   <div className="mt-6 grid gap-3 sm:grid-cols-3">
    {info.cards.map((item,i)=>{const Icon=i===0?HandCoins:i===1?Clock3:ShieldCheck;return <div key={item.title} className={"rounded-2xl bg-card px-5 py-5 shadow-sm "+(market==="eg"?"border-b-4 border-primary/35":market==="iq"?"border-r-4 border-gold":"border border-border/70")}>
      <Icon className="h-6 w-6 text-primary" aria-hidden="true"/><h3 className="mt-3 text-base font-extrabold">{item.title}</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">{item.body}</p>
    </div>;})}
   </div>
  </div>
 </section>;
}
