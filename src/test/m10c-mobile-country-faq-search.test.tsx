import {describe,it,expect,vi} from "vitest";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import {readFileSync} from "node:fs";
import {StoreHeader,StoreFooter} from "../components/store/StoreChrome";
import {ShoppingAssistant} from "../components/store/ShoppingAssistant";
import {StoreSearchOverlay} from "../components/store/StoreSearchOverlay";
import {MarketPreview} from "../components/store/MarketPreview";
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
 it("assistant visibility moves composer above mobile nav and removes global state on close/unmount",async()=>{
  const {unmount}=render(<><StoreFooter market="sa"/><ShoppingAssistant market="sa" products={[]}/></>);
  const button=screen.getByRole("button",{name:"افتح مساعد يومياتي الذكي"});
  fireEvent.click(button);
  await waitFor(()=>expect(document.body.classList.contains("yawmiyati-assistant-open")).toBe(true));
  expect(screen.getByRole("dialog",{name:"مساعد يومياتي للتسوق"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"إغلاق المساعد"}));
  await waitFor(()=>expect(document.body.classList.contains("yawmiyati-assistant-open")).toBe(false));
  unmount();
  expect(document.body.classList.contains("yawmiyati-assistant-open")).toBe(false);
  const css=readFileSync("src/styles.css","utf8");
  expect(css).toContain("body.yawmiyati-assistant-open nav");
  expect(css).toContain("display: none");
 });
});
