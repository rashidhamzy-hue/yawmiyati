import {render,screen,fireEvent} from "@testing-library/react";
import {describe,it,expect} from "vitest";
import {MarketPreview} from "../components/store/MarketPreview";
describe("Yawmiyati premium storefront",()=>{
 it("shows original brand identity, clear prelaunch states and real-country selector",()=>{
  render(<MarketPreview market="sa"/>);
  expect(screen.getByRole("heading",{level:1,name:/كل يوم يستحق/})).toBeTruthy();
  expect(screen.getByRole("navigation",{name:"التنقل الرئيسي"})).toBeTruthy();
  expect(screen.getByRole("navigation",{name:"اختيار البلد"})).toBeTruthy();
  expect(screen.getByRole("link",{name:/تخطي إلى المحتوى/})).toBeTruthy();
  expect(screen.getByRole("heading",{name:"اختيارات يومياتي"})).toBeTruthy();
  expect(screen.getByRole("heading",{name:"أسئلة تتكرر كثيراً"})).toBeTruthy();
  expect(screen.queryByRole("button",{name:/أضيفي للسلة|شراء الآن|اطلبي الآن/})).toBeNull();
  expect(screen.queryByText(/قريباً|مرحلة التحضير|قبل الإطلاق/)).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"افتح مساعد يومياتي الذكي"}));
  expect(screen.getByRole("dialog",{name:"مساعد يومياتي للتسوق"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"كيف أختار القسم المناسب؟"}));
  expect(screen.getByText(/يمكنك استكشاف: المنزل/)).toBeTruthy();
 });
 it("renders a focused search page without homepage hero clutter",()=>{
  render(<MarketPreview market="sa" searchOnly initialSearch="قهوة"/>);
  expect(screen.getByRole("heading",{name:"ابحثي في منتجات يومياتي"})).toBeTruthy();
  expect(screen.queryByRole("heading",{level:1,name:/كل يوم يستحق/})).toBeNull();
  expect(screen.getByRole("searchbox",{name:"بحث المنتجات المعتمدة"})).toBeTruthy();
 });
 it("keeps a protected product detail unavailable without a configured catalog",()=>{
  render(<MarketPreview market="ae" slug="not-a-product"/>);
  expect(screen.getByText("تعرّفي على مجموعات يومياتي")).toBeTruthy();
  expect(screen.queryByText(/سعر تجريبي/)).toBeNull();
 });
});
