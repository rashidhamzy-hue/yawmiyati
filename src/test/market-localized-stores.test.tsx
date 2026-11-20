import {render,screen} from "@testing-library/react";
import {describe,expect,it,vi} from "vitest";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreInfoPage} from "../components/store/StoreInfoPage";

describe("country experience and supplier-policy separation",()=>{
 it.each([
  ["ae","تفاصيل تليق بذوقج","شو ودّج تلاقين؟","الإمارات"],
  ["om","للبيت تفاصيله","وش في بالك اليوم؟","عُمان"],
  ["eg","كل يوم فيه حاجة","بتدوّري على إيه؟","مصر"],
  ["iq","كل يوم يصير أحلى","شنو ببالچ اليوم؟","العراق"],
 ] as const)("localizes %s hero, primary search and market CSS scope",(market,heading,search,_)=>{
  const {container}=render(<MarketPreview market={market}/>);
  expect(screen.getByRole("heading",{level:1,name:new RegExp(heading)})).toBeTruthy();
  expect(screen.getByRole("button",{name:search})).toBeTruthy();
  expect(container.querySelector('[data-yawmiyati-market="'+market+'"]')).toBeTruthy();
  expect(screen.queryByRole("button",{name:"دوّري على اللي يعجبك"})).toBeNull();
 });
 it.each([
  ["ae","١٩ درهماً"],
  ["om","٣ ريالات"],
  ["eg","مش هنعلن رقم تخميني"],
  ["iq","٧٬٠٠٠ دينار عراقي"],
 ] as const)("uses %s shipping facts, only as conditional guidance",(market,phrase)=>{
  render(<StoreInfoPage market={market} topic="shipping-returns"/>);
  expect(screen.getByText(new RegExp(phrase))).toBeTruthy();
  expect(screen.getAllByText(/الطلبات غير مفعّلة|قبل قبول الطلبات|قبل تفعيل البيع|قبل ما نستقبل طلبات|بعدهَا قيد التحقّق/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/تاجر/)).toBeNull();
 });
});
