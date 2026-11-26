import {useEffect,useState} from "react";
import {useRouterState} from "@tanstack/react-router";
import {analyticsEnabled,initAnalytics,readConsent,setConsent,trackPageview} from "@/lib/analytics/analytics";

/** Sends a $pageview on every route change and shows the consent prompt once. */
export function AnalyticsRoot(){
 const pathname=useRouterState({select:s=>s.location.pathname});
 const [askConsent,setAskConsent]=useState(false);
 useEffect(()=>{
  if(!analyticsEnabled())return;
  const start=()=>{void initAnalytics();};
  const w=window as Window&{requestIdleCallback?:(cb:()=>void,o?:{timeout:number})=>number};
  if(w.requestIdleCallback)w.requestIdleCallback(start,{timeout:3000});else setTimeout(start,1500);
  setAskConsent(readConsent()==="unknown");
 },[]);
 useEffect(()=>{trackPageview();},[pathname]);
 if(!askConsent||pathname.startsWith("/admin"))return null;
 const decide=(v:"granted"|"denied")=>{setConsent(v);setAskConsent(false);};
 return <div role="region" aria-label="خصوصية التصفح" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[80] mx-auto max-w-md rounded-2xl border border-border bg-card p-4 text-sm shadow-2xl sm:bottom-6">
  <p className="leading-7 text-foreground">نستخدم أدوات قياس مجهولة الهوية لتحسين تجربة التسوق. هل توافقين على حفظ تفضيلاتك؟</p>
  <div className="mt-3 flex gap-2">
   <button type="button" onClick={()=>decide("granted")} className="min-h-11 flex-1 rounded-full bg-primary px-4 font-extrabold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">موافقة</button>
   <button type="button" onClick={()=>decide("denied")} className="min-h-11 flex-1 rounded-full border border-border px-4 font-bold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">لا، شكراً</button>
  </div>
 </div>;
}
