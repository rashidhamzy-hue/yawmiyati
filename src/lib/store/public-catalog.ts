import {markets,type MarketCode} from "./markets";
import {isProductMediaId,isProductVideoId} from "./product-media";
export const PUBLIC_CATEGORY_SLUGS=["home","kitchen","beauty","fashion","wellness","organize"] as const;
export type PublicCategorySlug=typeof PUBLIC_CATEGORY_SLUGS[number];
export type PublicListing={listing_id:string;slug:string;title:string;price_minor:string;currency:string;
 /** Present only after category membership is owner-approved in a release-gated RPC. */
 approved_category_slugs?:readonly PublicCategorySlug[];
 /** Optional owner-approved ranking derived from verified market activity; never inferred from views. */
 popularity_rank?:number;
 /** Picture id of the first released picture; served from /media/p/. */
 image?:string;
 /** Brain merchandising order inside the market (1 = strongest pick). Never a sales claim. */
 rank?:number;
 /** "bundle" only for a supplier-declared bundle whose contents are known. */
 kind?:"bundle";
 /** True when an owner-approved quantity offer exists for this listing. */
 offer?:boolean};
export function parsePublicListings(data:unknown,market:MarketCode):PublicListing[]{
 if(!Array.isArray(data)||data.length>100)throw Error("Invalid catalog response");
 const seen=new Set<string>();
 return data.map(raw=>{
  if(!raw||typeof raw!=="object")throw Error("Invalid listing");
  const r=raw as Record<string,unknown>;
  if(typeof r.listing_id!=="string"||!r.listing_id||typeof r.slug!=="string"||!r.slug||r.slug.length>200||/[/?#\\]/.test(r.slug)||typeof r.title!=="string"||!r.title.trim()||r.title.length>500||typeof r.price_minor!=="string"||!/^\d+$/.test(r.price_minor)||!Number.isSafeInteger(Number(r.price_minor))||Number(r.price_minor)<=0||r.currency!==markets[market].currency||seen.has(r.slug))throw Error("Invalid listing");
  seen.add(r.slug);
  const declared=(r.approved_category_slugs!==undefined&&r.approved_category_slugs!==null)||(r.category_release!==undefined&&r.category_release!==null);
  if(r.image!==undefined&&r.image!==null&&!isProductMediaId(r.image))throw Error("Invalid listing picture");
  const categories=r.approved_category_slugs;
  if(declared&&(
   r.category_release!=="owner_approved"||!Array.isArray(categories)||categories.length>PUBLIC_CATEGORY_SLUGS.length||
   categories.some(value=>typeof value!=="string"||!PUBLIC_CATEGORY_SLUGS.some(allowed=>allowed===value))||
   new Set(categories).size!==categories.length
  ))throw Error("Unapproved or invalid category assignments");
  if(r.popularity_rank!==undefined&&(!Number.isSafeInteger(r.popularity_rank)||Number(r.popularity_rank)<1))throw Error("Invalid popularity rank");
  if(r.rank!==undefined&&r.rank!==null&&(!Number.isSafeInteger(r.rank)||Number(r.rank)<1))throw Error("Invalid merchandising rank");
  if(r.kind!==undefined&&r.kind!==null&&r.kind!=="bundle")throw Error("Invalid listing kind");
  if(r.offer!==undefined&&r.offer!==null&&typeof r.offer!=="boolean")throw Error("Invalid offer flag");
  return {listing_id:r.listing_id,slug:r.slug,title:r.title,price_minor:r.price_minor,currency:r.currency,
    ...(declared?{approved_category_slugs:[...(categories as PublicCategorySlug[])]}:{}),
    ...(r.popularity_rank!==undefined?{popularity_rank:r.popularity_rank as number}:{}),
    ...(typeof r.image==="string"?{image:r.image}:{}),
    ...(typeof r.rank==="number"?{rank:r.rank}:{}),...(r.kind==="bundle"?{kind:"bundle" as const}:{}),...(r.offer===true?{offer:true}:{})};
 });
}
export const storefrontMode=(origin:unknown,key:unknown,demo:unknown)=>typeof origin==="string"&&origin&&typeof key==="string"&&key?"catalog":!origin&&!key&&demo==="true"?"demo":"unconfigured";
/** Exact localized display: never coerce a multi-digit minor-unit amount to a float. */
export function formatListingPrice(row:PublicListing,market:MarketCode){
 const info=markets[market];
 if(row.currency!==info.currency)throw Error("Currency mismatch");
 if(typeof row.price_minor!=="string"||!/^\d+$/.test(row.price_minor)||row.price_minor.length>100||BigInt(row.price_minor)<=0n)
  throw Error("Invalid public listing amount");
 const digits=info.minorDigits;
 const unit=10n**BigInt(digits);
 const amount=BigInt(row.price_minor);
 const whole=amount/unit,minor=amount%unit;
 const formatter=new Intl.NumberFormat(info.locale,{style:"currency",currency:info.currency,minimumFractionDigits:0,maximumFractionDigits:0});
 const pieces=formatter.formatToParts(whole);
 if(digits===0)return pieces.map(part=>part.value).join("");
 const decimal=new Intl.NumberFormat(info.locale).formatToParts(1.1).find(part=>part.type==="decimal")?.value??".";
 const fractional=new Intl.NumberFormat(info.locale,{useGrouping:false,minimumIntegerDigits:digits,maximumFractionDigits:0}).format(Number(minor));
 let lastInteger=-1;
 pieces.forEach((part,i)=>{if(part.type==="integer"||part.type==="group")lastInteger=i;});
 if(lastInteger<0)throw Error("Currency formatting unavailable");
 return pieces.map((part,i)=>part.value+(i===lastInteger?decimal+fractional:"")).join("");
}
/** Compact shopper price: whole amounts drop the empty fraction ("٢٢٥ ر.س."), exact otherwise. */
export function formatPrice(priceMinor:string|bigint|number,market:MarketCode){
 const info=markets[market],amount=BigInt(priceMinor),unit=10n**BigInt(info.minorDigits);
 if(amount<0n)throw Error("Invalid amount");
 if(amount%unit!==0n)return formatListingPrice({listing_id:"-",slug:"-",title:"-",price_minor:amount.toString(),currency:info.currency},market);
 return new Intl.NumberFormat(info.locale,{style:"currency",currency:info.currency,minimumFractionDigits:0,maximumFractionDigits:0}).format(amount/unit);
}
// Coalesce concurrent reads only. Never cache released inventory across requests.
const pendingCatalogs=new Map<string,Promise<PublicListing[]>>();
export async function fetchPublicCatalog(origin:string,key:string,market:MarketCode,request:typeof fetch=fetch):Promise<PublicListing[]>{
 if(request!==fetch)return readPublicCatalog(origin,key,market,request);
 const id=JSON.stringify([origin,key,market]);
 const existing=pendingCatalogs.get(id);
 if(existing)return existing;
 const pending=readPublicCatalog(origin,key,market,request);
 pendingCatalogs.set(id,pending);
 try{return await pending;}finally{if(pendingCatalogs.get(id)===pending)pendingCatalogs.delete(id);}
}
async function readPublicCatalog(origin:string,key:string,market:MarketCode,request:typeof fetch):Promise<PublicListing[]>{
 const url=new URL(origin);
 if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash||!key)throw Error("Invalid catalog configuration");
 const all:PublicListing[]=[];
 const seen=new Set<string>();
 for(let offset=0;offset<1000;offset+=100){
  const response=await request(new URL("/rest/v1/rpc/public_catalog",url),{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({p_store:market,p_limit:100,p_offset:offset}),redirect:"error",signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error("Catalog unavailable");
  const rows=parsePublicListings(await response.json(),market);
  for(const row of rows){if(seen.has(row.slug))throw Error("Catalog changed during pagination");seen.add(row.slug);all.push(row);}
  if(rows.length<100)return all;
 }
 throw Error("Catalog exceeds preview limit");
}

export type PublicDetail=PublicListing&{description:string};
export function parsePublicDetail(data:unknown,market:MarketCode,requestedSlug:string):PublicDetail|null{
 if(!Array.isArray(data)||data.length>1)throw Error("Invalid detail response");
 if(!data.length)return null;
 const row=data[0];
 const [listing]=parsePublicListings([row],market);
 if(listing.slug!==requestedSlug||typeof row.description!=="string"||row.description.length>10000)throw Error("Invalid detail response");
 return {...listing,description:row.description};
}
export async function fetchPublicDetail(origin:string,key:string,market:MarketCode,slug:string,request:typeof fetch=fetch):Promise<PublicDetail|null>{
 if(typeof slug!=="string"||!slug||slug.length>200||/[/?#\\]/.test(slug))throw Error("Invalid product slug");
 const url=new URL(origin);
 if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash||!key)throw Error("Invalid catalog configuration");
 const response=await request(new URL("/rest/v1/rpc/public_catalog_detail",url),{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({p_store:market,p_slug:slug}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error("Product unavailable");
 return parsePublicDetail(await response.json(),market,slug);
}

/** Search approved public product titles/descriptions on server. The returned rows obey current_catalog_release. */
export async function fetchPublicSearch(origin:string,key:string,market:MarketCode,query:string,request:typeof fetch=fetch):Promise<PublicListing[]>{
 if(query.trim().length<2||query.length>120)return [];
 const url=new URL(origin);
 if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash||!key)throw Error("Invalid search configuration");
 const response=await request(new URL("/rest/v1/rpc/public_catalog_search",url),{
  method:"POST",headers:{apikey:key,"Content-Type":"application/json"},
  body:JSON.stringify({p_store:market,p_query:query.trim(),p_limit:40}),
  cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)
 });
 if(!response.ok)throw Error("Search temporarily unavailable");
 const body=await response.json();
 if(!Array.isArray(body)||body.length>60)throw Error("Invalid search response");
 return parsePublicListings(body,market);
}

/** The owner-approved page of one released listing (public_product_page). Customer-safe fields only. */
export type PublicProductPage={listing_id:string;category:PublicCategorySlug|null;
 title:string;subtitle:string;description:string;bullets:string[];
 specs:{label:string;value:string}[];faq:{q:string;a:string}[];
 seo:{title:string;description:string};images:{id:string;alt:string}[];
 videos:string[];
 /** Brain-built "N for X" offers, already re-checked against the supplier's current cost by the database. */
 quantity_offers:{quantity:number;price_minor:number}[];
 /** What a bundle contains, from the supplier's declared bundle items only. */
 bundle:{name:string;quantity:number;image:string|null}[];
 /** "low" only when the supplier itself reports low quantity for this product right now. Never invented. */
 stock_signal:"low"|null};
const text=(v:unknown,max:number)=>typeof v==="string"?v.trim().slice(0,max):"";
const list=(v:unknown,max:number)=>Array.isArray(v)?v.slice(0,max):[];
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
/** Null when the response is not a released page for exactly this listing and market. */
export function parsePublicProductPage(data:unknown,market:MarketCode,listingId:string):PublicProductPage|null{
 if(!record(data)||data.release!=="public_approved"||data.market!==market||data.listing_id!==listingId||!record(data.page))return null;
 const p=data.page,seo=record(p.seo)?p.seo:{};
 const title=text(p.title,500),description=text(p.description,10000);
 if(!title||!description)return null;
 const seen=new Set<string>();
 const images=list(data.images,12).filter(record).filter(i=>isProductMediaId(i.id)&&!seen.has(i.id as string)&&!!seen.add(i.id as string))
  .map(i=>({id:i.id as string,alt:text(i.alt,180)||title}));
 return {listing_id:listingId,category:PUBLIC_CATEGORY_SLUGS.find(c=>c===data.category)??null,
  title,subtitle:text(p.subtitle,200),description,
  bullets:list(p.bullets,6).map(b=>text(b,200)).filter(Boolean),
  specs:list(p.specs,12).filter(record).map(s=>({label:text(s.label,60),value:text(s.value,160)})).filter(s=>s.label&&s.value),
  faq:list(p.faq,5).filter(record).map(f=>({q:text(f.q,160),a:text(f.a,400)})).filter(f=>f.q&&f.a),
  seo:{title:text(seo.title,70),description:text(seo.description,170)},images,
  videos:[...new Set(list(data.videos,3).filter(isProductVideoId))],
  quantity_offers:list(data.quantity_offers,4).filter(record)
   .filter(q=>Number.isInteger(q.quantity)&&(q.quantity as number)>=2&&(q.quantity as number)<=5&&Number.isSafeInteger(q.price_minor)&&(q.price_minor as number)>0)
   .map(q=>({quantity:q.quantity as number,price_minor:q.price_minor as number})),
  bundle:list(data.bundle,12).filter(record).filter(b=>text(b.name,160)&&Number.isInteger(b.quantity)&&(b.quantity as number)>=1&&(b.quantity as number)<=50)
   .map(b=>({name:text(b.name,160),quantity:b.quantity as number,image:isProductMediaId(b.image)?b.image as string:null})),
  stock_signal:data.stock_signal==="low"?"low":null};
}
export async function fetchPublicProductPage(origin:string,key:string,market:MarketCode,slug:string,listingId:string,request:typeof fetch=fetch):Promise<PublicProductPage|null>{
 if(typeof slug!=="string"||!slug||slug.length>200||/[/?#\\]/.test(slug))throw Error("Invalid product slug");
 const url=new URL(origin);
 if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash||!key)throw Error("Invalid catalog configuration");
 const response=await request(new URL("/rest/v1/rpc/public_product_page",url),{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({p_store:market,p_slug:slug}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error("Product page unavailable");
 return parsePublicProductPage(await response.json(),market,listingId);
}
