/**
 * Same-origin delivery for the licensed Unsplash editorial photos.
 *
 * Browsers load `/media/<photo-id>?w=&q=` from our own domain, so the hero
 * image reuses the page's connection instead of opening a new TLS connection
 * to a second host (the largest share of mobile LCP time on 26 Nov 2026).
 * The Worker fetches the same AVIF/WebP rendition from the Unsplash CDN and
 * returns it with a one-year immutable cache.
 *
 * Strict allowlist: only the eight licensed photo IDs, known widths and
 * qualities. Anything else is 404 — this is not an open proxy.
 */
import {formatOf,readThrough,type MediaBucket,type MediaContext} from "./media-store";
export const EDITORIAL_PHOTO_IDS=[
 "photo-1767720580810-58be50f89bf8","photo-1762529716272-b316f61502e7",
 "photo-1765341448915-57b22d2c53ae","photo-1778373620793-a369943bf9b3",
 "photo-1559563458-527698bf5295","photo-1675149476008-83dbfa2ee917",
 "photo-1652349566831-1b41ce15ba6c","photo-1764665818844-7cb4f51935d5",
] as const;
export const EDITORIAL_WIDTHS=[240,360,480,640,768,960,1000,1080,1200,1280,1600,1800,1920] as const;
export const EDITORIAL_QUALITIES=[62,70,78] as const;

export function editorialMediaPath(id:string,width:number,quality:number){
 return `/media/${id}?w=${width}&q=${quality}`;
}

const MEDIA=/^\/media\/(photo-\d+-[0-9a-f]+)$/;
/** Upstream URL for an allowed request, or null. */
export function editorialUpstream(url:URL):string|null{
 const m=MEDIA.exec(url.pathname);
 if(!m||!(EDITORIAL_PHOTO_IDS as readonly string[]).includes(m[1]!))return null;
 const keys=[...url.searchParams.keys()];
 if(keys.length!==2||!url.searchParams.has("w")||!url.searchParams.has("q"))return null;
 const w=Number(url.searchParams.get("w")),q=Number(url.searchParams.get("q"));
 if(!(EDITORIAL_WIDTHS as readonly number[]).includes(w)||!(EDITORIAL_QUALITIES as readonly number[]).includes(q))return null;
 return `https://images.unsplash.com/${m[1]}?auto=format&fit=crop&w=${w}&q=${q}`;
}

/** Best format this browser accepts; the upstream CDN negotiates on the same header. */
function preferredAccept(accept:string|null):string{
 const a=accept??"";
 if(a.includes("image/avif"))return "image/avif,image/webp,image/*;q=0.8";
 if(a.includes("image/webp"))return "image/webp,image/*;q=0.8";
 return "image/jpeg,image/*;q=0.8";
}

export async function handleEditorialMedia(request:Request,upstream:typeof fetch=fetch,store:{bucket:MediaBucket|null;ctx?:MediaContext}={bucket:null}):Promise<Response|null>{
 const url=new URL(request.url);
 if(!url.pathname.startsWith("/media/"))return null;
 if(request.method!=="GET"&&request.method!=="HEAD")return new Response(null,{status:405});
 const target=editorialUpstream(url);
 if(!target)return new Response("Not found",{status:404});
 const accept=preferredAccept(request.headers.get("accept"));
 // Our own copy first (R2); the photo CDN is contacted once per size and format, then never again.
 const key=`editorial/${url.pathname.slice("/media/".length)}/w${url.searchParams.get("w")}-q${url.searchParams.get("q")}.${formatOf(accept)}`;
 const got=await readThrough(store.bucket,key,()=>upstream(target,{headers:{accept},
  // Cache the upstream rendition at Cloudflare, keyed by format.
  cf:{cacheEverything:true,cacheTtl:2592000,cacheKey:target+"#"+accept.split(",")[0]},
 } as RequestInit),store.ctx);
 if(got.status==="missing"||got.status==="error")return new Response(null,{status:502});
 return new Response(request.method==="HEAD"?null:got.body,{status:200,headers:{
  "content-type":got.type,
  "cache-control":"public, max-age=31536000, immutable",
  "vary":"Accept",
  "x-content-type-options":"nosniff",
  "x-media-source":got.status==="hit"?"own-copy":"first-fetch",
  ...(got.length?{"content-length":String(got.length)}:{}),
 }});
}
