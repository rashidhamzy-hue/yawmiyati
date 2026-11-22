import {customerServiceCopy} from "../lib/store/customer-service-copy";
import {describe,expect,it,vi} from "vitest";
import {render} from "@testing-library/react";
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreInfoPage,type InfoTopic} from "../components/store/StoreInfoPage";
import {StoreCommerceGuard} from "../components/store/StoreCommerceGuard";
import {marketExperience} from "../lib/store/market-experience";
import {marketPolicyPages} from "../lib/store/market-policy-pages";
import {saudiShippingPage} from "../lib/store/saudi-commerce-content";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
const countries=["sa","ae","om","eg","iq"] as const;
const topics:InfoTopic[]=["help","privacy","terms","shipping-returns"];
const forbidden=/المورّد|المورد|Taager|الشحن الإرشادي|إرشادي|المتوقعة|سيكون متاحاً|سيتم نشر|عند بدء استقبال الطلبات/;
describe("M4J five-country customer language",()=>{
 it.each(countries)("%s home has natural, supplier-free localized content and no false checkout promise",market=>{
  const {container}=render(<MarketPreview market={market}/>);
  const t=container.textContent??"";
  expect(t).not.toMatch(forbidden);expect(t).toContain("يومياتي");
  expect(t).toMatch(/شحن|توصيل/);
  expect(t).not.toMatch(/تم الدفع بنجاح|طلبك مؤكد/);
 });
 it.each(countries.flatMap(market=>topics.map(topic=>({market,topic}))))("$market $topic stays factual",({market,topic})=>{
  const {container}=render(<StoreInfoPage market={market} topic={topic}/>);
  expect(container.textContent).not.toMatch(forbidden);
  if(topic==="shipping-returns")expect(container.textContent).toContain(customerServiceCopy[market].shipping);
 });
 it.each(countries.flatMap(market=>(["cart","checkout","order"] as const).map(type=>({market,type}))))("$market $type remains inactive",({market,type})=>{
  const {container}=render(<StoreCommerceGuard market={market} type={type}/>);
  expect(container.textContent).not.toMatch(forbidden);
  expect(container.textContent).not.toMatch(/تم الدفع بنجاح|تم قبول الطلب|تم إرسال طلبك/);
 });
 it.each(countries)("%s has no old supplier terms or promises in the content model",market=>{
  const content=JSON.stringify([marketExperience[market],market==="sa"?saudiShippingPage:marketPolicyPages[market]]);
  expect(content).not.toMatch(forbidden);
 });
});
