import {ArrowLeft,Clock3,HandCoins,ShieldCheck} from "lucide-react";
import type {MarketCode} from "@/lib/store/markets";
import {customerServiceCopy} from "@/lib/store/customer-service-copy";

/** Customer-service summary; never treats supplier quotations as sale terms. */
type NonSaudiMarket=Exclude<MarketCode,"sa">;
const headings:Record<NonSaudiMarket,{eyebrow:string;title:string;link:string}>={
 ae:{eyebrow:"الدفع والتوصيل",title:"كل التفاصيل اللي تهمّج قبل الطلب",link:"الدفع والتوصيل والاسترجاع"},
 om:{eyebrow:"الدفع والتوصيل",title:"تفاصيل تساعدك تختارين براحة",link:"التوصيل والاسترجاع"},
 eg:{eyebrow:"الشحن والدفع",title:"كل اللي محتاجاه عن الشحن والدفع",link:"تفاصيل الشحن والاسترجاع"},
 iq:{eyebrow:"الدفع والتوصيل",title:"كل ما يهمچ عن طلبچ",link:"التوصيل والاسترجاع"},
};
export function MarketPromiseStrip({market}:{market:NonSaudiMarket}){
 const info=headings[market],c=customerServiceCopy[market];
 const cards=[
  {title:c.paymentHeading,body:c.payment,Icon:HandCoins},
  {title:c.shippingHeading,body:c.shipping,Icon:Clock3},
  {title:c.returnsHeading,body:c.returns,Icon:ShieldCheck},
 ];
 return <section aria-label={"تفاصيل التسوق في "+market} className="mx-auto max-w-7xl px-4 pt-9 sm:px-6 lg:px-8">
  <div className="overflow-hidden rounded-[1.8rem] border border-primary/15 bg-primary-soft p-5 sm:p-8">
   <div className="flex flex-wrap items-end justify-between gap-4">
    <div className="max-w-2xl"><p className="text-xs font-extrabold text-primary">{info.eyebrow}</p><h2 className="mt-2 font-display text-2xl font-extrabold leading-tight sm:text-3xl">{info.title}</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{c.shippingIntro}</p></div>
    <a href={"/"+market+"/info/shipping-returns"} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground">{info.link}<ArrowLeft className="h-4 w-4" aria-hidden="true"/></a>
   </div>
   <div className="mt-6 grid gap-3 sm:grid-cols-3">
    {cards.map(({title,body,Icon})=><div key={title} className={"rounded-2xl bg-card px-5 py-5 shadow-sm "+(market==="eg"?"border-b-4 border-primary/35":market==="iq"?"border-r-4 border-gold":"border border-border/70")}>
      <Icon className="h-6 w-6 text-primary" aria-hidden="true"/><h3 className="mt-3 text-base font-extrabold">{title}</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">{body}</p>
    </div>)}
   </div>
  </div>
 </section>;
}
