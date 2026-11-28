import {useEffect,useState} from "react";
import {useRouterState} from "@tanstack/react-router";
import {startErrorMonitoring} from "@/lib/monitoring/sentry-client";
import {captureAttribution} from "@/lib/analytics/attribution";
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
  // Start after the page has fully loaded and settled, so analytics never competes
  // with the hero image or fonts on slow mobile connections.
  const start=()=>{setTimeout(()=>{void initAnalytics();},2500);};
  if(document.readyState==="complete")start();else window.addEventListener("load",start,{once:true});
  setAskConsent(readConsent()==="unknown");
 },[]);
 useEffect(()=>{trackPageview();},[pathname]);
 if(!askConsent||pathname.startsWith("/admin"))return null;
 const decide=(v:"granted"|"denied")=>{setConsent(v);setAskConsent(false);};
 return <div data-consent-banner="" role="region" aria-label="خصوصية التصفح" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+var(--mobile-nav-height,0px)+0.75rem)] z-[80] mx-auto flex max-w-xl flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-card px-4 py-3 text-[13px] shadow-lift sm:bottom-5">
  <p className="min-w-[13rem] flex-1 leading-6 text-foreground">نستخدم أدوات قياس مجهولة الهوية لتحسين تجربة التسوق. هل توافقين على حفظ تفضيلاتك؟</p>
  <div className="flex shrink-0 gap-2">
   <button type="button" onClick={()=>decide("granted")} className="min-h-11 rounded-full bg-primary px-5 font-bold text-primary-foreground">موافقة</button>
   <button type="button" onClick={()=>decide("denied")} className="min-h-11 rounded-full border border-border px-4 font-semibold text-foreground">لا، شكراً</button>
  </div>
 </div>;
}
