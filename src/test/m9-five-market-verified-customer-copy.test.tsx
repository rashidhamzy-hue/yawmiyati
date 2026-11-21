import {describe,it,expect,vi} from "vitest";
import {render} from "@testing-library/react";
import type {MarketCode} from "../lib/store/markets";
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreInfoPage,type InfoTopic} from "../components/store/StoreInfoPage";
import {StoreCommerceGuard} from "../components/store/StoreCommerceGuard";
import {marketExperience} from "../lib/store/market-experience";
import {customerServiceCopy} from "../lib/store/customer-service-copy";
import {marketPolicyPages} from "../lib/store/market-policy-pages";
import {saudiShippingPage} from "../lib/store/saudi-commerce-content";
import {historicSupplierTerms} from "../lib/store/historic-supplier-terms";
import {egyptScreenshotShippingEvidence} from "../lib/store/egypt-shipping-evidence";
import {localShopAnswer} from "../lib/store/shop-assistant";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));

const markets=["sa","ae","om","eg","iq"] as const;
const topics:readonly InfoTopic[]=["help","privacy","terms","shipping-returns"];
const banned=/المتوقعة|المتوقع|سيكون متاح|سيتم نشر|ستظهر الشروط|سنوضح|بنوضح|هنوضح|راح يتوفر|عند بدء استقبال الطلبات|المورّد السابق|المورد السابق|الشحن الإرشادي|إرشادي|تقديرات سابقة|Taager|Zambeel|TasteWP/i;
const unapprovedRate=/٢٨ ر\.س|٢٨ ريالاً سعودياً|١٩ درهماً|٣ ريالات عُمانية|٩٥ جنيه|١٠٠ جنيه|١٠٥ جنيه|٧٬٠٠٠ دينار عراقي/;

describe("M9 consistent five-market customer language",()=>{
 it.each(markets)("%s: homepage shipping, payments, FAQ and highlights use evergreen copy",market=>{
  const {container}=render(<MarketPreview market={market}/>);
  const text=container.textContent??"";
  expect(text).toContain("يومياتي");
  expect(text).not.toMatch(banned);
  expect(text).not.toMatch(unapprovedRate);
  expect(text).toMatch(/الشحن|التوصيل/);
  expect(text).not.toMatch(/طلبك مؤكد|تم الدفع|تم شحن طلبك/);
 });
 it.each(markets.flatMap(market=>topics.map(topic=>({market,topic}))))("$market $topic: no supplier quotes, future-launch filler, or invented policy",({market,topic})=>{
  const {container}=render(<StoreInfoPage market={market} topic={topic}/>);
  const text=container.textContent??"";
  expect(text).not.toMatch(banned);
  expect(text).not.toMatch(unapprovedRate);
  if(topic==="shipping-returns")expect(text).toMatch(/استرجاع|إرجاع/);
 });
 it.each(markets.flatMap(market=>(["cart","checkout","order"] as const).map(type=>({market,type}))))("$market $type: explicit non-transactional guard remains",({market,type})=>{
  const {container}=render(<StoreCommerceGuard market={market} type={type}/>);
  expect(container.textContent).not.toMatch(banned);
  expect(container.textContent).not.toMatch(/تم الدفع بنجاح|طلبك مؤكد|تم إرسال طلبك/);
  if(type!=="order")expect(container.textContent).toContain(customerServiceCopy[market].preCheckoutNotice);
 });
 it.each(markets)("%s: source modules and local assistant agree without unverified price",market=>{
  const c=customerServiceCopy[market];
  expect(JSON.stringify(c)).not.toMatch(banned);
  const page=market==="sa"?saudiShippingPage:marketPolicyPages[market];
  expect(JSON.stringify([page,marketExperience[market]])).not.toMatch(banned);
  expect(localShopAnswer("كم رسوم الشحن؟",market,[])).toContain(c.shipping);
  expect(localShopAnswer("كيف الاسترجاع؟",market,[])).toContain(c.returns);
  expect(localShopAnswer("هل الدفع عند الاستلام؟",market,[])).toContain(c.payment);
  expect(localShopAnswer("كم رسوم الشحن؟",market,[])).not.toMatch(unapprovedRate);
 });
 it("retains internal shipping evidence and refuses to market it as confirmed customer price",()=>{
  const t=historicSupplierTerms;
  expect([t.sa.shippingQuote?.amount,t.ae.shippingQuote?.amount,t.om.shippingQuote?.amount,t.iq.shippingQuote?.amount])
   .toEqual(["28","19","3","7000"]);
  expect(Object.values(t).every(x=>x.status==="historic_unverified"&&!x.customerPriceAuthorized)).toBe(true);
  expect(egyptScreenshotShippingEvidence.customerPriceAuthorized).toBe(false);
  expect(egyptScreenshotShippingEvidence.bands).toHaveLength(3);
 });
});
