/**
 * Our own copies of store media in Cloudflare R2 (bucket `yawmiyati`, private; binding MEDIA on the storefront Worker).
 *
 * Read-through: a picture is served from R2 when we already hold it; otherwise it is fetched once from its source
 * (the licensed photo CDN for the seven lifestyle photographs, the supplier's media host for product pictures),
 * stored in R2 in the background, and served. From then on the source is never contacted again for that file, so:
 *   - the hero photograph no longer waits on a third-party CDN (the largest share of mobile LCP);
 *   - a product picture the supplier later deletes stays on our store;
 *   - the edge cache (30 days to a year) sits in front of both.
 * Without the binding (local runs, tests, an unbound preview) everything works as before, straight from the source.
 * Keys are built only from values the strict allowlists already validated: this is never an open store.
 */
export type MediaObject={body:ReadableStream|null;size:number;httpMetadata?:{contentType?:string}};
export type MediaBucket={get(key:string):Promise<MediaObject|null>;put(key:string,value:ArrayBuffer,options?:{httpMetadata?:{contentType?:string}}):Promise<unknown>};
export type MediaContext={waitUntil?:(promise:Promise<unknown>)=>void};
export const MAX_STORED_BYTES=8*1024*1024;
const EXT:Record<string,string>={"image/avif":"avif","image/webp":"webp","image/jpeg":"jpg","image/png":"png"};

export function mediaBucket(env:unknown):MediaBucket|null{
 const b=env&&typeof env==="object"?(env as {MEDIA?:unknown}).MEDIA:null;
 return b&&typeof (b as MediaBucket).get==="function"&&typeof (b as MediaBucket).put==="function"?b as MediaBucket:null;
}
/** The format part of a key from the Accept header the handler already normalised ("image/webp,image/*;q=0.8" -> "webp"). */
export const formatOf=(accept:string):string=>EXT[accept.split(",")[0]!.trim()]??"jpg";

export type Loaded={status:"hit"|"stored"|"source";body:ReadableStream|ArrayBuffer|null;type:string;length:number|null}|{status:"missing"}|{status:"error"};
/**
 * Serve `key` from R2, or load it with `load` (which must return an image response), keep a copy, and serve that.
 * `load` decides what "missing" means by returning null; any other failure is "error".
 */
export async function readThrough(bucket:MediaBucket|null,key:string,load:()=>Promise<Response|null>,ctx?:MediaContext):Promise<Loaded>{
 if(bucket){
  try{
   const hit=await bucket.get(key);
   const type=hit?.httpMetadata?.contentType??"";
   if(hit&&hit.body&&type.startsWith("image/"))return {status:"hit",body:hit.body,type,length:hit.size};
  }catch{/* R2 unavailable: fall through to the source */}
 }
 let res:Response|null;
 try{res=await load();}catch{return {status:"error"};}
 if(res===null)return {status:"missing"};
 const type=res.headers.get("content-type")??"";
 if(!res.ok||!type.startsWith("image/"))return {status:"error"};
 if(!bucket)return {status:"source",body:res.body,type,length:res.headers.get("content-length")?Number(res.headers.get("content-length")):null};
 const bytes=await res.arrayBuffer();
 if(bytes.byteLength>0&&bytes.byteLength<=MAX_STORED_BYTES){
  const save=bucket.put(key,bytes,{httpMetadata:{contentType:type}}).catch(()=>undefined);
  if(ctx?.waitUntil)ctx.waitUntil(save);else void save;
 }
 return {status:"stored",body:bytes,type,length:bytes.byteLength};
}
