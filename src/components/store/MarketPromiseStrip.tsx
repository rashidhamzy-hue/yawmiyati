import {ArrowLeft,Clock3,HandCoins,ShieldCheck} from "lucide-react";
import type {MarketCode} from "@/lib/store/markets";

/** Guidance only: no real checkout, confirmed shipping prices or delivery SLAs. */
type NonSaudiMarket=Exclude<MarketCode,"sa">;
const highlights:Record<NonSaudiMarket,{
 eyebrow:string;title:string;intro:string;
 cards:readonly {title:string;body:string}[];
 link:string;
}>={
 ae:{eyebrow:"وضوح قبل أي طلب",title:"على ذوقج، وبخطوات واضحة",
 intro:"استكشفي الأقسام. قبل بدء الطلبات سنعتمد خيارات الدفع والتوصيل والاسترجاع في الإمارات.",
 cards:[
  {title:"الدفع عند الاستلام مخطط له",body:"لا نستقبل شراء أو دفعات حالياً"},
  {title:"رسوم الشحن قيد التحقق",body:"لا توجد تعرفة نهائية منشورة للطلبات"},
  {title:"المواعيد تحتاج اعتماداً",body:"التوصيل يعتمد على الخدمة والمنطقة والتوافر"},
 ],link:"تفاصيل التوصيل والاسترجاع"},
 om:{eyebrow:"التفاصيل قبل الوعود",title:"الدفع واضح، والتفاصيل قدّامك",
 intro:"الأقسام للإلهام، وخيار الدفع النقدي مخطط له عندما يُفتح الطلب بعد اعتماد الشروط.",
 cards:[
  {title:"الدفع النقدي مخطط له",body:"لا يتم إتمام طلب حقيقي الآن"},
  {title:"الشحن يحتاج تأكيداً",body:"التكلفة والتغطية ستظهر بعد الاعتماد"},
  {title:"الاسترجاع وفق القانون",body:"الشروط النهائية تحتاج مراجعة محلية"},
 ],link:"اقرئي التوصيل والاسترجاع"},
 eg:{eyebrow:"الوضوح أهم",title:"التفاصيل من غير مفاجآت",
 intro:"تصفحي يومياتي. الطلب والدفع لسه مش متاحين، ومصاريف الشحن هتتحدد بعد التحقق من أسعار كل محافظة.",
 cards:[
  {title:"كاش عند الاستلام مخطط له",body:"الشراء الحقيقي مش متاح دلوقتي"},
  {title:"الشحن حسب المحافظة",body:"لا توجد أسعار شحن مؤكدة للطلبات"},
  {title:"التوصيل قيد المراجعة",body:"المدة تتحدد حسب العنوان والخدمة"},
 ],link:"اعرفي تفاصيل الشحن والمرتجعات"},
 iq:{eyebrow:"تفاصيل قبل الطلب",title:"اختيارات على ذوقچ وبكل وضوح",
 intro:"اكتشفي الأقسام. الدفع النقدي والتوصيل ما يتفعّلون إلا بعد اعتماد الأسعار والتغطية والحقوق.",
 cards:[
  {title:"الدفع عند الاستلام مخطط له",body:"ماكو طلبات فعلية هسه"},
  {title:"أجرة التوصيل تحتاج تأكيد",body:"التعرفة النهائية غير معلنة"},
  {title:"الاسترجاع يحتاج توضيح",body:"شروط المورد لا تغني عن حقوق المستهلك"},
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
