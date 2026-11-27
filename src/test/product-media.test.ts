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
