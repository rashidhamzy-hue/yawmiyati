import {describe,expect,it,vi} from "vitest";
import {render} from "@testing-library/react";
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreInfoPage,type InfoTopic} from "../components/store/StoreInfoPage";
import {StoreCommerceGuard} from "../components/store/StoreCommerceGuard";
import {marketExperience} from "../lib/store/market-experience";
import {brandStory} from "../lib/store/brand-story";
import {marketPolicyPages} from "../lib/store/market-policy-pages";
import {saudiShippingPage,saudiDelivery} from "../lib/store/saudi-commerce-content";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));

const countries=["sa","ae","om","eg","iq"] as const;
const topics:InfoTopic[]=["help","privacy","terms","shipping-returns"];
const forbidden=/المورّد|المورد|الموّرد|المورِّد|Taager|تاجر|الشحن الإرشادي|إرشادياً|إرشادية|إرشادي|تقديرات سابقة|عرض شحن إرشادي/i;
const values:{[key:string]:string}={sa:"٢٨",ae:"١٩",om:"٣ ريالات",eg:"٩٥",iq:"٧٬٠٠٠"};
describe("M4J all-country public language and price visibility audit",()=>{
 it.each(countries)("%s homepage: customer language is natural, direct, no upstream references",market=>{
  const {container}=render(<MarketPreview market={market}/>);
  const text=container.textContent??"";
  expect(text).not.toMatch(forbidden);
  expect(text).toContain(values[market]);
  expect(text).toMatch(/التوصيل|الشحن/);
  expect(text).toContain("يومياتي");
  expect(text).not.toMatch(/تم الدفع بنجاح|طلبك مؤكد|اشتر الآن/);
 });
 it.each(countries.flatMap(market=>topics.map(topic=>({market,topic}))))("$market $topic: no supplier names or internal advisory wording",({market,topic})=>{
  const {container}=render(<StoreInfoPage market={market} topic={topic}/>);
  const text=container.textContent??"";
  expect(text).not.toMatch(forbidden);
  if(topic==="shipping-returns"){
   expect(text).toContain(values[market]);
   expect(text).toMatch(/قبل|نؤكد|هنأكد|مبلغ|حسب/);
  }
 });
 it.each(countries.flatMap(market=>(["cart","checkout","order"] as const).map(type=>({market,type}))))("$market $type inactive flow: clear, not misleading",({market,type})=>{
  const {container}=render(<StoreCommerceGuard market={market} type={type}/>);
  expect(container.textContent).not.toMatch(forbidden);
  expect(container.textContent).not.toMatch(/تم الدفع بنجاح|تم قبول الطلب|تم إرسال طلبك/);
 });
 it.each(countries)("%s editable market content has no sourcing or unnatural phrases",market=>{
  const copy=JSON.stringify([marketExperience[market],brandStory[market],market==="sa"?saudiShippingPage:marketPolicyPages[market]]);
  expect(copy).not.toMatch(forbidden);
 });
 it("retains no claim of confirmed live shipping, no checkout, no arbitrary return promises",()=>{
  expect(JSON.stringify(saudiDelivery)).not.toMatch(forbidden);
  expect(JSON.stringify([saudiShippingPage,marketPolicyPages])).not.toMatch(/استرجاع خلال ٧ أيام|استرجاع خلال ١٥ يوماً|١٤ يوماً للسلع المعيبة/);
  expect(JSON.stringify(marketPolicyPages.eg)).toContain("٩٥ جنيه");
  expect(JSON.stringify(marketPolicyPages.eg)).toContain("١٠٠ جنيه");
  expect(JSON.stringify(marketPolicyPages.eg)).toContain("١٠٥ جنيه");
 });
});
