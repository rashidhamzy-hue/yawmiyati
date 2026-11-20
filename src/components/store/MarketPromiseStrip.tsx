import {ArrowLeft,Clock3,HandCoins,ShieldCheck} from "lucide-react";
import type {MarketCode} from "@/lib/store/markets";

/**
 * Editorial customer copy, grounded in owner-provided market policies. Does not certify enabled checkout,
 * serviceability, stock, courier terms or statutory returns.
 */
type NonSaudiMarket=Exclude<MarketCode,"sa">;
const highlights:Record<NonSaudiMarket,{
 eyebrow:string;title:string;intro:string;
 cards:readonly {title:string;body:string}[];
 link:string;
}>={
 ae:{eyebrow:"من البداية… كل شيء واضح",title:"على ذوقج، وبخطوات واضحة",intro:"الدفع كاش عند الاستلام، وشحن واضح لكل الإمارات. اكتشفي التفاصيل قبل تأكيد طلبج.",cards:[
  {title:"الدفع عند الاستلام",body:"بدون بطاقات أو دفع إلكتروني"},
  {title:"١٩ درهماً للشحن",body:"رسوم الشحن لجميع الإمارات"},
  {title:"٢٤–٤٨ ساعة",body:"مدة تقديرية بعد التأكيد والتجهيز"},
 ],link:"تفاصيل التوصيل والاسترجاع"},
 om:{eyebrow:"الوضوح يريح البال",title:"الدفع واضح، والتفاصيل قدّامك",intro:"الدفع النقدي عند الاستلام ورسوم شحن واضحة؛ كل تفصيل يساعدك تختارين براحة.",cards:[
  {title:"نقداً عند الاستلام",body:"بدون دفع مسبق أو بطاقات"},
  {title:"٣ ريالات عُمانية",body:"رسوم الشحن لجميع مناطق السلطنة"},
  {title:"الشروط قبل الطلب",body:"استرجاع أو استبدال للعيب أو عدم المطابقة وفق الشروط"},
 ],link:"اقرئي التوصيل والاسترجاع"},
 eg:{eyebrow:"عشان تطلبي وإنتِ مطمّنة",title:"كاش عند الاستلام… ومن غير مفاجآت",intro:"من غير دفع مقدم؛ اعرفي تكلفة الشحن حسب محافظتك قبل تأكيد الطلب.",cards:[
  {title:"كاش عند الاستلام",body:"من غير بطاقات أو تحويلات"},
  {title:"الشحن حسب المحافظة",body:"المصاريف بتظهر حسب العنوان قبل التأكيد"},
  {title:"التوصيل حسب المنطقة",body:"التقديرات تبدأ بعد تأكيد الطلب وتجهيزه"},
 ],link:"اعرفي تفاصيل الشحن والمرتجعات"},
 iq:{eyebrow:"تفاصيل الطلب واضحة",title:"كاش عند الاستلام… والباقي ينوضح إلچ",intro:"الدفع كاش عند الاستلام، وأجرة التوصيل واضحة قبل تأكيد طلبچ.",cards:[
  {title:"كاش عند الاستلام",body:"بدون بطاقات أو تحويلات مسبقة"},
  {title:"٧٬٠٠٠ دينار للشحن",body:"رسوم الشحن لجميع المحافظات"},
  {title:"استرجاع موضّح",body:"تفاصيل الاسترجاع حسب حالة المنتج وحقوق المستهلك"},
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
