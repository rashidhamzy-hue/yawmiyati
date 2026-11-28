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
import {MAX_STORED_VIDEO_BYTES,readThrough,type MediaBucket,type MediaContext} from "./media-store";
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

/**
 * Product video. Our own copy (R2) first, with byte ranges, so a video the supplier later removes keeps playing and
 * no shopper request depends on the supplier's host. A miss is served from the source, and the whole file is copied
 * to R2 in the background (only when the source states its length and it is within MAX_STORED_VIDEO_BYTES).
 */
async function handleProductVideo(request:Request,url:URL,upstream:typeof fetch,store:{bucket:MediaBucket|null;ctx?:MediaContext}):Promise<Response>{
 if(request.method!=="GET"&&request.method!=="HEAD")return new Response(null,{status:405});
 const parts=url.pathname.split("/");
 if(url.search||parts.length!==4||!isProductVideoId(parts[3]))return new Response("Not found",{status:404});
 const range=request.headers.get("range");
 const m=range?/^bytes=(\d*)-(\d*)$/.exec(range):null;
 if(range&&(!m||(!m[1]&&!m[2])))return new Response(null,{status:416});
 const key="video/"+parts[3];
 const base:Record<string,string>={"cache-control":"public, max-age=2592000, immutable","accept-ranges":"bytes","x-content-type-options":"nosniff"};
 if(store.bucket){
  try{
   const head=await store.bucket.get(key,{range:{offset:0,length:1}});
   if(head&&head.size>0){
    const size=head.size,type=head.httpMetadata?.contentType??"video/mp4";
    let start=0,end=size-1;
    if(m){
     if(m[1]){start=Number(m[1]);if(m[2])end=Math.min(Number(m[2]),size-1);}
     else{start=Math.max(0,size-Number(m[2]));}
     if(!(start<=end)||start>=size)return new Response(null,{status:416,headers:{"content-range":`bytes */${size}`}});
    }
    const headers={...base,"content-type":type,"content-length":String(end-start+1),"x-media-source":"own-copy",...(m?{"content-range":`bytes ${start}-${end}/${size}`}:{})};
    if(request.method==="HEAD")return new Response(null,{status:m?206:200,headers});
    const part=await store.bucket.get(key,{range:{offset:start,length:end-start+1}});
    if(part?.body)return new Response(part.body,{status:m?206:200,headers});
   }
  }catch{/* fall through to the source */}
 }
 const res=await upstream(UPSTREAM+parts[3],{headers:range?{range}:{},redirect:"manual",
  ...(range?{}:{cf:{cacheEverything:true,cacheTtl:2592000}}),
 } as RequestInit);
 const type=res.headers.get("content-type")??"";
 if(res.status===404||res.status===403||(res.status>=300&&res.status<400))return new Response("Not found",{status:404});
 if((res.status!==200&&res.status!==206)||!type.startsWith("video/"))return new Response(null,{status:502});
 if(store.bucket&&store.ctx?.waitUntil){
  const bucket=store.bucket;
  store.ctx.waitUntil((async()=>{
   try{
    const full=await upstream(UPSTREAM+parts[3],{redirect:"manual"} as RequestInit);
    const length=Number(full.headers.get("content-length")??0),t=full.headers.get("content-type")??"";
    if(full.status===200&&full.body&&t.startsWith("video/")&&length>0&&length<=MAX_STORED_VIDEO_BYTES)await bucket.put(key,full.body,{httpMetadata:{contentType:t}});
    else await full.body?.cancel();
   }catch{/* the copy is a safeguard, never a blocker */}
  })());
 }
 const headers:Record<string,string>={...base,"content-type":type,"x-media-source":"source"};
 for(const h of ["content-length","content-range"]){const v=res.headers.get(h);if(v)headers[h]=v;}
 return new Response(request.method==="HEAD"?null:res.body,{status:res.status,headers});
}

export async function handleProductMedia(request:Request,upstream:typeof fetch=fetch,store:{bucket:MediaBucket|null;ctx?:MediaContext}={bucket:null}):Promise<Response|null>{
 const url=new URL(request.url);
 if(url.pathname.startsWith("/media/v/"))return handleProductVideo(request,url,upstream,store);
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
