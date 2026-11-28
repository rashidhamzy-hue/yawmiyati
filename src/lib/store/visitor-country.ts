import {markets,type MarketCode} from "./markets";

/**
 * Where the visitor is, from Cloudflare's country header only. Nothing is stored: no IP address, no log line,
 * no cookie. The country is used for three things:
 *   - the root "/" sends visitors from our five countries to their store; everyone else (and search-engine and
 *     link-preview bots) gets the store chooser;
 *   - a store page tells a visitor from another of our countries, once and dismissibly, where this store delivers;
 *   - visitors from anywhere else (or an unknown country, VPN, Tor) may browse and see where we deliver.
 * Store pages are never redirected: expats order for family in another country.
 */
export const MARKET_BY_COUNTRY:Readonly<Record<string,MarketCode>>={SA:"sa",AE:"ae",OM:"om",EG:"eg",IQ:"iq"};
export const COUNTRY_BY_MARKET:Readonly<Record<MarketCode,string>>={sa:"SA",ae:"AE",om:"OM",eg:"EG",iq:"IQ"};

/** ISO country code, or null when Cloudflare does not know (XX), for Tor (T1), or off Cloudflare. */
export function countryFromRequest(request:Request):string|null{
 const raw=(request.headers.get("cf-ipcountry")??"").trim().toUpperCase();
 return /^[A-Z]{2}$/.test(raw)&&raw!=="XX"?raw:null;
}
const BOT=/bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|facebot|whatsapp|telegram|preview|lighthouse|pagespeed|gptbot|claude|perplexity|bingpreview|headless|monitor|uptime|curl\/|wget\/|python-requests|httpclient/i;
export const isBot=(userAgent:string|null):boolean=>!userAgent||BOT.test(userAgent);

/**
 * Root "/": a redirect to the visitor's own store, or null to render the store chooser.
 * The redirect is never cached and is not given to bots (they must see the chooser and its hreflang links).
 */
export function rootRedirect(request:Request):Response|null{
 const url=new URL(request.url);
 if(url.pathname!=="/"||(request.method!=="GET"&&request.method!=="HEAD"))return null;
 if(url.searchParams.has("choose")||isBot(request.headers.get("user-agent")))return null;
 const market=MARKET_BY_COUNTRY[countryFromRequest(request)??""];
 if(!market)return null;
 return new Response(null,{status:302,headers:{location:"/"+market+(url.search||""),"cache-control":"private, no-store",vary:"cf-ipcountry, user-agent"}});
}
/** `/api/visitor-country`: the two-letter country and, when it is one of ours, its store. Never cached, nothing kept. */
export function handleVisitorCountry(request:Request):Response|null{
 if(new URL(request.url).pathname!=="/api/visitor-country")return null;
 if(request.method!=="GET")return new Response(null,{status:405,headers:{allow:"GET"}});
 const country=countryFromRequest(request);
 return new Response(JSON.stringify({country,market:country?MARKET_BY_COUNTRY[country]??null:null}),{headers:{"content-type":"application/json; charset=utf-8","cache-control":"private, no-store","x-robots-tag":"noindex"}});
}

export type VisitorPlace={kind:"same"}|{kind:"other_store";market:MarketCode}|{kind:"elsewhere"};
/** What a store should tell this visitor. Unknown country is treated like "elsewhere": a note, never a block. */
export function visitorPlace(store:MarketCode,country:string|null):VisitorPlace{
 const own=country?MARKET_BY_COUNTRY[country]:undefined;
 if(own===store)return {kind:"same"};
 return own?{kind:"other_store",market:own}:{kind:"elsewhere"};
}
/**
 * Where "your store" should lead from the current page: the same section, offers or search page when it exists in
 * every store; a search for the product's name from a product page (slugs differ per market); else that store's home.
 */
export function sameSpotIn(target:MarketCode,pathname:string,productTitle?:string|null):string{
 const m=/^\/(sa|ae|om|eg|iq)(\/.*)?$/.exec(pathname),rest=m?.[2]??"";
 if(/^\/c\/[a-z-]+$/.test(rest)||rest==="/offers"||rest==="/search"||rest==="/story"||/^\/info\/[a-z-]+$/.test(rest))return "/"+target+rest;
 if(/^\/(p|set)\//.test(rest)&&productTitle&&productTitle.trim())return "/"+target+"/search?q="+encodeURIComponent(productTitle.trim().slice(0,80));
 return "/"+target;
}
/** The other store a typed number belongs to (it starts with that country's code), else null. */
export function phoneFromOtherMarket(store:MarketCode,raw:string):MarketCode|null{
 const d=raw.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x0660)).replace(/[\s\-()]/g,"");
 const intl=d.startsWith("+")?d.slice(1):d.startsWith("00")?d.slice(2):null;
 if(!intl)return null;
 for(const m of Object.keys(markets) as MarketCode[]){
  const code=markets[m].dialingCode.slice(1);
  if(m!==store&&intl.startsWith(code)&&!intl.startsWith(markets[store].dialingCode.slice(1)))return m;
 }
 return null;
}
