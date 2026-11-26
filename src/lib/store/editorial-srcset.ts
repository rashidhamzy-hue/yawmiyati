/**
 * Stable responsive variants for the licensed Unsplash editorial photo CDN.
 * Supplier product images use their own trusted media pipeline instead.
 */
export function editorialSrcSet(url:string):string|undefined{
 if(!url.startsWith("https://images.unsplash.com/photo-"))return undefined;
 const widths=[240,360,480,640,768,960,1280,1600,1920];
 return widths.map(width=>{
  const variant=new URL(url);
  variant.searchParams.set("w",String(width));
  variant.searchParams.set("q",width<=768?"62":"70");
  return variant.toString()+" "+width+"w";
 }).join(", ");
}

/** Preload hint for a route's LCP editorial photo so the browser fetches it while parsing <head>. */
export function editorialPreload(url:string,sizes="100vw"){
 const srcset=editorialSrcSet(url);
 return srcset?{rel:"preload",as:"image",href:url,imageSrcSet:srcset,imageSizes:sizes,fetchPriority:"high"}:{rel:"preload",as:"image",href:url,fetchPriority:"high"};
}
