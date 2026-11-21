import {describe,it,expect,vi} from "vitest";
import {render} from "@testing-library/react";
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreInfoPage} from "../components/store/StoreInfoPage";
import {historicSupplierTerms} from "../lib/store/historic-supplier-terms";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
const samples=[
 ["sa","٢٨","٢–٣ أيام"],
 ["ae","١٩ درهماً","٢٤–٤٨ ساعة"],
 ["om","٣ ريالات عُمانية",null],
 ["eg",null,"٢–٥ أيام"],
 ["iq","٧٬٠٠٠ دينار عراقي",null],
] as const;
const forbidden=/المورّد|المورد|Taager|تاجر|عرض المورّد|شروط المورد/i;
describe("M4H customer-facing five-country shipping disclosures",()=>{
 it.each(samples)("%s shipping/returns page: Yawmiyati speaks directly without naming its sourcing", (market,fee,eta)=>{
  const {container}=render(<StoreInfoPage market={market} topic="shipping-returns"/>);
  const displayed=container.textContent??"";
  expect(displayed).not.toMatch(forbidden);
  expect(displayed).toMatch(/متوقع|قبل|تأكيد|متاح|نؤكد/);
  if(fee)expect(displayed).toContain(fee);
  if(eta)expect(displayed).toContain(eta);
  if(market==="eg"){
   expect(displayed).toContain("٩٥ جنيه");
   expect(displayed).toContain("١٠٠ جنيه");
   expect(displayed).toContain("١٠٥ جنيه");
   expect(displayed).toContain("هنحدد التكلفة بعد التأكد من العنوان");
   expect(historicSupplierTerms.eg.shippingQuote).toBeNull(); // separate older ledger remains historical
  }
 });
 it.each(samples)("%s homepage: brand-first indicative shipping, no prior-provider references", (market,fee,eta)=>{
  const {container}=render(<MarketPreview market={market}/>);
  const displayed=container.textContent??"";
  expect(displayed).not.toMatch(forbidden);
  if(fee)expect(displayed).toContain(fee);
  if(market==="eg")expect(displayed).toContain("٩٥ أو ١٠٠ أو ١٠٥ جنيه");
  if(eta&&market!=="eg")expect(displayed).toContain(eta);
  expect(displayed).not.toMatch(/تم تأكيد طلبك|تم الدفع بنجاح/);
 });
 it("never turns conflicting return windows into shopper promises",()=>{
  const iraq=render(<StoreInfoPage market="iq" topic="shipping-returns"/>);
  expect(iraq.container.textContent).not.toMatch(/٣ أيام للإرجاع|١٤ يوماً/);
  iraq.unmount();
  const oman=render(<StoreInfoPage market="om" topic="shipping-returns"/>);
  expect(oman.container.textContent).not.toContain("١٥ يوماً");
  oman.unmount();
  const saudi=render(<StoreInfoPage market="sa" topic="shipping-returns"/>);
  expect(saudi.container.textContent).not.toContain("مدة استرجاع ٧ أيام");
 });
});