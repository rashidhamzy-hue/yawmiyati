import {describe,expect,it,vi} from "vitest";
import {formatOf,mediaBucket,readThrough,type MediaBucket} from "../lib/store/media-store";
import {handleEditorialMedia,EDITORIAL_PHOTO_IDS} from "../lib/store/editorial-media";
import {handleProductMedia} from "../lib/store/product-media";

function fakeBucket(){
 const files=new Map<string,{bytes:ArrayBuffer;type:string}>();
 const bucket:MediaBucket={
  async get(key){const f=files.get(key);return f?{body:new Response(f.bytes).body,size:f.bytes.byteLength,httpMetadata:{contentType:f.type}}:null;},
  async put(key,value,o){files.set(key,{bytes:value,type:o?.httpMetadata?.contentType??""});},
 };
 return {bucket,files};
}
const image=(type="image/webp",size=1200)=>new Response(new Uint8Array(size),{headers:{"content-type":type}});
const ID="11111111-2222-3333-4444-555555555555.jpg";

describe("our own media copies (R2 read-through)",()=>{
 it("fetches a picture from its source once, keeps a copy, and serves the copy from then on",async()=>{
  const {bucket,files}=fakeBucket(),pending:Promise<unknown>[]=[];
  const upstream=vi.fn(async()=>image()) as unknown as typeof fetch;
  const req=()=>new Request("https://yawmiyati.shop/media/p/360/"+ID,{headers:{accept:"image/webp,*/*"}});
  const first=await handleProductMedia(req(),upstream,{bucket,ctx:{waitUntil:p=>{pending.push(p);}}});
  expect(first!.status).toBe(200);expect(first!.headers.get("content-type")).toBe("image/webp");expect((await first!.arrayBuffer()).byteLength).toBe(1200);
  await Promise.all(pending);
  expect([...files.keys()]).toEqual(["product/360/"+ID+".webp"]);
  const second=await handleProductMedia(req(),upstream,{bucket});
  expect(second!.status).toBe(200);expect((await second!.arrayBuffer()).byteLength).toBe(1200);
  expect(upstream).toHaveBeenCalledTimes(1); // the supplier's host was contacted once only
  // A different format is its own copy; nothing identifies the source in the response.
  await handleProductMedia(new Request("https://yawmiyati.shop/media/p/360/"+ID,{headers:{accept:"image/jpeg"}}),upstream,{bucket});
  expect(upstream).toHaveBeenCalledTimes(2);
  expect([...second!.headers.keys()].sort()).toEqual(["cache-control","content-length","content-type","vary","x-content-type-options"]);
 });
 it("keeps serving a product picture after the supplier removes it, and still answers 404 for one we never had",async()=>{
  const {bucket}=fakeBucket();let gone=false;
  const upstream=vi.fn(async()=>gone?new Response(null,{status:404}):image("image/jpeg")) as unknown as typeof fetch;
  const req=(id:string)=>new Request("https://yawmiyati.shop/media/p/"+id,{headers:{accept:"image/jpeg"}});
  await (await handleProductMedia(req(ID),upstream,{bucket}))!.arrayBuffer();
  await new Promise(r=>setTimeout(r,0));gone=true;
  expect((await handleProductMedia(req(ID),upstream,{bucket}))!.status).toBe(200);
  expect((await handleProductMedia(req("aaaaaaaa-2222-3333-4444-555555555555.jpg"),upstream,{bucket}))!.status).toBe(404);
 });
 it("the lifestyle photographs are copied per size and format; the allowlist still decides what may be asked for",async()=>{
  const {bucket,files}=fakeBucket();
  const upstream=vi.fn(async()=>image("image/avif",5000)) as unknown as typeof fetch;
  const url="https://yawmiyati.shop/media/"+EDITORIAL_PHOTO_IDS[0]+"?w=640&q=62";
  const a=await handleEditorialMedia(new Request(url,{headers:{accept:"image/avif,image/webp"}}),upstream,{bucket});
  expect(a!.headers.get("x-media-source")).toBe("first-fetch");await a!.arrayBuffer();await new Promise(r=>setTimeout(r,0));
  expect([...files.keys()]).toEqual(["editorial/"+EDITORIAL_PHOTO_IDS[0]+"/w640-q62.avif"]);
  const b=await handleEditorialMedia(new Request(url,{headers:{accept:"image/avif,image/webp"}}),upstream,{bucket});
  expect(b!.headers.get("x-media-source")).toBe("own-copy");expect(upstream).toHaveBeenCalledTimes(1);
  expect((await handleEditorialMedia(new Request("https://yawmiyati.shop/media/photo-999-abc?w=640&q=62"),upstream,{bucket}))!.status).toBe(404);
  expect((await handleEditorialMedia(new Request(url.replace("w=640","w=641")),upstream,{bucket}))!.status).toBe(404);
  expect(upstream).toHaveBeenCalledTimes(1);
 });
 it("works without the bucket, survives an R2 outage, never stores a non-image or an oversized file",async()=>{
  const plain=await readThrough(null,"k",async()=>image());
  expect(plain.status).toBe("source");
  const broken:MediaBucket={get:async()=>{throw Error("r2 down");},put:async()=>{throw Error("r2 down");}};
  expect((await readThrough(broken,"k",async()=>image())).status).toBe("stored");
  const {bucket,files}=fakeBucket();
  expect((await readThrough(bucket,"html",async()=>new Response("<html>",{headers:{"content-type":"text/html"}}))).status).toBe("error");
  expect((await readThrough(bucket,"big",async()=>image("image/jpeg",9*1024*1024))).status).toBe("stored");
  expect((await readThrough(bucket,"none",async()=>null)).status).toBe("missing");
  await new Promise(r=>setTimeout(r,0));expect(files.size).toBe(0);
  expect(mediaBucket({MEDIA:bucket})).toBe(bucket);expect(mediaBucket({})).toBeNull();expect(mediaBucket(undefined)).toBeNull();
  expect([formatOf("image/avif,image/webp"),formatOf("image/webp,image/*;q=0.8"),formatOf("image/jpeg,image/*")]).toEqual(["avif","webp","jpg"]);
 });
});
