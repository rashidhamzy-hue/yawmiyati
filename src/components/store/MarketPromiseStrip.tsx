import {ArrowLeft,Clock3,HandCoins,ShieldCheck} from "lucide-react";
import type {MarketCode} from "@/lib/store/markets";

/** Guidance only: no real checkout, confirmed shipping prices or delivery SLAs. */
type NonSaudiMarket=Exclude<MarketCode,"sa">;
const highlights:Record<NonSaudiMarket,{
 eyebrow:string;title:string;intro:string;
 cards:readonly {title:string;body:string}[];
 link:string;
}>={
 ae:{eyebrow:"تفاصيل التوصيل",title:"اعرفي رسوم التوصيل قبل الطلب",
 intro:"كل التفاصيل المهمة في مكان واحد: رسوم التوصيل المتوقعة، ومدة الوصول، وطريقة الدفع عند بدء استقبال الطلبات.",
 cards:[
  {title:"الدفع عند الاستلام",body:"سيتوفر عند بدء استقبال الطلبات؛ الطلبات غير متاحة الآن"},
  {title:"رسوم التوصيل المتوقعة: ١٩ درهماً",body:"داخل الإمارات؛ نؤكد المبلغ النهائي قبل الطلب"},
  {title:"التوصيل المتوقع: ٢٤–٤٨ ساعة",body:"بعد تأكيد الطلب وتجهيزه، حسب المنطقة والتوافر"},
 ],link:"تفاصيل التوصيل والاسترجاع"},
 om:{eyebrow:"معلومات التوصيل",title:"كل ما يهمك عن توصيل طلبك",
 intro:"تعرّفي على رسوم التوصيل المتوقعة وطريقة الدفع، وتصفّحي الأقسام إلى حين بدء استقبال الطلبات.",
 cards:[
  {title:"الدفع عند الاستلام",body:"سيكون متاحاً عند بدء استقبال الطلبات"},
  {title:"رسوم التوصيل المتوقعة: ٣ ريالات عُمانية",body:"داخل عُمان؛ نؤكد المبلغ حسب العنوان قبل الطلب"},
  {title:"الاسترجاع والاستبدال",body:"ستظهر الشروط وحقوقك قبل بدء استقبال الطلبات"},
 ],link:"اقرئي التوصيل والاسترجاع"},
 eg:{eyebrow:"تفاصيل الشحن",title:"مصاريف الشحن حسب منطقتك",
 intro:"اعرفي مصاريف الشحن المتوقعة حسب وجهتك، وشوفي تفاصيل المناطق قبل بدء استقبال الطلبات.",
 cards:[
  {title:"كاش عند الاستلام",body:"هيكون متاح لما نبدأ نستقبل الطلبات"},
  {title:"مصاريف الشحن: ٩٥ أو ١٠٠ أو ١٠٥ جنيه",body:"حسب المنطقة؛ شوفي التفاصيل وهنأكد المبلغ قبل الطلب"},
  {title:"مواعيد التوصيل المتوقعة",body:"القاهرة والجيزة والإسكندرية يومان عمل؛ وباقي المناطق حسب الوجهة"},
 ],link:"اعرفي تفاصيل الشحن والمرتجعات"},
 iq:{eyebrow:"تفاصيل التوصيل",title:"اعرفي أجرة التوصيل قبل الطلب",
 intro:"شوفي أجرة التوصيل المتوقعة وطريقة الدفع، وتصفّحي الأقسام إلى أن تبدأ خدمة الطلبات.",
 cards:[
  {title:"الدفع عند الاستلام",body:"راح يتوفر لما نبدأ نستقبل الطلبات"},
  {title:"أجرة التوصيل المتوقعة: ٧٬٠٠٠ دينار عراقي",body:"للمحافظات المذكورة بالخدمة؛ نؤكد الأجرة قبل الطلب"},
  {title:"الاسترجاع والاستبدال",body:"نوضح الشروط وحقوقچ قبل بدء استقبال الطلبات"},
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
