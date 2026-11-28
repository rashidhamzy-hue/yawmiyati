import {pageCopy} from "@/lib/store/page-copy";
import {shopCopy} from "@/lib/store/shop-copy";
import {customerServiceCopy} from "@/lib/store/customer-service-copy";
import {paymentAnswer} from "../../../supabase/functions/_shared/payment-policy";
import {ShoppingAssistant} from "./ShoppingAssistantDeferred";
import {StoreFrame} from "./StoreChrome";
import type {MarketCode} from "@/lib/store/markets";
import {ChevronDown,HelpCircle,ShieldCheck,Truck,FileText,ArrowLeft,Search,LockKeyhole,MessageCircle} from "lucide-react";
import {img} from "@/lib/store/images";
import {editorialSrcSet} from "@/lib/store/editorial-srcset";
import {saudiShippingPage} from "@/lib/store/saudi-commerce-content";
import {marketPolicyPages} from "@/lib/store/market-policy-pages";
import {marketExperience} from "@/lib/store/market-experience";
export type InfoTopic="help"|"privacy"|"terms"|"shipping-returns";
const visuals:Record<InfoTopic,{hero:string;accent:string;secondary:string}>={
 help:{hero:img["cat-kitchen"],accent:img["cat-home"],secondary:img["cat-beauty"]},
 privacy:{hero:img["cat-home"],accent:img["cat-wellness"],secondary:img["cat-organize"]},
 terms:{hero:img["cat-organize"],accent:img["cat-home"],secondary:img["cat-fashion"]},
 "shipping-returns":{hero:img["cat-fashion"],accent:img["cat-kitchen"],secondary:img["cat-organize"]},
};
/** Help, privacy and terms come from the market dictionary (page-copy.ts); the shipping page keeps its own market file. */
function infoPage(market:MarketCode,topic:InfoTopic){
 const pc=pageCopy(market);
 if(topic==="shipping-returns")return market==="sa"?saudiShippingPage:marketPolicyPages[market];
 if(topic==="help")return {title:pc.helpTitle,intro:pc.helpIntro,groups:pc.helpGroups};
 if(topic==="privacy")return {title:pc.privacyTitle,intro:pc.privacyIntro,groups:pc.privacyGroups};
 return {title:pc.termsTitle,intro:pc.termsIntro,groups:pc.terms};
}
export function StoreInfoPage({market,topic}:{market:MarketCode;topic:InfoTopic}){
 const base=infoPage(market,topic),pc=pageCopy(market);
 // Privacy: what is kept about phone numbers for order confirmation (a one-way code and a count, nothing else), in the market's own words.
 const orderCopy=shopCopy(market);
 const page=topic==="privacy"?{...base,groups:[...base.groups,[orderCopy.privacyOrdersTitle,orderCopy.privacyOrdersText] as const]}:base;
 const v=visuals[topic];
 const words={help:{alt:pc.infoAltHelp,eyebrow:pc.helpEyebrow},privacy:{alt:pc.infoAltPrivacy,eyebrow:pc.privacyEyebrow},terms:{alt:pc.infoAltTerms,eyebrow:pc.termsEyebrow},"shipping-returns":{alt:pc.infoAltShipping,eyebrow:pc.shippingEyebrow}}[topic];
 const heroPhoto=topic==="shipping-returns"&&market!=="sa"?img[marketExperience[market].heroImage]:v.hero;
 return <StoreFrame market={market}>
  <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
   <nav aria-label={pc.crumbs} className="mb-5 text-sm text-muted-foreground"><a className="hover:text-primary" href={"/"+market}>{pc.brand}</a><span aria-hidden="true"> / </span>{page.title}</nav>
   <section className="relative isolate flex min-h-[285px] items-center overflow-hidden rounded-[2rem] bg-foreground sm:min-h-[350px]">
    <img src={heroPhoto} srcSet={editorialSrcSet(heroPhoto)} sizes="100vw" alt={words.alt} className="absolute inset-0 h-full w-full object-cover" fetchPriority="high"/>
    <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/50 to-black/20"/>
    <div className="relative max-w-2xl px-7 py-12 text-white sm:px-12">
     <p className="text-sm font-bold text-[#f5dab1]">{words.eyebrow}</p>
     <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight sm:text-5xl">{page.title}</h1>
     <p className="mt-4 text-sm leading-8 text-white/90 sm:text-base">{page.intro}</p>
    </div>
   </section>
   <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_1.65fr] lg:gap-9">
    <aside className="order-2 self-start space-y-5 lg:order-1">
     <div className="overflow-hidden rounded-[1.5rem] border bg-card">
      <img src={v.accent} srcSet={editorialSrcSet(v.accent)} sizes="(max-width: 1024px) 100vw, 30vw" alt="" loading="lazy" className="aspect-[16/9] w-full object-cover"/>
      <div className="space-y-3 p-5">
       <h2 className="font-display text-xl font-extrabold">{pc.asideTitle}</h2>
       <p className="text-sm leading-7 text-muted-foreground">{pc.asideText}</p>
       <button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={()=>document.dispatchEvent(new CustomEvent("yawmiyati:open-search"))}><Search className="h-4 w-4"/> {pc.searchLabel} <ArrowLeft className="h-4 w-4"/></button>
      </div>
     </div>
     <div className="relative overflow-hidden rounded-[1.5rem] bg-primary-soft p-5">
      <img src={v.secondary} srcSet={editorialSrcSet(v.secondary)} sizes="(max-width: 1024px) 100vw, 30vw" alt="" loading="lazy" className="mb-4 aspect-[2.5/1] w-full rounded-xl object-cover"/>
      <h2 className="font-display text-lg font-extrabold">{pc.assistantTitle}</h2>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{pc.assistantText}</p>
      <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-primary"><MessageCircle className="h-4 w-4"/> {pc.assistantWhere}</p>
     </div>
    </aside>
    <div className="order-1 lg:order-2">
     <div className="rounded-[1.75rem] border bg-card p-5 shadow-soft sm:p-8">
      <div className="mb-7 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary"><HelpCircle className="h-6 w-6"/></div><div><p className="text-xs font-bold text-primary">{pc.answersEyebrow}</p><h2 className="font-display text-xl font-extrabold">{pc.answersTitle}</h2></div></div>
      <div className="space-y-3">{page.groups.map(([title,description],i)=><details key={title} className="group rounded-[1.25rem] border border-border bg-background px-5 py-4" open={i===0}>
       <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 text-sm font-extrabold marker:hidden sm:text-base">{title}<ChevronDown className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180"/></summary>
       <p className="pb-2 pt-3 text-sm leading-8 text-muted-foreground">{description}</p>
      </details>)}</div>
     </div>
     <div className="mt-5 rounded-[1.5rem] border bg-muted/40 p-5 text-sm leading-7 text-muted-foreground">
      <ShieldCheck className="mb-2 h-5 w-5 text-primary"/>
      {topic==="privacy"?pc.privacyNote:topic==="terms"?pc.termsNote:customerServiceCopy[market].shipping}
     </div>
     <div className="mt-8 flex flex-wrap gap-3 text-sm">{([{label:pc.linkHelp,id:"help"},{label:pc.linkShipping,id:"shipping-returns"},{label:pc.linkPrivacy,id:"privacy"},{label:pc.linkTerms,id:"terms"}] as const).filter(x=>x.id!==topic).map(x=><a key={x.id} href={"/"+market+"/info/"+x.id} className="inline-flex min-h-11 items-center rounded-full border bg-card px-4 font-bold text-primary hover:bg-primary-soft">{x.label}</a>)}</div>
    </div>
   </div>
  </div>
  <ShoppingAssistant market={market} products={[]}/>
 </StoreFrame>;
}
