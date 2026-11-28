import {describe,expect,it,vi} from "vitest";
import {handleProductMedia,productMediaPath,productUpstream,isProductMediaId} from "@/lib/store/product-media";

const id="11111111-2222-3333-4444-555555555555.jpg";
describe("product pictures",()=>{
 it("builds same-origin paths only for picture ids",()=>{
  expect(productMediaPath(id)).toBe("/media/p/"+id);
  expect(productMediaPath(id,360)).toBe("/media/p/360/"+id);
  for(const bad of ["x.jpg","../"+id,id+"?w=1","11111111-2222-3333-4444-555555555555.mp4","11111111-2222-3333-4444-555555555555.svg",id.toUpperCase()])
   {expect(isProductMediaId(bad)).toBe(false);expect(()=>productMediaPath(bad)).toThrow();}
 });
 it("maps only the fixed host, two sizes and no query",()=>{
  const u=(p:string)=>productUpstream(new URL("https://shop.example"+p));
  expect(u("/media/p/"+id)).toBe("https://media.taager.com/"+id);
  expect(u("/media/p/360/"+id)).toBe("https://media.taager.com/360x360/"+id);
  for(const bad of ["/media/p/100/"+id,"/media/p/0360/"+id,"/media/p/360/360/"+id,"/media/p/"+id+"/x","/media/p/"+id+"?u=https://evil.example","/media/p/%2e%2e/"+id,"/media/p/x.jpg","/media/photo-1-a"])
   expect(u(bad)).toBeNull();
 });
 it("serves a cached picture with our own headers only",async()=>{
  const upstream=vi.fn(async()=>new Response("img",{status:200,headers:{"content-type":"image/webp","server":"Google Frontend","x-goog-meta":"taager","set-cookie":"a=b"}}));
  const res=await handleProductMedia(new Request("https://shop.example/media/p/360/"+id,{headers:{accept:"image/avif,image/webp"}}),upstream as unknown as typeof fetch);
  expect(res!.status).toBe(200);
  expect(await res!.text()).toBe("img");
  expect([...res!.headers.keys()].sort()).toEqual(["cache-control","content-type","vary","x-content-type-options"]);
  expect(res!.headers.get("cache-control")).toContain("immutable");
  expect(upstream.mock.calls[0]![0]).toBe("https://media.taager.com/360x360/"+id);
  expect((upstream.mock.calls[0] as unknown as [string,RequestInit])[1].redirect).toBe("manual");
  const moved=vi.fn(async()=>new Response(null,{status:302,headers:{location:"https://elsewhere.example/x"}}));
  expect((await handleProductMedia(new Request("https://shop.example/media/p/"+id),moved as unknown as typeof fetch))!.status).toBe(404);
 });
 it("refuses other methods, unknown paths and non-pictures",async()=>{
  const never=vi.fn();
  expect((await handleProductMedia(new Request("https://shop.example/media/p/"+id,{method:"POST"}),never as unknown as typeof fetch))!.status).toBe(405);
  expect((await handleProductMedia(new Request("https://shop.example/media/p/nope.jpg"),never as unknown as typeof fetch))!.status).toBe(404);
  expect(never).not.toHaveBeenCalled();
  expect(await handleProductMedia(new Request("https://shop.example/media/photo-1-a")) ).toBeNull();
  const html=vi.fn(async()=>new Response("<html>",{status:200,headers:{"content-type":"text/html"}}));
  expect((await handleProductMedia(new Request("https://shop.example/media/p/"+id),html as unknown as typeof fetch))!.status).toBe(502);
  const gone=vi.fn(async()=>new Response("no",{status:403}));
  expect((await handleProductMedia(new Request("https://shop.example/media/p/"+id),gone as unknown as typeof fetch))!.status).toBe(404);
 });
});

describe("product videos",()=>{
 const vid="aaaaaaaa-1111-2222-3333-444444444444.mp4";
 it("streams supplier videos with range support and our own headers only",async()=>{
  const upstream=vi.fn(async()=>new Response("part",{status:206,headers:{"content-type":"video/mp4","content-range":"bytes 0-3/100","content-length":"4","server":"Google Frontend"}}));
  const res=await handleProductMedia(new Request("https://shop.example/media/v/"+vid,{headers:{range:"bytes=0-3"}}),upstream as unknown as typeof fetch);
  expect(res!.status).toBe(206);expect(res!.headers.get("content-range")).toBe("bytes 0-3/100");expect(res!.headers.get("server")).toBeNull();
  const [target,init]=upstream.mock.calls[0] as unknown as [string,RequestInit];
  expect(target).toBe("https://media.taager.com/"+vid);expect((init.headers as Record<string,string>).range).toBe("bytes=0-3");
 });
 it("refuses other names, sizes, queries, bad ranges and non-video answers",async()=>{
  const never=vi.fn();
  for(const bad of ["/media/v/x.mp4","/media/v/360/"+vid,"/media/v/"+vid+"?a=1","/media/v/aaaaaaaa-1111-2222-3333-444444444444.mov"])
   expect((await handleProductMedia(new Request("https://shop.example"+bad),never as unknown as typeof fetch))!.status).toBe(404);
  expect((await handleProductMedia(new Request("https://shop.example/media/v/"+vid,{headers:{range:"bytes=0-1,5-9"}}),never as unknown as typeof fetch))!.status).toBe(416);
  expect(never).not.toHaveBeenCalled();
  const html=vi.fn(async()=>new Response("<html>",{status:200,headers:{"content-type":"text/html"}}));
  expect((await handleProductMedia(new Request("https://shop.example/media/v/"+vid),html as unknown as typeof fetch))!.status).toBe(502);
 });
});
describe("product videos kept on our own storage (R2)",()=>{
 const vid="aaaaaaaa-1111-2222-3333-444444444444.mp4";
 const bytes=new Uint8Array(Array.from({length:10},(_,i)=>i));
 function bucket(){
  const held=new Map<string,{data:Uint8Array;type:string}>();
  return {held,
   get:async(key:string,o?:{range?:{offset:number;length?:number}})=>{const h=held.get(key);if(!h)return null;const off=o?.range?.offset??0,len=o?.range?.length??h.data.length-off;
    return {body:new Response(h.data.slice(off,off+len)).body,size:h.data.length,httpMetadata:{contentType:h.type}};},
   put:async(key:string,value:ArrayBuffer|ReadableStream,o?:{httpMetadata?:{contentType?:string}})=>{held.set(key,{data:new Uint8Array(await new Response(value as BodyInit).arrayBuffer()),type:o?.httpMetadata?.contentType??""});}};
 }
 const source=(calls:{n:number})=>(async()=>{calls.n++;return new Response(bytes,{status:200,headers:{"content-type":"video/mp4","content-length":"10"}});}) as unknown as typeof fetch;
 it("copies a video on first play and then serves ranges without touching the source",async()=>{
  const b=bucket(),calls={n:0},pending:Promise<unknown>[]=[];
  const first=await handleProductMedia(new Request("https://shop.example/media/v/"+vid),source(calls),{bucket:b,ctx:{waitUntil:p=>{pending.push(p);}}});
  expect(first!.status).toBe(200);expect(first!.headers.get("x-media-source")).toBe("source");
  await Promise.all(pending);
  expect(b.held.get("video/"+vid)?.data.length).toBe(10);
  const before=calls.n;
  const never=(async()=>{throw Error("source must not be called");}) as unknown as typeof fetch;
  const part=await handleProductMedia(new Request("https://shop.example/media/v/"+vid,{headers:{range:"bytes=2-5"}}),never,{bucket:b});
  expect(part!.status).toBe(206);expect(part!.headers.get("content-range")).toBe("bytes 2-5/10");expect(part!.headers.get("x-media-source")).toBe("own-copy");
  expect([...new Uint8Array(await part!.arrayBuffer())]).toEqual([2,3,4,5]);
  const tail=await handleProductMedia(new Request("https://shop.example/media/v/"+vid,{headers:{range:"bytes=-3"}}),never,{bucket:b});
  expect([...new Uint8Array(await tail!.arrayBuffer())]).toEqual([7,8,9]);
  const whole=await handleProductMedia(new Request("https://shop.example/media/v/"+vid),never,{bucket:b});
  expect(whole!.status).toBe(200);expect(whole!.headers.get("content-length")).toBe("10");
  expect((await handleProductMedia(new Request("https://shop.example/media/v/"+vid,{headers:{range:"bytes=50-60"}}),never,{bucket:b}))!.status).toBe(416);
  expect(calls.n).toBe(before);
 });
 it("does not copy a video without a stated length or over the size limit",async()=>{
  const b=bucket(),pending:Promise<unknown>[]=[];
  const big=(async()=>new Response(bytes,{status:200,headers:{"content-type":"video/mp4","content-length":String(65*1024*1024)}})) as unknown as typeof fetch;
  await handleProductMedia(new Request("https://shop.example/media/v/"+vid),big,{bucket:b,ctx:{waitUntil:p=>{pending.push(p);}}});
  await Promise.all(pending);
  expect(b.held.size).toBe(0);
 });
});

