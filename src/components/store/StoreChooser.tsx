import {chromeCopy} from "@/lib/store/chrome-copy";
import {marketExperience} from "@/lib/store/market-experience";
import {markets,type MarketCode} from "@/lib/store/markets";

const ORDER:readonly MarketCode[]=["sa","ae","om","eg","iq"];
/**
 * The root page for visitors outside our five countries, for unknown countries and for search engines:
 * one card per store. Each card speaks in its own market's words; the heading is plain standard Arabic.
 */
export function StoreChooser(){
 const copy=chromeCopy("sa");
 return <div dir="rtl" lang="ar" className="min-h-screen bg-background text-foreground">
  <main id="main-content" className="mx-auto max-w-3xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20" data-store-chooser="">
   <p className="font-display text-2xl font-bold" aria-hidden="true">{copy.brand}</p>
   <h1 className="ym-h1 mt-6">{copy.chooserTitle}</h1>
   <p className="ym-body mt-3 max-w-xl">{copy.chooserLead}</p>
   <ul className="mt-8 grid gap-3 sm:grid-cols-2">{ORDER.map(m=><li key={m}>
    <a href={"/"+m} hrefLang={markets[m].locale} lang={markets[m].locale} className="ym-card flex min-h-20 items-center justify-between gap-4 px-5 py-4 transition-colors hover:border-foreground/40" data-store-link={m}>
     <span><span className="block font-display text-lg font-bold">{marketExperience[m].regionName}</span><span className="block text-sm text-muted-foreground">{chromeCopy(m).deliversIn(marketExperience[m].regionName)}</span></span>
     <span className="ym-chip" dir="ltr">{markets[m].currency}</span>
    </a></li>)}</ul>
   <p className="mt-8 text-sm leading-7 text-muted-foreground">{copy.chooserHint}</p>
  </main>
 </div>;
}
