/**
 * Same-origin delivery for released product pictures.
 *
 * The public catalogue only ever exposes a picture id (`<uuid>.<ext>`). Browsers load
 * `/media/p/<id>` (full size) or `/media/p/360/<id>` (card size) from our own domain; the Worker
 * fetches the picture from the supplier's media host and Cloudflare keeps it at the edge.
 * Shoppers never see the supplier's host name, and the database serves no picture bytes.
 *
 * Strict shape: one fixed upstream host, uuid file names, picture extensions, two sizes.
 * Anything else is 404 — this is not an open proxy.
 */
import {readThrough,type MediaBucket,type MediaContext} from "./media-store";
export const PRODUCT_MEDIA_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|webp)$/;
export const PRODUCT_MEDIA_SIZES=[360] as const;
/** Product videos: `/media/v/<uuid>.mp4`, same rules (fixed host, uuid names, no query). Range requests pass through. */
export const PRODUCT_VIDEO_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp4$/;
export const isProductVideoId=(value:unknown):value is string=>typeof value==="string"&&PRODUCT_VIDEO_ID.test(value);
export function productVideoPath(id:string){
 if(!isProductVideoId(id))throw Error("Invalid video id");
 return `/media/v/${id}`;
}
export type ProductMediaSize=typeof PRODUCT_MEDIA_SIZES[number];
const UPSTREAM="https://media.taager.com/";

export const isProductMediaId=(value:unknown):value is string=>typeof value==="string"&&PRODUCT_MEDIA_ID.test(value);
export function productMediaPath(id:string,size?:ProductMediaSize){
 if(!isProductMediaId(id))throw Error("Invalid picture id");
 return size?`/media/p/${size}/${id}`:`/media/p/${id}`;
}

/** Upstream URL for an allowed request, or null. */
export function productUpstream(url:URL):string|null{
 if(url.search)return null;
 const parts=url.pathname.split("/");
 // ["", "media", "p", id] or ["", "media", "p", size, id]
 if(parts[1]!=="media"||parts[2]!=="p")return null;
 if(parts.length===4&&isProductMediaId(parts[3]))return UPSTREAM+parts[3];
 if(parts.length===5&&isProductMediaId(parts[4])&&(PRODUCT_MEDIA_SIZES as readonly number[]).includes(Number(parts[3]))&&String(Number(parts[3]))===parts[3])
  return `${UPSTREAM}${parts[3]}x${parts[3]}/${parts[4]}`;
 return null;
}

async function handleProductVideo(request:Request,url:URL,upstream:typeof fetch):Promise<Response>{
 if(request.method!=="GET"&&request.method!=="HEAD")return new Response(null,{status:405});
 const parts=url.pathname.split("/");
 if(url.search||parts.length!==4||!isProductVideoId(parts[3]))return new Response("Not found",{status:404});
 const range=request.headers.get("range");
 if(range&&!/^bytes=\d*-\d*$/.test(range))return new Response(null,{status:416});
 const res=await upstream(UPSTREAM+parts[3],{headers:range?{range}:{},redirect:"manual",
  ...(range?{}:{cf:{cacheEverything:true,cacheTtl:2592000}}),
 } as RequestInit);
 const type=res.headers.get("content-type")??"";
 if(res.status===404||res.status===403||(res.status>=300&&res.status<400))return new Response("Not found",{status:404});
 if((res.status!==200&&res.status!==206)||!type.startsWith("video/"))return new Response(null,{status:502});
 const headers:Record<string,string>={"content-type":type,"cache-control":"public, max-age=2592000, immutable","accept-ranges":"bytes","x-content-type-options":"nosniff"};
 for(const h of ["content-length","content-range"]){const v=res.headers.get(h);if(v)headers[h]=v;}
 return new Response(request.method==="HEAD"?null:res.body,{status:res.status,headers});
}

export async function handleProductMedia(request:Request,upstream:typeof fetch=fetch,store:{bucket:MediaBucket|null;ctx?:MediaContext}={bucket:null}):Promise<Response|null>{
 const url=new URL(request.url);
 if(url.pathname.startsWith("/media/v/"))return handleProductVideo(request,url,upstream);
 if(!url.pathname.startsWith("/media/p/"))return null;
 if(request.method!=="GET"&&request.method!=="HEAD")return new Response(null,{status:405});
 const target=productUpstream(url);
 if(!target)return new Response("Not found",{status:404});
 const a=request.headers.get("accept")??"";
 const accept=a.includes("image/webp")?"image/webp,image/*;q=0.8":"image/jpeg,image/png,image/*;q=0.8";
 // Our own copy first (R2): a picture the supplier later removes stays on the store. Key = path + negotiated format.
 const key=`product/${url.pathname.slice("/media/p/".length)}.${a.includes("image/webp")?"webp":"orig"}`;
 const got=await readThrough(store.bucket,key,async()=>{
  // Workers accept only "follow" or "manual"; a redirect from the media host is treated as missing.
  const res=await upstream(target,{headers:{accept},redirect:"manual",
   cf:{cacheEverything:true,cacheTtl:2592000,cacheKey:target+"#"+accept.split(",")[0]},
  } as RequestInit);
  return res.status===404||res.status===403||(res.status>=300&&res.status<400)?null:res;
 },store.ctx);
 if(got.status==="missing")return new Response("Not found",{status:404});
 if(got.status==="error")return new Response(null,{status:502});
 // Only our own headers go out: nothing from the upstream response identifies it.
 return new Response(request.method==="HEAD"?null:got.body,{status:200,headers:{
  "content-type":got.type,
  "cache-control":"public, max-age=2592000, immutable",
  "vary":"Accept",
  "x-content-type-options":"nosniff",
  ...(got.length?{"content-length":String(got.length)}:{}),
 }});
}
