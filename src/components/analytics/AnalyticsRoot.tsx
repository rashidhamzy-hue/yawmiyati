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
 return <div data-consent-banner="" role="region" aria-label="خصوصية التصفح" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[80] mx-auto max-w-md rounded-2xl border border-border bg-card p-4 text-sm shadow-2xl sm:bottom-6">
  <p className="leading-7 text-foreground">نستخدم أدوات قياس مجهولة الهوية لتحسين تجربة التسوق. هل توافقين على حفظ تفضيلاتك؟</p>
  <div className="mt-3 flex gap-2">
   <button type="button" onClick={()=>decide("granted")} className="min-h-11 flex-1 rounded-full bg-primary px-4 font-extrabold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">موافقة</button>
   <button type="button" onClick={()=>decide("denied")} className="min-h-11 flex-1 rounded-full border border-border px-4 font-bold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">لا، شكراً</button>
  </div>
 </div>;
}
