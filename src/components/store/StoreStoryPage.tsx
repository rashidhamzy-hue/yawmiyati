import {ArrowLeft,BookOpen,Heart,Lightbulb,PackageCheck,Sparkles,Store,ArrowUpLeft} from "lucide-react";
import {StoreFrame} from "./StoreChrome";
import {img} from "@/lib/store/images";
import {brandStory} from "@/lib/store/brand-story";
import {marketExperience} from "@/lib/store/market-experience";
import type {MarketCode} from "@/lib/store/markets";

export function StoreStoryPage({market}:{market:MarketCode}){
 const story=brandStory[market],experience=marketExperience[market],path="/"+market;
 const highlights=[
  {icon:Lightbulb,number:"01",title:story.originTitle,body:story.origin,image:img["cat-kitchen"],alt:"تفاصيل ركن القهوة والحياة اليومية"},
  {icon:BookOpen,number:"02",title:story.turningTitle,body:story.turning,image:img["cat-home"],alt:"تفاصيل البيت التي تلهم اختياراتنا"},
  {icon:Heart,number:"03",title:story.promiseTitle,body:story.promise,image:img["cat-beauty"],alt:"تفاصيل الجمال والعناية"},
 ];
 return <StoreFrame market={market}>
  <main id="story-page" className="pb-20">
   <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
    <nav aria-label="مسار الصفحة" className="mb-5 text-sm text-muted-foreground"><a href={path} className="hover:text-primary">يومياتي</a><span aria-hidden="true"> / </span>قصتنا</nav>
    <section className="relative isolate overflow-hidden rounded-[2rem] bg-foreground text-white">
     <img src={img[experience.heroImage]} alt={experience.heroAlt} className="absolute inset-0 h-full w-full object-cover" fetchPriority="high"/>
     <div className="absolute inset-0 bg-gradient-to-l from-black/85 via-black/60 to-black/25"/>
     <div className="relative flex min-h-[480px] flex-col items-start justify-center px-6 py-16 sm:px-14 lg:min-h-[565px] lg:px-20">
      <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-4 py-2 text-xs font-bold text-white"><Sparkles className="h-4 w-4" aria-hidden="true"/>{story.kicker}</span>
      <h1 className="mt-7 max-w-3xl font-display text-4xl font-extrabold leading-[1.4] sm:text-5xl lg:text-6xl">{story.headline}<span className="mt-1 block text-[#f5dab1]">{story.highlight}</span></h1>
      <p className="mt-7 max-w-2xl text-base leading-9 text-white/90 sm:text-lg">{story.lead}</p>
      <a href={path+"#discover"} className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-extrabold text-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">{story.shopCta}<ArrowLeft className="h-4 w-4" aria-hidden="true"/></a>
     </div>
    </section>
   </div>
   <section aria-label="رحلة يومياتي" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-extrabold tracking-wider text-primary">من المحتوى للتجارة الإلكترونية</p><h2 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">كيف تطوّرت حكايتنا؟</h2><p className="mt-4 text-sm leading-8 text-muted-foreground">نفس حبّ التفاصيل، لكن بخطوة جديدة تقرّب الإلهام من الاختيار.</p></div>
    <div className="mt-10 grid gap-5 lg:grid-cols-3">
     {highlights.map(({icon:Icon,number,title,body,image,alt})=><article key={number} className="overflow-hidden rounded-[1.7rem] border border-border/80 bg-card shadow-soft"><div className="relative h-52 overflow-hidden bg-primary-soft"><img loading="lazy" src={image} alt={alt} className="h-full w-full object-cover"/><div className="absolute bottom-3 right-4 rounded-full bg-background/95 px-4 py-1.5 text-sm font-extrabold text-primary">{number}</div></div><div className="p-6 sm:p-7"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary"><Icon className="h-6 w-6" aria-hidden="true"/></div><h3 className="mt-5 font-display text-xl font-extrabold leading-8">{title}</h3><p className="mt-3 text-sm leading-8 text-muted-foreground">{body}</p></div></article>)}
    </div>
   </section>
   <section className="bg-primary-soft py-16 sm:py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-extrabold text-primary">وش يميّزنا؟</p><h2 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">{story.sectionTitle}</h2><p className="mt-4 text-sm leading-8 text-muted-foreground">{story.sectionLead}</p></div>
    <div className="mt-10 grid gap-4 md:grid-cols-3">{story.pillars.map((p,i)=>{const Icon=[Lightbulb,PackageCheck,Store][i];return <article key={p.label} className="rounded-[1.5rem] bg-card p-6 shadow-sm sm:p-8"><div className="flex items-center justify-between"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary"><Icon className="h-6 w-6" aria-hidden="true"/></div><span className="text-xl font-extrabold text-primary/50">{p.label}</span></div><h3 className="mt-5 text-lg font-extrabold">{p.title}</h3><p className="mt-3 text-sm leading-8 text-muted-foreground">{p.description}</p></article>})}</div>
   </div></section>
   <section className="mx-auto max-w-5xl px-4 pt-16 text-center sm:px-6"><div className="rounded-[2rem] border border-border/80 bg-card px-6 py-12 shadow-soft sm:px-12">
     <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary"><Heart className="h-7 w-7" aria-hidden="true"/></span>
     <h2 className="mt-6 font-display text-3xl font-extrabold leading-tight">{story.endingTitle}</h2>
     <p className="mx-auto mt-5 max-w-2xl text-sm leading-9 text-muted-foreground">{story.ending}</p>
     <div className="mt-8 flex flex-wrap justify-center gap-3"><a href={path+"#discover"} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-extrabold text-primary-foreground">{story.shopCta}<ArrowLeft className="h-4 w-4" aria-hidden="true"/></a><a href={path+"/info/help"} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-primary/30 px-6 py-3 text-sm font-bold text-primary">عندك سؤال؟ <ArrowUpLeft className="h-4 w-4" aria-hidden="true"/></a></div>
    </div></section>
  </main>
 </StoreFrame>;
}
