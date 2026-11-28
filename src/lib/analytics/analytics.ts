/**
 * Yawmiyati browser analytics (PostHog). Client-only, loaded after the page is interactive
 * so it never slows the first paint. No names, phones or addresses are ever sent.
 *
 * Consent: until the shopper accepts, events are kept in memory only (no cookies, no
 * localStorage, no session replay). After acceptance PostHog persists an anonymous id and
 * records masked session replays. Rejection keeps the memory-only mode.
 */
import type {PostHog} from "posthog-js";
import {pageContext} from "./page-context";
import {attributionProps,persistAttributionAfterConsent} from "./attribution";

export type Consent="granted"|"denied"|"unknown";
const CONSENT_KEY="yawmiyati.consent.v1";
const key=import.meta.env.VITE_YAWMIYATI_POSTHOG_KEY as string|undefined;
const host=(import.meta.env.VITE_YAWMIYATI_POSTHOG_HOST as string|undefined)??"https://us.i.posthog.com";

let client:PostHog|null=null;
let loading:Promise<PostHog|null>|null=null;
const queue:[string,Record<string,unknown>][]=[];

export function analyticsEnabled(){return typeof window!=="undefined"&&!!key;}
/** Same answer on the server and in the browser (build-time key), so SSR and hydration agree. */
export function analyticsConfigured(){return !!key;}
/**
 * Inline <head> script: hides the server-rendered consent prompt before first paint
 * when this visitor already answered, so it never flashes and never becomes a late LCP.
 */
export const CONSENT_PRECHECK_SCRIPT=`try{var v=localStorage.getItem(${JSON.stringify("yawmiyati.consent.v1")});if(v==="granted"||v==="denied"){var s=document.createElement("style");s.textContent="[data-consent-banner]{display:none!important}";document.head.appendChild(s);}}catch(e){}`;

export function readConsent():Consent{
 try{const v=window.localStorage.getItem(CONSENT_KEY);return v==="granted"||v==="denied"?v:"unknown";}catch{return "unknown";}
}

function baseProps(){
 const ctx=pageContext(window.location.pathname);
 return {...ctx,...attributionProps(),app:"storefront",staging:window.location.hostname.endsWith("workers.dev")};
}

export function initAnalytics():Promise<PostHog|null>{
 if(!analyticsEnabled())return Promise.resolve(null);
 if(loading)return loading;
 const consent=readConsent();
 loading=import("posthog-js").then(({default:posthog})=>{
  posthog.init(key!,{
   api_host:host,
   ui_host:"https://us.posthog.com",
   defaults:"2025-05-24",
   capture_pageview:false,          // we send our own $pageview with market/page_type
   capture_pageleave:true,          // includes scroll depth → "where did they leave"
   capture_dead_clicks:true,
   autocapture:true,                // clicks, rage clicks
   capture_performance:{web_vitals:true},
   persistence:consent==="granted"?"localStorage+cookie":"memory",
   disable_session_recording:consent!=="granted",
   session_recording:{maskAllInputs:true,maskTextSelector:"[data-private]"},
   person_profiles:"identified_only",
   mask_personal_data_properties:true,
   disable_surveys:true,            // no surveys in use: skips a 51 KB script
  });
  posthog.register(baseProps());
  client=posthog;
  for(const [event,props] of queue.splice(0))posthog.capture(event,props);
  return posthog;
 }).catch(()=>null);
 return loading;
}

export function track(event:string,props:Record<string,unknown>={}){
 if(!analyticsEnabled())return;
 const payload={...baseProps(),...props};
 // Before the library has started, events wait in a small queue; AnalyticsRoot starts it on the first
 // interaction or a few seconds after load, so analytics never competes with the page's first paint.
 if(client)client.capture(event,payload);else if(queue.length<60)queue.push([event,payload]);
 // Meta twin (Pixel + Conversions API, one shared event id): only when a Pixel id is configured and she accepted analytics.
 if(import.meta.env["VITE_META_PIXEL_ID"]&&readConsent()==="granted")void import("./meta-events").then(m=>{m.forwardToMeta(event,payload,"granted");}).catch(()=>undefined);
}

export function trackPageview(){
 if(!analyticsEnabled())return;
 if(client)client.register(baseProps());
 track("$pageview",{$current_url:window.location.href});
}

export function setConsent(value:"granted"|"denied"){
 try{window.localStorage.setItem(CONSENT_KEY,value);}catch{/* private mode: keep memory-only */}
 if(value==="granted")persistAttributionAfterConsent();
 track("consent_decided",{consent:value});
 if(!client)return;
 if(value==="granted"){client.set_config({persistence:"localStorage+cookie"});client.startSessionRecording();}
 else{client.stopSessionRecording();client.set_config({persistence:"memory"});}
}
