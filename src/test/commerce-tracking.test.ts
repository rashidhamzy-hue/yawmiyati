import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";

const sent:[string,Record<string,unknown>][]=[];
vi.mock("@/lib/analytics/analytics",()=>({track:(e:string,p:Record<string,unknown>)=>{sent.push([e,p]);}}));
import {COMMERCE_EVENTS,newScrollMarks,placementOf,startCommerceTracking} from "@/lib/analytics/commerce-tracking";

const tile=(slug:string)=>`<article data-product-tile="" data-slug="${slug}"><a href="/sa/p/${slug}"><h3>x</h3></a></article>`;
let stop=()=>{};
const noNav=(e:Event)=>e.preventDefault();
beforeEach(()=>{document.addEventListener("click",noNav);sent.length=0;window.history.replaceState(null,"","/sa/c/kitchen");});
afterEach(()=>{stop();document.body.innerHTML="";vi.unstubAllGlobals();vi.useRealTimers();});

describe("commerce tracking",()=>{
 it("sends one click per card with its placement and position, and nothing personal",()=>{
  document.body.innerHTML=`<div data-placement="trending">${tile("a")}${tile("b")}</div><div>${tile("c")}</div>`;
  stop=startCommerceTracking();
  (document.querySelector("[data-slug='b'] h3") as HTMLElement).click();
  (document.querySelector("[data-slug='c'] a") as HTMLElement).click();
  expect(sent).toEqual([[COMMERCE_EVENTS.listClick,{slug:"b",placement:"trending",position:2}],[COMMERCE_EVENTS.listClick,{slug:"c",placement:"category",position:1}]]);
  expect(JSON.stringify(sent)).not.toMatch(/phone|name|email|address|distinct/i);
 });
 it("batches cards that were really seen, each once, also cards added later",()=>{
  vi.useFakeTimers();
  let fire:(els:Element[])=>void=()=>{};
  const observed:Element[]=[];
  vi.stubGlobal("IntersectionObserver",class{constructor(cb:(e:{isIntersecting:boolean;target:Element}[])=>void){fire=els=>cb(els.map(target=>({isIntersecting:true,target})));}
   observe(el:Element){observed.push(el);}unobserve(){}disconnect(){}});
  document.body.innerHTML=`<div data-placement="new">${tile("a")}${tile("b")}</div>`;
  stop=startCommerceTracking();
  expect(observed).toHaveLength(2);
  fire(observed.slice(0,2));fire(observed.slice(0,1));
  vi.advanceTimersByTime(2100);
  expect(sent).toEqual([[COMMERCE_EVENTS.listSeen,{slugs:["a","b"],placement:"new",count:2}]]);
 });
 it("marks product-page scroll depth once per mark and only on product pages",()=>{
  expect(newScrollMarks(60,new Set([25]))).toEqual([50]);expect(newScrollMarks(100,new Set())).toEqual([25,50,75,100]);expect(newScrollMarks(10,new Set())).toEqual([]);
  stop=startCommerceTracking();
  window.dispatchEvent(new Event("scroll"));
  expect(sent).toEqual([]);
  stop();
  window.history.replaceState(null,"","/sa/p/milk-frother");
  stop=startCommerceTracking();
  Object.defineProperty(document.documentElement,"scrollHeight",{value:2000,configurable:true});
  Object.defineProperty(window,"innerHeight",{value:1000,configurable:true});
  Object.defineProperty(window,"scrollY",{value:520,configurable:true});
  window.dispatchEvent(new Event("scroll"));window.dispatchEvent(new Event("scroll"));
  expect(sent).toEqual([[COMMERCE_EVENTS.scroll,{slug:"milk-frother",depth:25}],[COMMERCE_EVENTS.scroll,{slug:"milk-frother",depth:50}]]);
  expect(placementOf(document.body,"/sa/search")).toBe("search");
 });
});
