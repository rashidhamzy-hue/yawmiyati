/**
 * Shopping-funnel events the brain learns from, on top of the events components already send.
 * Everything here describes WHAT was shown or done (a product slug, a placement, a scroll mark), never WHO did it:
 * no name, phone, address or stable visitor id is added by this file, and PostHog runs cookieless until consent.
 *
 *   products_seen     {slugs[], placement}      cards that were at least half visible for a moment (listing impressions)
 *   product_clicked   {slug, placement, position}  a click from a card to its product page (CTR from listing)
 *   product_scroll    {slug, depth}             25 / 50 / 75 / 100 % of the product page, once each
 *   search_no_results {query}                   a search that found nothing (what shoppers want and we do not sell)
 * One listener per page, passive, started only after the first interaction with the rest of analytics.
 */
import {track} from "./analytics";
import {pageContext} from "./page-context";

/** Every commerce event name, in one place: the scorecards (HogQL) and the Meta events read the same names. */
export const COMMERCE_EVENTS={
 listSeen:"products_seen",listClick:"product_clicked",view:"product_viewed",scroll:"product_scroll",addToCart:"add_to_cart",
 offerSelected:"offer_selected",setViewed:"set_viewed",freeDeliveryReached:"free_delivery_reached",
 orderFormStart:"checkout_started",orderSubmitted:"order_submitted",
 assistantOpened:"assistant_opened",assistantAnswer:"assistant_answer",searchTyped:"search_typed",searchSubmitted:"search_submitted",searchNoResults:"search_no_results",
} as const;

export const SCROLL_MARKS=[25,50,75,100] as const;
/** Marks newly passed when the page is `percent` scrolled and `done` were already sent. */
export function newScrollMarks(percent:number,done:ReadonlySet<number>):number[]{
 return SCROLL_MARKS.filter(m=>percent>=m&&!done.has(m));
}
/** Where a card sits: the nearest [data-placement], else the page type (home, category, search, product...). */
export function placementOf(el:Element,pathname:string):string{
 return el.closest("[data-placement]")?.getAttribute("data-placement")||pageContext(pathname).page_type;
}
const slugOf=(tile:Element):string|null=>{
 const own=tile.getAttribute("data-slug");
 if(own)return own;
 const href=tile.querySelector("a[href*='/p/']")?.getAttribute("href")??"";
 const m=/\/p\/([^/?#]+)/.exec(href);
 try{return m?decodeURIComponent(m[1]!):null;}catch{return null;}
};

/** Starts the listeners once. Returns a function that removes them (used on route change and in tests). */
export function startCommerceTracking(doc:Document=document,win:Window=window):()=>void{
 let path=win.location.pathname;
 let seen=new Set<string>(),marks=new Set<number>(),pending=new Map<string,string[]>(),timer:number|undefined;
 const reset=()=>{if(win.location.pathname===path)return;flush();path=win.location.pathname;seen=new Set();marks=new Set();};
 const flush=()=>{timer=undefined;for(const [placement,slugs] of pending)if(slugs.length)track(COMMERCE_EVENTS.listSeen,{slugs:slugs.slice(0,24),placement,count:slugs.length});pending=new Map();};
 const queue=(tile:Element)=>{
  const slug=slugOf(tile);
  if(!slug||seen.has(slug))return;
  seen.add(slug);
  const placement=placementOf(tile,path);
  pending.set(placement,[...(pending.get(placement)??[]),slug]);
  if(timer===undefined)timer=win.setTimeout(flush,2000);
 };
 const io=typeof IntersectionObserver==="function"?new IntersectionObserver(entries=>{reset();for(const e of entries)if(e.isIntersecting){queue(e.target);io!.unobserve(e.target);}},{threshold:0.5}):null;
 const watch=(root:ParentNode)=>{if(io)root.querySelectorAll("[data-product-tile]").forEach(t=>io.observe(t));};
 watch(doc);
 const mo=typeof MutationObserver==="function"?new MutationObserver(list=>{for(const m of list)m.addedNodes.forEach(n=>{if(n instanceof Element){if(n.matches("[data-product-tile]"))io?.observe(n);watch(n);}});}):null;
 mo?.observe(doc.body,{childList:true,subtree:true});
 const onClick=(e:Event)=>{
  const tile=(e.target as Element|null)?.closest?.("[data-product-tile]");
  if(!tile)return;
  reset();
  const slug=slugOf(tile);
  if(!slug)return;
  const siblings=[...(tile.parentElement?.querySelectorAll(":scope > [data-product-tile]")??[])];
  track(COMMERCE_EVENTS.listClick,{slug,placement:placementOf(tile,path),position:Math.max(0,siblings.indexOf(tile))+1});
 };
 const onScroll=()=>{
  reset();
  const ctx=pageContext(path);
  if(ctx.page_type!=="product"||!ctx.page_slug)return;
  const h=doc.documentElement,max=h.scrollHeight-win.innerHeight;
  const percent=max<=0?100:Math.round(((win.scrollY||h.scrollTop)/max)*100);
  for(const m of newScrollMarks(percent,marks)){marks.add(m);track(COMMERCE_EVENTS.scroll,{slug:ctx.page_slug,depth:m});}
 };
 doc.addEventListener("click",onClick,{capture:true,passive:true});
 win.addEventListener("scroll",onScroll,{passive:true});
 win.addEventListener("pagehide",flush);
 return()=>{flush();io?.disconnect();mo?.disconnect();doc.removeEventListener("click",onClick,{capture:true} as EventListenerOptions);win.removeEventListener("scroll",onScroll);win.removeEventListener("pagehide",flush);if(timer!==undefined)win.clearTimeout(timer);};
}
