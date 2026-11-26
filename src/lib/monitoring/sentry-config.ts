/**
 * Sentry error tracking — org "yawmiyati" (EU region), project "yawmiyati-storefront".
 * A DSN is a public, write-only key (it ships to every browser); it is not a secret.
 * Errors only: no performance tracing, no session replay (PostHog owns replay), no PII.
 */

export const SENTRY_DSN="https://05185148ed5075246f9b68323a435728@o4512498534645760.ingest.de.sentry.io/4512498538840144";

const PRODUCTION_HOSTS:readonly string[]=["yawmiyati.shop","www.yawmiyati.shop"];
const LOCAL=/^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/;

export function sentryEnvironment(host:string):"production"|"staging"|"local"{
 const h=host.toLowerCase();
 if(LOCAL.test(h)||h.endsWith(".localhost"))return "local";
 return PRODUCTION_HOSTS.includes(h)?"production":"staging";
}

/** Browser noise that is not ours to fix. */
export const IGNORE_ERRORS:(string|RegExp)[]=[
 "ResizeObserver loop limit exceeded",
 "ResizeObserver loop completed with undelivered notifications",
 /^Non-Error promise rejection captured/,
 /Failed to fetch dynamically imported module/,
 /Load failed$/,
];
export const DENY_URLS:RegExp[]=[/^chrome-extension:\/\//,/^moz-extension:\/\//,/^safari-(web-)?extension:\/\//];

const PHONE=/(?:\+|00)?\d[\d\s-]{7,}\d/g;
/** Drop anything that could identify a shopper before an event leaves the device or Worker. */
export function scrubEvent<E extends {request?:{url?:string;cookies?:unknown;headers?:Record<string,string>;query_string?:unknown;data?:unknown};user?:unknown;message?:string}>(event:E):E{
 if(event.request){
  delete event.request.cookies;delete event.request.data;delete event.request.query_string;
  if(event.request.url)event.request.url=event.request.url.split("?")[0]??"";
  if(event.request.headers){
   const keep:Record<string,string>={};
   for(const k of ["user-agent","referer","accept-language","cf-ipcountry"]){const v=event.request.headers[k];if(v)keep[k]=k==="referer"?v.split("?")[0]??"":v;}
   event.request.headers=keep;
  }
 }
 delete event.user;
 if(event.message)event.message=event.message.replace(PHONE,"[phone]");
 return event;
}
