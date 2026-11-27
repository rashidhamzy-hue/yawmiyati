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
export const PRODUCT_MEDIA_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|webp)$/;
export const PRODUCT_MEDIA_SIZES=[360] as const;
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

export async function handleProductMedia(request:Request,upstream:typeof fetch=fetch):Promise<Response|null>{
 const url=new URL(request.url);
 if(!url.pathname.startsWith("/media/p/"))return null;
 if(request.method!=="GET"&&request.method!=="HEAD")return new Response(null,{status:405});
 const target=productUpstream(url);
 if(!target)return new Response("Not found",{status:404});
 const a=request.headers.get("accept")??"";
 const accept=a.includes("image/webp")?"image/webp,image/*;q=0.8":"image/jpeg,image/png,image/*;q=0.8";
 const res=await upstream(target,{headers:{accept},redirect:"error",
  cf:{cacheEverything:true,cacheTtl:2592000,cacheKey:target+"#"+accept.split(",")[0]},
 } as RequestInit);
 const type=res.headers.get("content-type")??"";
 if(res.status===404||res.status===403)return new Response("Not found",{status:404});
 if(!res.ok||!type.startsWith("image/"))return new Response(null,{status:502});
 // Only our own headers go out: nothing from the upstream response identifies it.
 return new Response(request.method==="HEAD"?null:res.body,{status:200,headers:{
  "content-type":type,
  "cache-control":"public, max-age=2592000, immutable",
  "vary":"Accept",
  "x-content-type-options":"nosniff",
  ...(res.headers.get("content-length")?{"content-length":res.headers.get("content-length")!}:{}),
 }});
}
