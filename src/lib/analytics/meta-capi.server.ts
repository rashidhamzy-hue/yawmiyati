/**
 * Server half of the Meta events: POST /api/meta-events → Meta's Conversions API.
 * Accepts only the six standard events with a product slug and a value, from our own pages, and forwards them with the
 * SAME event id the browser Pixel used (Meta deduplicates on event name + event id). Without the two Worker secrets
 * (META_PIXEL_ID, META_CAPI_TOKEN) it answers 204 and sends nothing. No name, phone, email or address is handled here;
 * the browser's _fbp/_fbc cookies are forwarded only because the visitor accepted analytics before the Pixel set them.
 */
import {markets,type MarketCode} from "@/lib/store/markets";

const NAMES=new Set(["PageView","ViewContent","AddToCart","InitiateCheckout","Purchase","Search"]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,SLUG=/^[a-z0-9][a-z0-9-]{1,159}$/;
type Rec=Record<string,unknown>;
const cookie=(header:string|null,name:string)=>{const m=new RegExp("(?:^|;\\s*)"+name+"=([^;]{1,200})").exec(header??"");return m?m[1]:undefined;};

export type CapiEnv={META_PIXEL_ID?:string;META_CAPI_TOKEN?:string;META_TEST_EVENT_CODE?:string};
/** The Conversions API payload for one validated browser event, or null when the event is not acceptable. */
export function capiPayload(body:unknown,request:Request,now=Date.now()):Rec|null{
 if(!body||typeof body!=="object")return null;
 const b=body as Rec,p=(b.params&&typeof b.params==="object"?b.params:{}) as Rec;
 if(typeof b.name!=="string"||!NAMES.has(b.name)||typeof b.event_id!=="string"||!UUID.test(b.event_id))return null;
 if(typeof b.market!=="string"||!Object.hasOwn(markets,b.market))return null;
 const market=b.market as MarketCode,host=new URL(request.url).host;
 let url:URL;
 try{url=new URL(String(b.url));}catch{return null;}
 if(url.host!==host||!url.pathname.startsWith("/"+market))return null; // only our own pages of that market
 const ids=(Array.isArray(p.content_ids)?p.content_ids:[]).filter((s):s is string=>typeof s==="string"&&SLUG.test(s)).slice(0,20);
 const value=typeof p.value==="number"&&Number.isFinite(p.value)&&p.value>=0&&p.value<1e7?p.value:undefined;
 const custom:Rec={market};
 if(ids.length){custom.content_ids=ids;custom.content_type="product";}
 if(value!==undefined){custom.value=value;custom.currency=markets[market].currency;}
 if(typeof p.num_items==="number"&&Number.isInteger(p.num_items)&&p.num_items>0&&p.num_items<1000)custom.num_items=p.num_items;
 if(b.name==="Search"&&typeof p.search_string==="string")custom.search_string=p.search_string.slice(0,80);
 const user:Rec={client_user_agent:(request.headers.get("user-agent")??"").slice(0,400)};
 const ip=request.headers.get("cf-connecting-ip");if(ip)user.client_ip_address=ip;
 const fbp=cookie(request.headers.get("cookie"),"_fbp"),fbc=cookie(request.headers.get("cookie"),"_fbc");
 if(fbp)user.fbp=fbp;if(fbc)user.fbc=fbc;
 return {event_name:b.name,event_time:Math.floor(now/1000),event_id:b.event_id,action_source:"website",event_source_url:url.origin+url.pathname,user_data:user,custom_data:custom};
}

export async function handleMetaEvents(request:Request,env:CapiEnv,send:typeof fetch=fetch):Promise<Response|null>{
 if(new URL(request.url).pathname!=="/api/meta-events")return null;
 if(request.method!=="POST")return new Response(null,{status:405});
 const origin=request.headers.get("origin");
 if(origin&&new URL(origin).host!==new URL(request.url).host)return new Response(null,{status:403});
 if(Number(request.headers.get("content-length")??"0")>4000)return new Response(null,{status:413});
 let body:unknown;
 try{body=JSON.parse((await request.text()).slice(0,4000));}catch{return new Response(null,{status:400});}
 const event=capiPayload(body,request);
 if(!event)return new Response(null,{status:400});
 if(!env.META_PIXEL_ID||!/^\d{8,20}$/.test(env.META_PIXEL_ID)||!env.META_CAPI_TOKEN)return new Response(null,{status:204,headers:{"x-meta-capi":"not-configured"}});
 try{
  await send(`https://graph.facebook.com/v21.0/${env.META_PIXEL_ID}/events`,{method:"POST",headers:{"content-type":"application/json"},signal:AbortSignal.timeout(4000),
   body:JSON.stringify({data:[event],access_token:env.META_CAPI_TOKEN,...(env.META_TEST_EVENT_CODE?{test_event_code:env.META_TEST_EVENT_CODE}:{})})});
 }catch{/* measuring never fails a page */}
 return new Response(null,{status:204,headers:{"x-meta-capi":"sent"}});
}
