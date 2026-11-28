import {ChevronLeft} from "lucide-react";
import {useEffect,useState} from "react";
import {chromeCopy} from "@/lib/store/chrome-copy";
import {rememberStore,rememberedStore,storesInOrder} from "@/lib/store/chosen-store";
import {editorialSrcSet} from "@/lib/store/editorial-srcset";
import {img} from "@/lib/store/images";
import {marketExperience} from "@/lib/store/market-experience";
import {marketIdentity} from "@/lib/store/market-identity";
import {markets,type MarketCode} from "@/lib/store/markets";
import {track} from "@/lib/analytics/analytics";

export const CHOOSER_ORDER:readonly MarketCode[]=["sa","ae","om","eg","iq"];
/** The chooser's one photograph (the licensed neutral interior), and how wide it is drawn: a banner on phones, a side panel on desktop. */
export const CHOOSER_PHOTO=img.hero;
export const CHOOSER_PHOTO_SIZES="(min-width: 1024px) 44vw, 100vw";
/**
 * Yawmiyati's front door: the root page for visitors outside our five countries, for unknown countries and for
 * search engines (x-default). Brand mark, one warm line, one photograph, five stores. Each store row speaks in its
 * own market's words; the page's own words are plain standard Arabic. The store picked here is remembered in this
 * browser and shown first next time; nobody is redirected because of it.
 */
export function StoreChooser(){
 const copy=chromeCopy("sa");
 const [last,setLast]=useState<MarketCode|null>(null);
 useEffect(()=>{setLast(rememberedStore());},[]);
 const choose=(m:MarketCode)=>{rememberStore(m);track("store_chosen",{market:m,remembered:last===m});};
 return <div dir="rtl" lang="ar" className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:grid-rows-[auto_1fr]" data-store-chooser="">
  <header className="mx-auto w-full max-w-xl px-5 pt-5 sm:px-8 lg:max-w-[38rem] lg:pt-10">
   <p className="font-display text-[1.9rem] font-extrabold leading-none tracking-tight lg:text-[2.25rem]">{copy.brand}<span className="text-gold" aria-hidden="true">.</span></p>
  </header>
  <figure className="mx-4 mt-4 aspect-[16/9] overflow-hidden rounded-[1.75rem] bg-surface sm:mx-8 sm:aspect-[2/1] lg:sticky lg:top-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:m-0 lg:aspect-auto lg:h-screen lg:rounded-none lg:p-4">
   <img src={CHOOSER_PHOTO} srcSet={editorialSrcSet(CHOOSER_PHOTO)} sizes={CHOOSER_PHOTO_SIZES} alt={copy.chooserPhotoAlt} width={1280} height={1920}
    fetchPriority="high" decoding="async" className="h-full w-full object-cover object-[50%_46%] lg:rounded-[2rem] lg:object-center"/>
  </figure>
  <main id="main-content" className="mx-auto flex w-full max-w-xl flex-col px-5 pb-10 pt-5 sm:px-8 lg:max-w-[38rem] lg:justify-center lg:pb-12 lg:pt-8">
   <h1 className="font-display text-[1.9rem] font-bold leading-[1.3] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.25]">{copy.chooserHeadline}</h1>
   <p className="ym-body mt-2.5 max-w-[34rem] lg:mt-4 lg:text-base">{copy.chooserLead}</p>
   <h2 className="mt-6 text-sm font-bold lg:mt-10">{copy.chooserTitle}</h2>
   <ul className="mt-3 grid gap-2.5" aria-label={copy.chooserStoresLabel}>{storesInOrder(CHOOSER_ORDER,last).map(m=>{
    const own=chromeCopy(m),name=marketExperience[m].regionName,remembered=last===m;
    return <li key={m}>
     <a href={"/"+m} hrefLang={markets[m].locale} lang={markets[m].locale} onClick={()=>choose(m)} data-store-link={m} data-remembered={remembered?"":undefined}
      className={"group flex min-h-[4.5rem] items-center gap-3 rounded-2xl border bg-card px-5 py-3 transition-[border-color,box-shadow,transform] duration-200 hover:border-foreground hover:shadow-soft active:scale-[.99] "+(remembered?"border-foreground":"border-border")}>
      <span className="min-w-0 flex-1">
       <span className="flex flex-wrap items-baseline gap-x-2.5">
        <span className="font-display text-[1.3rem] font-bold leading-snug">{name}</span>
        <span className="text-xs text-muted-foreground">{marketIdentity[m].currencyLong}</span>
        {remembered&&<span className="ym-chip ym-chip-sand self-center">{copy.chooserLast}</span>}
       </span>
       <span className="mt-0.5 block text-[.8125rem] leading-6 text-muted-foreground">{own.chooserCod} · {own.deliversIn(name)}</span>
      </span>
      <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-primary-soft transition-colors group-hover:bg-primary group-hover:text-primary-foreground" aria-hidden="true"><ChevronLeft className="h-4 w-4"/></span>
     </a></li>;})}</ul>
   <p className="mt-6 text-xs leading-6 text-muted-foreground">{copy.chooserHint}</p>
  </main>
 </div>;
}
