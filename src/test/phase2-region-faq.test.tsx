import {render,screen} from "@testing-library/react";
import {describe,expect,it,vi} from "vitest";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreInfoPage} from "../components/store/StoreInfoPage";
import {marketExperience} from "../lib/store/market-experience";

const countries=[
 ["ae","تفاصيل تليق بذوقج","شو ودّج تلاقين؟","١٩ درهماً"],
 ["om","للبيت تفاصيله","وش في بالك اليوم؟","٣ ريالات عُمانية"],
 ["eg","كل يوم فيه حاجة","بتدوّري على إيه؟","أسعار الشحن التفصيلية"],
 ["iq","كل يوم يصير أحلى","شنو ببالچ اليوم؟","٧٬٠٠٠ دينار عراقي"],
] as const;
describe("four distinct market storefronts",()=>{
 it.each(countries)("%s: local headline, search and unique FAQs",(market,heading,search)=>{
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
  expect(faq?.textContent).not.toMatch(/المورّد|المورد|Taager/);
 });
 it.each(countries)("%s: shows source-quoted shipping or accurate Egypt gap",(market,_,__,fee)=>{
  const {container}=render(<StoreInfoPage market={market} topic="shipping-returns"/>);
  expect(container.textContent).toContain(fee);
  expect(container.textContent).not.toMatch(/المورّد|المورد|Taager/);
  expect(container.textContent).not.toMatch(/Apple Pay|تابي|تمارا|فيزا/);
  expect(container.textContent).toMatch(/إرشادي|تأكيد|معتمد|محتاجة/);
  expect(screen.getByRole("heading",{level:1})).toBeTruthy();
 });
});
describe("Saudi FAQ correction",()=>{
 it("shows exactly five nonduplicated homepage questions",()=>{
  const {container}=render(<MarketPreview market="sa"/>);
  const faq=container.querySelector("#questions");
  expect(faq).toBeTruthy();
  const summaries=Array.from(faq!.querySelectorAll("summary")).map(n=>n.textContent?.trim());
  expect(summaries).toHaveLength(5);
  expect(new Set(summaries).size).toBe(5);
 });
});
