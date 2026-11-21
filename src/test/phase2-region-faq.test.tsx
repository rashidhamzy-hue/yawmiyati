import {render,screen} from "@testing-library/react";
import {describe,expect,it,vi} from "vitest";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreInfoPage} from "../components/store/StoreInfoPage";
import {marketExperience} from "../lib/store/market-experience";
import {customerServiceCopy} from "../lib/store/customer-service-copy";

const countries=[
 ["ae","تفاصيل تليق بذوقج","شو ودّج تلاقين؟"],
 ["om","للبيت تفاصيله","وش في بالك اليوم؟"],
 ["eg","كل يوم فيه حاجة","بتدوّري على إيه؟"],
 ["iq","كل يوم يصير أحلى","شنو ببالچ اليوم؟"]
] as const;
describe("distinct five-market storefronts",()=>{
 it.each(countries)("%s local heading, search and unique FAQs",(market,heading,search)=>{
  const {container}=render(<MarketPreview market={market}/>);
  expect(screen.getByRole("heading",{level:1,name:new RegExp(heading)})).toBeTruthy();
  expect(screen.getByRole("button",{name:search})).toBeTruthy();
  expect(screen.getByRole("region",{name:"تفاصيل التسوق في "+market})).toBeTruthy();
  const faq=container.querySelector("#questions");
  expect(faq).toBeTruthy();
  const faqs=Array.from(faq!.querySelectorAll("summary")).map(e=>e.textContent?.trim());
  expect(faqs).toHaveLength(marketExperience[market].questions.length);
  expect(new Set(faqs).size).toBe(faqs.length);
 });
 it.each(countries)("%s uses direct local shipping/returns without fake prices",(market)=>{
  const {container}=render(<StoreInfoPage market={market} topic="shipping-returns"/>);
  expect(container.textContent).toContain(customerServiceCopy[market].shipping);
  expect(container.textContent).toContain(customerServiceCopy[market].returns);
  expect(container.textContent).not.toMatch(/المتوقعة|Taager|Apple Pay|تابي|تمارا|فيزا|سيكون متاحاً/);
  expect(screen.getByRole("heading",{level:1})).toBeTruthy();
 });
});
describe("Saudi FAQ",()=>{
 it("has four balanced, non-duplicated service questions",()=>{
  const {container}=render(<MarketPreview market="sa"/>);
  const summaries=Array.from(container.querySelectorAll("#questions summary")).map(n=>n.textContent?.trim());
  expect(summaries).toHaveLength(4);
  expect(new Set(summaries).size).toBe(5);
 });
});
