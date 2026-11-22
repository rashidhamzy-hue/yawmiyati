import {describe,it,expect,vi} from "vitest";
import {render} from "@testing-library/react";
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreInfoPage} from "../components/store/StoreInfoPage";
import {customerServiceCopy} from "../lib/store/customer-service-copy";
import {historicSupplierTerms} from "../lib/store/historic-supplier-terms";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
const markets=["sa","ae","om","eg","iq"] as const;
const forbidden=/المورّد|المورد|Taager|تاجر|عرض المورّد|المتوقعة|الشحن الإرشادي|عند بدء استقبال الطلبات/i;
describe("M4H customer-facing five-country shipping disclosures",()=>{
 it.each(markets)("%s shipping page is direct, honest and independent from supplier quotations",market=>{
  const {container}=render(<StoreInfoPage market={market} topic="shipping-returns"/>);
  const text=container.textContent??"";
  expect(text).not.toMatch(forbidden);
  expect(text).toContain(customerServiceCopy[market].shipping);
  expect(text).toContain(customerServiceCopy[market].returns);
 });
 it.each(markets)("%s home does not publish unverified provider prices or accepted orders",market=>{
  const {container}=render(<MarketPreview market={market}/>);
  const text=container.textContent??"";
  expect(text).not.toMatch(forbidden);
  expect(text).toContain(customerServiceCopy[market].shipping);
  const links=Array.from(container.querySelectorAll("footer a[aria-current], footer a[aria-label^='متجر ']"));
  expect(links.map(link=>link.textContent)).toEqual(["السعودية","الإمارات","عُمان","مصر","العراق"]);
  expect(links.find(link=>link.getAttribute("aria-current")==="page")?.getAttribute("href")).toBe("/"+market);
  expect(text).not.toMatch(/تم تأكيد طلبك|تم الدفع بنجاح/);
 });
 it("keeps quoted country figures in internal evidence without inventing public return promises",()=>{
  expect(historicSupplierTerms.sa.shippingQuote?.amount).toBe("28");
  expect(historicSupplierTerms.ae.shippingQuote?.amount).toBe("19");
  expect(historicSupplierTerms.om.shippingQuote?.amount).toBe("3");
  expect(historicSupplierTerms.iq.shippingQuote?.amount).toBe("7000");
  expect(Object.values(historicSupplierTerms).every(v=>!v.customerPriceAuthorized)).toBe(true);
  expect(customerServiceCopy.om.returns).toContain("منتج معيب أو مختلف عن الوصف");
 });
});
