/**
 * Stable responsive variants for the licensed Unsplash editorial photo CDN.
 * Supplier product images use their own trusted media pipeline instead.
 */
export function editorialSrcSet(url:string):string|undefined{
 if(!url.startsWith("https://images.unsplash.com/photo-"))return undefined;
 const widths=[360,640,960,1440,1920];
 return widths.map(width=>{
  const variant=new URL(url);
  variant.searchParams.set("w",String(width));
  return variant.toString()+" "+width+"w";
 }).join(", ");
}
