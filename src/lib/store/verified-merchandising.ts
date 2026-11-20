import type {PublicListing} from "./public-catalog";
function words(title:string){
 return new Set((title.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu)??[]).filter(x=>!["منتج","قطعة","للبنات","للمنزل","جديد"].includes(x)));
}
/** Read-only, deterministic related items from the currently published public catalog.
 * Not personalized; never mixes stores/currencies or reports inventory beyond the public RPC.
 */
export function relatedVerifiedProducts(current:PublicListing,items:readonly PublicListing[],limit=4):PublicListing[]{
 if(!Number.isSafeInteger(limit)||limit<0||limit>12)throw Error("Invalid related-items limit");
 const tokens=words(current.title), price=BigInt(current.price_minor);
 return items.filter(x=>x.listing_id!==current.listing_id&&x.slug!==current.slug&&x.currency===current.currency)
 .map(item=>{
  const overlap=[...words(item.title)].filter(w=>tokens.has(w)).length;
  const alternativePrice=BigInt(item.price_minor);
  const spread=price>alternativePrice?price-alternativePrice:alternativePrice-price;
  const proximity=Number(spread*100n/(price+1n));
  return {item,score:overlap*100-Math.min(99,proximity)};
 })
 .sort((a,b)=>b.score-a.score||a.item.slug.localeCompare(b.item.slug))
 .slice(0,limit).map(x=>x.item);
}
