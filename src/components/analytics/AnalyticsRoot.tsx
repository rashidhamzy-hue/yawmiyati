import {useEffect,useState} from "react";
import {useRouterState} from "@tanstack/react-router";
import {startErrorMonitoring} from "@/lib/monitoring/sentry-client";
import {captureAttribution} from "@/lib/analytics/attribution";
import {chromeCopy,marketFromPath} from "@/lib/store/chrome-copy";
import {analyticsConfigured,analyticsEnabled,initAnalytics,readConsent,setConsent,trackPageview} from "@/lib/analytics/analytics";

/** Sends a $pageview on every route change and shows the consent prompt once. */
export function AnalyticsRoot(){
 const pathname=useRouterState({select:s=>s.location.pathname});
 // Rendered on the server for everyone (painted with the page, not ~3 s later after hydration);
 // the inline head precheck hides it instantly for visitors who already answered.
 const [askConsent,setAskConsent]=useState(analyticsConfigured);
 useEffect(()=>{startErrorMonitoring();try{captureAttribution();}catch{/* never block the page */}},[]);
 useEffect(()=>{
  if(!analyticsEnabled())return;
  // Start on her first interaction, or six seconds after the page has fully loaded, whichever comes first:
  // the analytics library never competes with the hero picture, fonts or hydration on slow phones.
  let done=false;
  const events=["pointerdown","keydown","touchstart","scroll"] as const;
  // Funnel listeners (cards seen and clicked, product-page scroll) load with the analytics library, never before.
  const go=()=>{if(done)return;done=true;events.forEach(e=>window.removeEventListener(e,go));void initAnalytics();void import("@/lib/analytics/commerce-tracking").then(m=>{m.startCommerceTracking();}).catch(()=>undefined);};
  events.forEach(e=>window.addEventListener(e,go,{once:true,passive:true}));
  const later=()=>{window.setTimeout(go,6000);};
  if(document.readyState==="complete")later();else window.addEventListener("load",later,{once:true});
  setAskConsent(readConsent()==="unknown");
 },[]);
 useEffect(()=>{trackPageview();},[pathname]);
 if(!askConsent||pathname.startsWith("/admin"))return null;
 const decide=(v:"granted"|"denied")=>{setConsent(v);setAskConsent(false);};
 const copy=chromeCopy(marketFromPath(pathname));
 return <div data-consent-banner="" role="region" aria-label={copy.consentLabel} className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+var(--mobile-nav-height,0px)+0.75rem)] z-[80] mx-auto flex max-w-xl flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-card px-4 py-3 text-[13px] shadow-lift sm:bottom-5">
  <p className="min-w-[13rem] flex-1 leading-6 text-foreground">{copy.consentText}</p>
  <div className="flex shrink-0 gap-2">
   <button type="button" onClick={()=>decide("granted")} className="min-h-11 rounded-full bg-primary px-5 font-bold text-primary-foreground">{copy.consentAccept}</button>
   <button type="button" onClick={()=>decide("denied")} className="min-h-11 rounded-full border border-border px-4 font-semibold text-foreground">{copy.consentDecline}</button>
  </div>
 </div>;
}
