import {doorMinor,type ApprovedOfferVersion,type OfferCart} from "./offer-version";
import {normalizeSearch} from "./smart-search";
const words=(s:string)=>new Set(normalizeSearch(s).split(" ").filter(w=>w.length>=3&&!["جديد","قطعه","منتج","شكل","عدد","مجموعه"].includes(w)));
const overlap=(a:Set<string>,b:Set<string>)=>[...a].filter(w=>b.has(w)).length;
const partners:Record<string,string[]>={home:["organize"],organize:["home","kitchen"],kitchen:["organize"],beauty:["fashion"],fashion:["beauty"],wellness:["home"],kids:["home","organize"]};
export function recommendOffers(current:ApprovedOfferVersion,versions:readonly ApprovedOfferVersion[],limit=4){
 const tokens=words(current.title),price=BigInt(current.packs.find(p=>p.pack_id===current.default_pack_id)!.price_minor);
 return versions.filter(v=>v.market===current.market&&v.currency===current.currency&&v.listing_id!==current.listing_id&&v.slug!==current.slug&&normalizeSearch(v.title)!==normalizeSearch(current.title))
 .map(v=>{const p=BigInt(v.packs.find(p=>p.pack_id===v.default_pack_id)!.price_minor);const diff=p>price?p-price:price-p;return {v,score:(v.category_slug===current.category_slug?200:0)+overlap(tokens,words(v.title))*35-Math.min(99,Number(diff*100n/(price+1n)))}})
 .sort((a,b)=>b.score-a.score||a.v.slug.localeCompare(b.v.slug)).slice(0,limit).map(x=>x.v);
}
/** Optional separate items, not guaranteed bundles or compatible accessories. No checkout mutation. */
export function cartSuggestions(cart:OfferCart,versions:readonly ApprovedOfferVersion[]){
 if(!cart.zone_id||!cart.lines.length)return [];
 const selected=versions.filter(v=>v.market===cart.market&&cart.lines.some(l=>l.listing_id===v.listing_id));
 if(!selected.length)return [];
 const subtotal=selected.reduce((s,v)=>{const l=cart.lines.find(x=>x.listing_id===v.listing_id);const p=v.packs.find(x=>x.pack_id===l?.pack_id);return s+BigInt(p?.price_minor??"0")},0n);
 const cats=new Set(selected.flatMap(v=>v.category_slug?partners[v.category_slug]??[]:[]));
 const existing=new Set(cart.lines.map(l=>l.listing_id));
 return versions.flatMap(v=>{
  if(v.market!==cart.market||existing.has(v.listing_id)||!v.category_slug||!cats.has(v.category_slug)||selected.some(x=>normalizeSearch(x.title)===normalizeSearch(v.title)))return [];
  const zone=v.zones.find(z=>z.zone_id===cart.zone_id),pack=v.packs.find(p=>p.pack_id===v.default_pack_id&&p.selectable);
  if(!zone||!pack||!zone.pack_ids.includes(pack.pack_id))return [];
  const total=doorMinor(pack,zone);
  if(total*2n>subtotal)return [];
  return [{version:v,pack,zone,total}];
 }).sort((a,b)=>a.total===b.total?a.version.slug.localeCompare(b.version.slug):a.total<b.total?-1:1).slice(0,2);
}
