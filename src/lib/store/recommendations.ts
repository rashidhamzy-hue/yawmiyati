import {SECTION_AFFINITY} from "../../../supabase/functions/_shared/brain/affinity";
import type {PublicListing} from "./public-catalog";
import {normalizeSearch} from "./smart-search";

/**
 * Recommendations from the released catalogue only. Inputs are: the product on screen, the cart, what this
 * browser viewed before (kept in the browser, and only after she accepted the consent prompt) and store-wide
 * signals (the brain's rank and sections, verified best-seller rank when the database supplies one).
 * There are no customer profiles: every shopper with the same page and cart sees the same picks and the same prices.
 */
const STOP=new Set(["جديد","قطعه","قطع","منتج","شكل","عدد","مجموعه","عرض","طقم","مع","من","في","على","الى","ضمان","اصلي","الاصلي"]);
export const titleWords=(title:string)=>new Set(normalizeSearch(title).split(" ").filter(w=>w.length>=3&&!STOP.has(w)));
const shared=(a:Set<string>,b:Set<string>)=>{let n=0;for(const w of a)if(b.has(w))n++;return n;};
/** 0..1: how much two titles describe the same thing (near 1 = the same product in another pack or colour). */
export function sameness(a:string,b:string){const x=titleWords(a),y=titleWords(b);const m=Math.min(x.size,y.size);return m?shared(x,y)/m:0;}
const section=(row:PublicListing)=>row.approved_category_slugs?.[0]??null;
const order=(row:PublicListing)=>row.popularity_rank??row.rank??1e9;
const affinity=(slug:string|null):readonly string[]=>slug&&slug in SECTION_AFFINITY?SECTION_AFFINITY[slug as keyof typeof SECTION_AFFINITY]:[];
const sameMarket=(a:PublicListing,b:PublicListing)=>a.currency===b.currency&&a.listing_id!==b.listing_id&&a.slug!==b.slug;

/** Similar products: same section first, then shared words, then the store's own order. */
export function relatedProducts(current:PublicListing,rows:readonly PublicListing[],limit=8):PublicListing[]{
 const words=titleWords(current.title),cat=section(current);
 return rows.filter(r=>sameMarket(current,r)&&sameness(current.title,r.title)<0.7)
  .map(r=>({r,score:(cat&&section(r)===cat?300:0)+shared(words,titleWords(r.title))*60-Math.min(200,order(r))}))
  .sort((a,b)=>b.score-a.score||a.r.slug.localeCompare(b.r.slug)).slice(0,limit).map(x=>x.r);
}
/**
 * "Complete the set": things that go WITH the product, from the sections the brain pairs with its section.
 * Never another version of the same product, and never dearer than the product itself, so it reads as an add-on.
 */
export function completeTheSet(current:PublicListing,rows:readonly PublicListing[],limit=3):PublicListing[]{
 const cat=section(current),partners=affinity(cat),price=BigInt(current.price_minor);
 if(!cat)return [];
 const pool=rows.filter(r=>sameMarket(current,r)&&sameness(current.title,r.title)<0.5&&BigInt(r.price_minor)<=price);
 const pick=(slugs:readonly string[])=>pool.filter(r=>slugs.includes(section(r)??"")).sort((a,b)=>order(a)-order(b)||a.slug.localeCompare(b.slug));
 const out:PublicListing[]=[];
 // One from each partner section first for variety, then fill from the product's own section.
 for(const p of partners){const hit=pick([p]).find(r=>!out.includes(r));if(hit)out.push(hit);}
 for(const r of [...pick([cat]),...pick(partners)])if(out.length<limit&&!out.includes(r))out.push(r);
 return out.slice(0,limit);
}
/** Add-ons for the cart: partner-section products not already in it, cheaper than what she is already buying. */
export function cartAddOns(inCart:readonly PublicListing[],rows:readonly PublicListing[],limit=4):PublicListing[]{
 if(!inCart.length)return [];
 const ids=new Set(inCart.map(r=>r.listing_id));
 const cats=new Set(inCart.flatMap(r=>{const c=section(r);return c?[c,...affinity(c)]:[];}));
 const dearest=inCart.reduce((m,r)=>BigInt(r.price_minor)>m?BigInt(r.price_minor):m,0n);
 return rows.filter(r=>!ids.has(r.listing_id)&&r.currency===inCart[0]!.currency&&cats.has(section(r)??"")&&BigInt(r.price_minor)<=dearest&&!inCart.some(c=>sameness(c.title,r.title)>=0.5))
  .sort((a,b)=>order(a)-order(b)||a.slug.localeCompare(b.slug)).slice(0,limit);
}
