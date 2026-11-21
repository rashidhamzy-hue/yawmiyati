import {render,screen} from "@testing-library/react";
import {describe,expect,it,vi} from "vitest";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreInfoPage} from "../components/store/StoreInfoPage";
import {marketExperience} from "../lib/store/market-experience";

const countries=[
 ["ae","تفاصيل تليق بذوقج","شو ودّج تلاقين؟","رسوم الشحن والتغطية النهائية لم تُعتمد"],
 ["om","للبيت تفاصيله","وش في بالك اليوم؟","رسوم الشحن والتغطية النهائية غير معتمدة"],
 ["eg","كل يوم فيه حاجة","بتدوّري على إيه؟","مصاريف الشحن حسب المحافظة والعنوان"],
 ["iq","كل يوم يصير أحلى","شنو ببالچ اليوم؟","أجرة الشحن النهائية غير مؤكدة"],
] as const;

describe("four distinct market storefronts",()=>{
 it.each(countries)("%s: local headline, search and unique FAQs", (market,heading,search)=>{
  const {container}=render(<MarketPreview market={market}/>);
  expect(screen.getByRole("heading",{level:1,name:new RegExp(heading)})).toBeTruthy();
  expect(screen.getByRole("button",{name:search})).toBeTruthy();
  expect(screen.getByRole("region",{name:"تفاصيل التسوق في "+market})).toBeTruthy();
  expect(container.querySelector('[data-yawmiyati-market="'+market+'"]')).toBeTruthy();
  const faq=container.querySelector("#questions");
  expect(faq).toBeTruthy();
  const faqs=Array.from(faq!.querySelectorAll("summary")).map(e=>e.textContent?.trim());
  expect(faqs).toHaveLength(marketExperience[market].questions.length);
  expect(new Set(faqs).size).toBe(faqs.length);
  expect(faq?.textContent).not.toMatch(/المورّد|Taager|٢٤–٤٨ ساعة|٧٬٠٠٠ دينار/);
 });
 it.each(countries)("%s: localized shipping without supplier name or false payment options",(market,_,__,fee)=>{
  const {container}=render(<StoreInfoPage market={market} topic="shipping-returns"/>);
  expect(container.textContent).toContain(fee);
  expect(container.textContent).not.toMatch(/المورّد|Taager|١٩ درهماً|٣ ريالات عُمانية|٧٬٠٠٠ دينار عراقي/);
  expect(container.textContent).not.toMatch(/Apple Pay|تابي|تمارا|فيزا/);
  expect(screen.getByRole("heading",{level:1})).toBeTruthy();
 });
});
describe("Saudi FAQ correction",()=>{
 it("shows exactly five nonduplicated homepage questions, not two stacked FAQ sets",()=>{
  const {container}=render(<MarketPreview market="sa"/>);
  const faq=container.querySelector("#questions");
  expect(faq).toBeTruthy();
  const summaries=Array.from(faq!.querySelectorAll("summary")).map(n=>n.textContent?.trim());
  expect(summaries).toHaveLength(5);
  expect(new Set(summaries).size).toBe(5);
  expect(faq?.className).toContain("max-w-5xl");
  expect(faq?.querySelector("div.mt-7.grid.sm\\:grid-cols-2")).toBeTruthy();
 });
});
