import {cleanup,render} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {markets,type MarketCode} from "../lib/store/markets";
import {marketDictionary} from "../lib/store/dictionary";
import {chromeCopy,marketFromPath} from "../lib/store/chrome-copy";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"https://sample.invalid",key:"fixture"})}));
vi.mock("../lib/store/public-catalog",async load=>({...(await load<typeof import("../lib/store/public-catalog")>()),fetchPublicCatalog:async()=>[]}));
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreCommerceGuard} from "../components/store/StoreCommerceGuard";
import {StoreCategoryPage} from "../components/store/StoreCategoryPage";

afterEach(cleanup);
const all=Object.keys(markets) as MarketCode[];
const visible=(el:HTMLElement)=>{el.querySelectorAll("script,style,svg").forEach(n=>n.remove());return el.textContent??"";};
describe("every storefront speaks Arabic in its own dialect",()=>{
 it.each(all)("renders no Latin words on the home, section, cart and order pages of %s",market=>{
  for(const page of [<MarketPreview market={market}/>,<StoreCategoryPage market={market} slug="kitchen"/>,<StoreCommerceGuard market={market} type="cart"/>,<StoreCommerceGuard market={market} type="checkout"/>]){
   const {container,unmount}=render(page);
   expect(visible(container).match(/[A-Za-z]{3,}/g)??[]).toEqual([]);
   unmount();
  }
 });
 it("gives each market its own words where the dialect differs, and the same labels where checks rely on them",()=>{
  expect(chromeCopy("eg").formPhone).toBe("رقم الموبايل");expect(chromeCopy("sa").formPhone).toBe("رقم الجوال");
  expect(chromeCopy("iq").notFoundTitle).toMatch(/مو موجودة/);expect(chromeCopy("eg").notFoundTitle).toMatch(/مش موجودة/);
  expect(new Set(all.map(m=>chromeCopy(m).openSearch)).size).toBe(1);
  expect(new Set(all.map(m=>marketDictionary(m).shop.orderNow)).size).toBeGreaterThanOrEqual(4);
  expect(marketFromPath("/iq/p/x")).toBe("iq");expect(marketFromPath("/admin")).toBe("sa");expect(marketFromPath("/")).toBe("sa");
 });
});

import {pageCopy as pagesOf} from "../lib/store/page-copy";
import {StoreInfoPage as InfoPage} from "../components/store/StoreInfoPage";
import {StoreCategoryPage as SectionPage} from "../components/store/StoreCategoryPage";
import {render as renderPage,cleanup as cleanPage} from "@testing-library/react";
describe("page words come from the market dictionary (session 4)",()=>{
 it("the help page answers in each market's own words with the store's published facts, and never a note to ourselves",()=>{
  for(const m of ["sa","ae","om","eg","iq"] as const){
   const pc=pagesOf(m),{container}=renderPage(<InfoPage market={m} topic="help"/>);
   expect(container.querySelector("h1")!.textContent).toBe(pc.helpTitle);
   expect(container.querySelectorAll("main details")).toHaveLength(8);
   expect(container.textContent).toContain(pc.helpFamily[0]);
   expect(container.textContent).not.toMatch(/يجب توضيح|إشعار الخصوصية الخاص بالخدمة|بيانات معتمدة/);
   cleanPage();
  }
  expect(pagesOf("eg").questionTitles.pay).toBe("أدفع إزاي؟");expect(pagesOf("iq").questionTitles.pay).toBe("شلون أدفع؟");
 });
 it("privacy says what is true: order data for delivery only, no account, no profile, consent before tracking",()=>{
  const {container}=renderPage(<InfoPage market="ae" topic="privacy"/>);
  for(const t of ["بيانات الطلب","لا حساب ولا بريد إلكتروني","لا ملف شخصي ولا أسعار خاصة","قياس التصفح"])expect(container.textContent).toContain(t);
  expect(container.querySelectorAll("main details")).toHaveLength(7); // six groups and the phone-number note
  cleanPage();
 });
 it("a section page opens with what the section holds and ends with the buyer's questions and links onward",()=>{
  const {container}=renderPage(<SectionPage market="eg" slug="kids"/>);
  expect(container.querySelector("[data-section-intro]")!.textContent).toBe(pagesOf("eg").sectionIntro.kids);
  const q=container.querySelector("[data-section-questions]")!;
  expect(q.querySelectorAll("details")).toHaveLength(5);expect(q.textContent).toContain("الشحن بكام؟");
  expect([...q.querySelectorAll("a")].map(a=>a.getAttribute("href"))).toEqual(["/eg/offers","/eg/info/shipping-returns"]);
  cleanPage();
 });
});
