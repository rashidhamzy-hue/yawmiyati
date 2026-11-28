import {render,screen,fireEvent} from "@testing-library/react";
import {describe,it,expect,vi} from "vitest";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
import {MarketPreview} from "../components/store/MarketPreview";
describe("Yawmiyati premium storefront",()=>{
 it("shows original brand identity, clear prelaunch states and real-country selector",async()=>{
  render(<MarketPreview market="sa"/>);
  expect(screen.getByRole("heading",{level:1,name:/كل يوم يستحق/})).toBeTruthy();
  expect(screen.getByRole("navigation",{name:"التنقل الرئيسي"})).toBeTruthy();
  expect(screen.getByText("البلد والعملة: المملكة العربية السعودية، ريال سعودي").closest("summary")!).toBeTruthy();
  expect(screen.getByRole("link",{name:/تخطي إلى المحتوى/})).toBeTruthy();
  expect(screen.getByRole("heading",{name:"اختيارات تناسب يومك"})).toBeTruthy();
  expect(screen.getByRole("link",{name:/اكتشفي عالم العناية/}).getAttribute("href")).toBe("/sa/c/beauty");
  expect(screen.getByRole("link",{name:/اكتشفي لمسات البيت/}).getAttribute("href")).toBe("/sa/c/home");
  fireEvent.click(screen.getByRole("button",{name:"دوّري على اللي يعجبك"}));
  expect(screen.getByRole("dialog",{name:"بحث يومياتي الذكي"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"إغلاق البحث"}));
  expect(screen.getByRole("heading",{name:"أسئلة تتكرر كثيراً"})).toBeTruthy();
  expect(screen.queryByRole("button",{name:/أضيفي للسلة|شراء الآن|اطلبي الآن/})).toBeNull();
  expect(screen.queryByText(/قريباً|مرحلة التحضير|قبل الإطلاق/)).toBeNull();
  // The assistant loads once the browser is idle, after the first paint.
  fireEvent.click(await screen.findByRole("button",{name:"اسألي مساعدة يومياتي"},{timeout:4000}));
  expect(screen.getByRole("dialog",{name:"مساعدة يومياتي"})).toBeTruthy();
  // A suggested question is answered from the store's published policy text.
  fireEvent.click(screen.getByRole("button",{name:"كيف الدفع والتوصيل؟"}));
  expect((await screen.findAllByText(/الدفع/,{selector:"p.whitespace-pre-wrap"})).length).toBeGreaterThan(1);
 });
 it("renders a focused search page without homepage hero clutter",()=>{
  render(<MarketPreview market="sa" searchOnly initialSearch="قهوة"/>);
  expect(screen.getByRole("heading",{level:1,name:"كل المنتجات"})).toBeTruthy();
  expect(screen.queryByRole("heading",{level:1,name:/كل يوم يستحق/})).toBeNull();
  expect(screen.getByRole("searchbox",{name:"بحث المنتجات المعتمدة"})).toBeTruthy();
 });
 it("keeps a protected product detail unavailable without a configured catalog",()=>{
  render(<MarketPreview market="ae" slug="not-a-product"/>);
  expect(screen.getByText("تعرّفي على أقسام يومياتي")).toBeTruthy();
  expect(screen.queryByText(/سعر تجريبي/)).toBeNull();
 });
});
