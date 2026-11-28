import {describe,it,expect,vi} from "vitest";
import {pageCopy} from "../lib/store/page-copy";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import {readFileSync} from "node:fs";
import {StoreHeader,StoreFooter} from "../components/store/StoreChrome";
import {ShoppingAssistant} from "../components/store/ShoppingAssistant";
import {StoreSearchOverlay} from "../components/store/StoreSearchOverlay";
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreCategoryPage} from "../components/store/StoreCategoryPage";
import {StoreCommerceGuard} from "../components/store/StoreCommerceGuard";
import {customerServiceCopy} from "../lib/store/customer-service-copy";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));

describe("M10C mobile storefront details",()=>{
 it("Saudi FAQ renders four balanced single-topic questions",()=>{
  const {container}=render(<MarketPreview market="sa"/>);
  const summaries=Array.from(container.querySelectorAll("#questions summary"));
  expect(summaries).toHaveLength(4);
  expect(summaries.map(x=>x.textContent)).toEqual(expect.arrayContaining([
   "أقدر أدفع عند الاستلام?","بكم الشحن داخل السعودية?","متى يوصلني طلبي?","وش إجراءات الاسترجاع?"
  ].map(s=>s.replace("?","؟"))));
 });
 it("country selector closes on outside pointer and Escape",()=>{
  const {container}=render(<StoreHeader market="ae"/>);
  const details=container.querySelector<HTMLDetailsElement>("details");
  const trigger=details?.querySelector("summary");
  expect(details).toBeTruthy();
  fireEvent.click(trigger!);
  expect(details?.open).toBe(true);
  fireEvent.pointerDown(document.body);
  expect(details?.open).toBe(false);
  fireEvent.click(trigger!);
  fireEvent.keyDown(document,{key:"Escape"});
  expect(details?.open).toBe(false);
 });
 it.each(["sa","ae","om","eg","iq"] as const)("keeps the %s market switcher inside a narrow mobile viewport",market=>{
  const {container}=render(<StoreHeader market={market}/>);
  const details=container.querySelector<HTMLDetailsElement>("details");
  const trigger=details?.querySelector("summary");
  fireEvent.click(trigger!);
  const options=container.querySelector<HTMLDivElement>("#yawmiyati-market-options");
  expect(options).toBeTruthy();
  expect(options?.className).toContain("fixed");
  expect(options?.className).toContain("inset-x-3");
  expect(options?.className).toContain("max-h-[min(70dvh,560px)]");
  expect(options?.className).toContain("overflow-y-auto");
  const links=Array.from(options!.querySelectorAll<HTMLAnchorElement>("a"));
  expect(links.map(link=>link.getAttribute("href"))).toEqual(["/sa","/ae","/om","/eg","/iq"]);
  expect(links.every(link=>link.textContent?.trim())).toBe(true);
  expect(links.find(link=>link.getAttribute("href")==="/"+market)?.getAttribute("aria-current")).toBe("page");
 });
 it.each(["sa","ae","om","eg","iq"] as const)("%s search overlay uses local COD wording",market=>{
  const {container}=render(<StoreSearchOverlay market={market} open onClose={()=>{}}/>);
  expect(container.textContent).toContain(customerServiceCopy[market].payment);
  const input=screen.getByRole("searchbox",{name:"ابحثي في منتجات يومياتي"});
  fireEvent.change(input,{target:{value:"قهوة"}});
  const clear=screen.getByRole("button",{name:"مسح البحث"});
  expect(clear.className).toContain("min-w-12");
  fireEvent.click(clear);
  expect((input as HTMLInputElement).value).toBe("");
 });
 it.each(["sa","ae","om","eg","iq"] as const)("%s category and checkout use customer language, not database architecture",market=>{
  const category=render(<StoreCategoryPage market={market} slug="kitchen"/>);
  const expectedHeading={sa:"اكتشفي ما يناسب يومك",ae:"اختيارات تكمل يومج",om:"اختيارات تناسب أسلوبك",eg:"شوفي اللي يناسب يومك",iq:"شوفي اللي يناسب يومچ"}[market];
  expect(category.container.textContent).toContain(expectedHeading);
  expect(category.container.querySelector("h1")?.textContent).toBe("المطبخ والقهوة");
  expect(category.container.textContent).not.toMatch(/لا يدّعي تصنيف|معلومات معتمدة/);
  category.unmount();
  const guard=render(<StoreCommerceGuard market={market} type="checkout"/>);
  expect(guard.container.textContent).toContain(pageCopy(market).browseHint); // each market in its own words
  expect(guard.container.textContent).not.toMatch(/بناءً على بيانات معتمدة/);
 });
 it("assistant visibility moves composer above mobile nav and removes global state on close/unmount",async()=>{
  const {unmount}=render(<><StoreFooter market="sa"/><ShoppingAssistant market="sa" products={[]}/></>);
  const button=screen.getByRole("button",{name:"اسألي مساعدة يومياتي"});
  fireEvent.click(button);
  await waitFor(()=>expect(document.body.classList.contains("yawmiyati-assistant-open")).toBe(true));
  expect(screen.getByRole("dialog",{name:"مساعدة يومياتي"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"إغلاق المساعدة"}));
  await waitFor(()=>expect(document.body.classList.contains("yawmiyati-assistant-open")).toBe(false));
  unmount();
  expect(document.body.classList.contains("yawmiyati-assistant-open")).toBe(false);
  const css=readFileSync("src/styles.css","utf8");
  expect(css).toContain("body.yawmiyati-assistant-open nav");
  expect(css).toContain("display: none");
 });
});
