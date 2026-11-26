/**
 * Browser error tracking. The Sentry SDK is loaded only after the page has
 * fully loaded (it never competes with the hero image or fonts). Errors that
 * happen before then are queued and sent once it starts.
 */
import {DENY_URLS,IGNORE_ERRORS,SENTRY_DSN,scrubEvent,sentryEnvironment} from "./sentry-config";

type Pending={error:unknown;context?:Record<string,unknown>|undefined};
type SentryApi=typeof import("./sentry-browser-sdk");
const MAX_QUEUE=20;
let queue:Pending[]=[];
let sentry:SentryApi|null=null;
let started=false;

export function captureError(error:unknown,context?:Record<string,unknown>){
 if(typeof window==="undefined")return;
 if(sentry){sentry.captureException(error,context?{extra:context}:undefined);return;}
 if(queue.length<MAX_QUEUE)queue.push({error,context});
}

const onError=(e:ErrorEvent)=>{if(!sentry)captureError(e.error??e.message,{mechanism:"onerror"});};
const onRejection=(e:PromiseRejectionEvent)=>{if(!sentry)captureError(e.reason,{mechanism:"unhandledrejection"});};

/** Call once from the app root. Returns false when monitoring is disabled for this host. */
export function startErrorMonitoring(delayMs=3000):boolean{
 if(typeof window==="undefined"||started)return false;
 const environment=sentryEnvironment(window.location.hostname);
 if(environment==="local"||import.meta.env.MODE==="test")return false;
 started=true;
 window.addEventListener("error",onError);
 window.addEventListener("unhandledrejection",onRejection);
 const boot=()=>setTimeout(()=>{void load(environment);},delayMs);
 if(document.readyState==="complete")boot();else window.addEventListener("load",boot,{once:true});
 return true;
}

async function load(environment:string){
 try{
  const api=await import("./sentry-browser-sdk");
  api.init({
   dsn:SENTRY_DSN,environment,
   dataCollection:{userInfo:false,cookies:false,httpHeaders:{allow:["user-agent","accept-language","cf-ipcountry"]},httpBodies:[],urlQueryParams:false},tracesSampleRate:0,
   ignoreErrors:IGNORE_ERRORS,denyUrls:DENY_URLS,
   beforeSend:event=>scrubEvent(event),
   beforeBreadcrumb:crumb=>{
    // Never record what shoppers type; keep only navigation and click targets.
    if(crumb.category==="ui.input")return null;
    const data=crumb.data as Record<string,unknown>|undefined;
    for(const k of ["url","to","from"])if(data&&typeof data[k]==="string")data[k]=(data[k] as string).split("?")[0];
    return crumb;
   },
  });
  api.setTag("market",window.location.pathname.split("/")[1]||"root");
  sentry=api;
  window.removeEventListener("error",onError);
  window.removeEventListener("unhandledrejection",onRejection);
  const pending=queue;queue=[];
  for(const p of pending)captureError(p.error,p.context);
 }catch{/* monitoring must never break the store */}
}

/** Test hook. */
export function __resetForTests(){queue=[];sentry=null;started=false;}
export function __queuedForTests(){return queue.length;}
