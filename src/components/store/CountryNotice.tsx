import {X} from "lucide-react";
import {useEffect,useState} from "react";
import {chromeCopy} from "@/lib/store/chrome-copy";
import {marketExperience} from "@/lib/store/market-experience";
import {markets,type MarketCode} from "@/lib/store/markets";
import {sameSpotIn,visitorPlace,type VisitorPlace} from "@/lib/store/visitor-country";
import {track} from "@/lib/analytics/analytics";

const KEY=(store:MarketCode,place:VisitorPlace)=>"yawmiyati.place."+store+"."+(place.kind==="other_store"?place.market:"elsewhere");
let pending:Promise<string|null>|null=null;
/** One request per page load; the answer is kept in memory only. */
function visitorCountry():Promise<string|null>{
 pending??=fetch("/api/visitor-country",{cache:"no-store",signal:AbortSignal.timeout(6000)}).then(r=>r.ok?r.json():null)
  .then((b:unknown)=>b&&typeof b==="object"&&typeof (b as {country?:unknown}).country==="string"&&/^[A-Z]{2}$/.test((b as {country:string}).country)?(b as {country:string}).country:null).catch(()=>null);
 return pending;
}
/**
 * A friendly, dismissible bar for a visitor who is not in this store's country. It never blocks and never redirects
 * (expats order for family back home). The dismissal is remembered in this browser, per store.
 */
export default function CountryNotice({market}:{market:MarketCode}){
 const copy=chromeCopy(market),here=marketExperience[market].regionName;
 const [place,setPlace]=useState<VisitorPlace|null>(null),[href,setHref]=useState("/");
 useEffect(()=>{
  let live=true;
  void visitorCountry().then(country=>{
   if(!live)return;
   const p=visitorPlace(market,country);
   if(p.kind==="same")return;
   try{if(window.localStorage.getItem(KEY(market,p)))return;}catch{/* private mode: show it on every page */}
   if(p.kind==="other_store")setHref(sameSpotIn(p.market,window.location.pathname,document.querySelector("main h1")?.textContent));
   setPlace(p);track("country_notice_shown",{market,kind:p.kind,visitor_market:p.kind==="other_store"?p.market:"",country:country??"unknown"});
  });
  return()=>{live=false;};
 },[market]);
 if(!place||place.kind==="same")return null;
 const close=(why:"dismiss"|"stay")=>{try{window.localStorage.setItem(KEY(market,place),"1");}catch{/* ignore */}track("country_notice_closed",{market,kind:place.kind,why});setPlace(null);};
 const there=place.kind==="other_store"?marketExperience[place.market].regionName:"";
 return <aside role="region" aria-label={copy.placeLabel} lang={markets[market].locale} className="border-b border-border bg-primary-soft" data-country-notice={place.kind}>
  <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-2.5 text-sm sm:items-center sm:px-6 lg:px-8">
   <p className="min-w-0 flex-1 leading-6">{place.kind==="other_store"?copy.placeOtherStore(here,there):copy.placeElsewhere(here)}
    <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 sm:ms-3 sm:mt-0 sm:inline-flex">
     {place.kind==="other_store"
      ?<><a href={href} className="font-bold underline underline-offset-4" onClick={()=>track("country_notice_click",{market,to:place.market})}>{copy.placeGoToStore(there)}</a>
        <button type="button" className="text-muted-foreground underline underline-offset-4" onClick={()=>close("stay")}>{copy.placeStay}</button></>
      :<a href="/?choose=1" className="font-bold underline underline-offset-4">{copy.placeAllStores}</a>}
    </span></p>
   <button type="button" onClick={()=>close("dismiss")} aria-label={copy.placeClose} className="-me-2 grid h-11 w-11 flex-none place-items-center rounded-full hover:bg-background/60"><X className="h-4 w-4" aria-hidden="true"/></button>
  </div>
 </aside>;
}
