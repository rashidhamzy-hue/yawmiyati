import {describe,expect,it} from "vitest";
import {editorialUpstream,handleEditorialMedia,EDITORIAL_PHOTO_IDS} from "@/lib/store/editorial-media";
import {img,editorialRemote} from "@/lib/store/images";
import {editorialSrcSet} from "@/lib/store/editorial-srcset";

const id=EDITORIAL_PHOTO_IDS[0];
describe("same-origin editorial media",()=>{
 it("maps allowed requests to the Unsplash CDN",()=>{
  expect(editorialUpstream(new URL(`https://yawmiyati.shop/media/${id}?w=768&q=62`)))
   .toBe(`https://images.unsplash.com/${id}?auto=format&fit=crop&w=768&q=62`);
 });
 it("refuses anything outside the allowlist (not an open proxy)",()=>{
  for(const path of [`/media/photo-1-abc?w=768&q=62`,`/media/${id}?w=777&q=62`,`/media/${id}?w=768&q=99`,
   `/media/${id}?w=768&q=62&x=1`,`/media/${id}`,`/media/..%2f..%2fetc?w=768&q=62`,`/media/${id}/x?w=768&q=62`])
   expect(editorialUpstream(new URL("https://yawmiyati.shop"+path))).toBeNull();
 });
 it("serves the rendition with long cache and format negotiation",async()=>{
  let seen="";
  const upstream=(async(url:string,init:RequestInit)=>{seen=url+"|"+new Headers(init.headers).get("accept");
   return new Response("img",{headers:{"content-type":"image/avif"}});}) as unknown as typeof fetch;
  const res=(await handleEditorialMedia(new Request(`https://x.dev/media/${id}?w=360&q=62`,{headers:{accept:"image/avif,image/webp,*/*"}}),upstream))!;
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toContain("immutable");
  expect(res.headers.get("vary")).toBe("Accept");
  expect(seen).toContain("w=360&q=62|image/avif");
  expect((await handleEditorialMedia(new Request(`https://x.dev/media/${id}?w=1&q=62`),upstream))!.status).toBe(404);
  const bad=(async()=>new Response("<html>",{headers:{"content-type":"text/html"}})) as unknown as typeof fetch;
  expect((await handleEditorialMedia(new Request(`https://x.dev/media/${id}?w=360&q=62`),bad))!.status).toBe(502);
  expect(await handleEditorialMedia(new Request("https://x.dev/sa"),upstream)).toBeNull();
 });
 it("page images and every srcset width are same-origin and allowed",()=>{
  for(const key of ["hero","cat-home","cat-kitchen","cat-beauty","cat-fashion","cat-wellness","cat-organize"] as const){
   expect(img[key].startsWith("/media/photo-")).toBe(true);
   expect(editorialUpstream(new URL("https://yawmiyati.shop"+img[key]))).not.toBeNull();
   for(const entry of editorialSrcSet(img[key])!.split(", ")){
    expect(editorialUpstream(new URL("https://yawmiyati.shop"+entry.split(" ")[0]))).not.toBeNull();
   }
   expect(new URL(editorialRemote[key]).hostname).toBe("images.unsplash.com"); // social previews stay absolute
  }
 });
});
