/**
 * Stable responsive variants for the licensed Unsplash editorial photo CDN.
 * Supplier product images use their own trusted media pipeline instead.
 */
import {editorialMediaPath} from "./editorial-media";
const LOCAL=/^\/editorial\/([a-z-]+)-\d+\.webp$/;
export function editorialSrcSet(url:string):string|undefined{
 const local=LOCAL.exec(url);
 if(local)return [240,360,480,768,1080,1600].map(w=>`/editorial/${local[1]}-${w}.webp ${w}w`).join(", ");
 const media=/^\/media\/(photo-[0-9a-f-]+)\?/.exec(url);
 if(!media)return undefined;
 const widths=[240,360,480,640,768,960,1280,1600,1920];
 return widths.map(width=>editorialMediaPath(media[1]!,width,width<=768?62:70)+" "+width+"w").join(", ");
}

/** Preload hint for a route's LCP editorial photo so the browser fetches it while parsing <head>. */
export function editorialPreload(url:string,sizes="100vw"){
 const srcset=editorialSrcSet(url);
 return srcset?{rel:"preload",as:"image",href:url,imageSrcSet:srcset,imageSizes:sizes,fetchPriority:"high"}:{rel:"preload",as:"image",href:url,fetchPriority:"high"};
}
