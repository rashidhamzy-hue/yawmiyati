import {render,screen} from "@testing-library/react";
import {describe,it,expect} from "vitest";
import {MarketPreview} from "../components/store/MarketPreview";
describe("premium Saudi storefront prelaunch",()=>{
 it("shows original brand identity, clear prelaunch states and real-country selector",()=>{
  render(<MarketPreview market="sa"/>);
  expect(screen.getByRole("heading",{level:1,name:/كل يوم يستحق/})).toBeTruthy();
  expect(screen.getByRole("navigation",{name:"التنقل الرئيسي"})).toBeTruthy();
  expect(screen.getByRole("navigation",{name:"اختيار البلد"})).toBeTruthy();
  expect(screen.getByRole("link",{name:/تخطي إلى المحتوى/})).toBeTruthy();
  expect(screen.getByRole("heading",{name:"منتجاتنا المعتمدة"})).toBeTruthy();
  expect(screen.getByRole("heading",{name:"أسئلة تتكرر كثيراً"})).toBeTruthy();
  expect(screen.queryByRole("button",{name:/أضيفي للسلة|شراء الآن|اطلبي الآن/})).toBeNull();
 });
 it("keeps a protected product detail unavailable without a configured catalog",()=>{
  render(<MarketPreview market="ae" slug="not-a-product"/>);
  expect(screen.getByText("اختياراتنا في الطريق")).toBeTruthy();
  expect(screen.queryByText(/سعر تجريبي/)).toBeNull();
 });
});
