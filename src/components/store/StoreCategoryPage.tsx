import {pageCopy} from "@/lib/store/page-copy";
import {PUBLIC_CATEGORY_SLUGS} from "@/lib/store/public-catalog";
import {SECTION_PHOTOS,storeSection,storeSections} from "@/lib/store/sections";
import {StoreFrame} from "./StoreChrome";
import {ShoppingAssistant} from "./ShoppingAssistantDeferred";
import {ApprovedCategoryProductGrid} from "./ApprovedCategoryProductGrid";
import {img} from "@/lib/store/images";
import {editorialSrcSet} from "@/lib/store/editorial-srcset";
import {marketExperience} from "@/lib/store/market-experience";
import type {MarketCode} from "@/lib/store/markets";
import {ArrowLeft,ChevronDown,Search,Sparkles} from "lucide-react";
import {preload} from "react-dom";
/** Sections that have a page: slug and photo. Names and short lines come from the market dictionary. */
export const EDITORIAL_CATEGORIES=PUBLIC_CATEGORY_SLUGS.map(slug=>({slug,image:SECTION_PHOTOS[slug]}));
export function StoreCategoryPage({market,slug}:{market:MarketCode;slug:string}){
 const pc=pageCopy(market),section=storeSection(market,slug),category=section&&{slug:section.slug,title:section.name,image:section.photo};
 if(!category)return <StoreFrame market={market}><section className="mx-auto max-w-5xl px-4 py-16"><h1 className="font-display text-3xl font-bold">{pageCopy(market).sectionNotFound}</h1><a className="btn-outline mt-6" href={"/"+market}>{pageCopy(market).backToStore}</a></section></StoreFrame>;
 // React 19 hoists this into <head> during SSR, so the LCP photo starts downloading
 // while the HTML is still being parsed (the category hero had no preload before).
 const heroSrcSet=editorialSrcSet(category.image);
 preload(category.image,{as:"image",fetchPriority:"high",...(heroSrcSet?{imageSrcSet:heroSrcSet,imageSizes:"(min-width: 1280px) 1216px, calc(100vw - 2rem)"}:{})});
 return <StoreFrame market={market}>
  <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
   <nav aria-label={pc.crumbs} className="mb-3 text-sm text-muted-foreground"><a href={"/"+market} className="hover:text-primary">{pc.brand}</a> / {category.title}</nav>
   <section className="relative isolate flex min-h-[170px] items-center overflow-hidden rounded-2xl bg-foreground sm:min-h-[230px]">
    <img src={category.image} srcSet={heroSrcSet} sizes="(min-width: 1280px) 1216px, calc(100vw - 2rem)" alt={category.title} className="absolute inset-0 h-full w-full object-cover" fetchPriority="high"/>
    <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/45 to-black/10"/>
    <div className="relative max-w-xl px-5 py-5 text-white sm:px-8 sm:py-8"><p className="mb-1 inline-flex items-center gap-2 text-xs font-bold"><Sparkles className="h-4 w-4"/> {pc.sectionEyebrow}</p>
      <h1 className="font-display text-2xl font-extrabold leading-tight sm:text-4xl">{category.title}</h1><p className="mt-1 text-sm leading-6 text-white/90">{section!.caption}</p>
      <button type="button" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-foreground transition-colors hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" onClick={()=>document.dispatchEvent(new CustomEvent("yawmiyati:open-search"))}><Search className="h-4 w-4"/> {pc.sectionSearch}</button>
    </div>
   </section>
   <nav aria-label={pc.switchSections} className="mt-4 flex gap-2 overflow-x-auto pb-2">
    <a href={"/"+market+"/search"} className="inline-flex min-h-11 shrink-0 items-center rounded-full border bg-card px-4 text-xs font-bold">{pc.allProducts}</a>
    {storeSections(market).map(c=><a key={c.slug} href={"/"+market+"/c/"+c.slug} aria-current={c.slug===slug?"page":undefined} className={"inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-xs font-bold "+(c.slug===slug?"border-primary bg-primary text-primary-foreground":"bg-card text-foreground")}>{c.name}</a>)}
   </nav>
   <p className="ym-body mt-3 max-w-2xl" data-section-intro="">{pc.sectionIntro[category.slug as keyof typeof pc.sectionIntro]}</p>
   <ApprovedCategoryProductGrid market={market} slug={category.slug} categoryTitle={category.title}/>
   {/* What shoppers ask before ordering, answered from the store's published facts, with links onward. */}
   <section aria-label={pc.questionsTitle} className="mt-12 max-w-3xl" data-section-questions="">
    <h2 className="ym-h3 mb-3">{pc.questionsTitle}</h2>
    <div className="space-y-2">{pc.buyerQuestions.map(([q,a])=><details key={q} className="group ym-card px-5 py-3"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold marker:hidden">{q}<ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true"/></summary><p className="pb-2 pt-2 text-sm leading-8 text-muted-foreground">{a}</p></details>)}</div>
    <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold"><a href={"/"+market+"/offers"} className="inline-flex min-h-11 items-center underline underline-offset-4">{pc.seeOffers}</a><a href={"/"+market+"/info/shipping-returns"} className="inline-flex min-h-11 items-center underline underline-offset-4">{pc.seePolicies}</a></p>
   </section>
   <section aria-label={pc.otherSections} className="mt-12 grid gap-7 lg:grid-cols-[1fr_1.1fr]"><div><p className="text-xs font-extrabold text-primary">{pc.moreEyebrow}</p><h2 className="mt-2 font-display text-3xl font-bold">{pc.moreTitle}</h2><p className="mt-4 text-sm leading-8 text-muted-foreground">{pc.moreText}</p></div>
    <div className="grid grid-cols-2 gap-3">{storeSections(market).filter(x=>x.slug!==slug).slice(0,4).map(x=><a key={x.slug} href={"/"+market+"/c/"+x.slug} className="group overflow-hidden rounded-2xl border bg-card"><img src={x.photo} srcSet={editorialSrcSet(x.photo)} sizes="(min-width: 1024px) 220px, 45vw" alt="" loading="lazy" decoding="async" width={360} height={270} className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-105"/><div className="flex items-center justify-between gap-2 p-3 text-xs font-bold">{x.name}<ArrowLeft className="h-4 w-4 text-primary"/></div></a>)}</div></section>
  </div>
  <ShoppingAssistant market={market} products={[]}/>
 </StoreFrame>;
}
