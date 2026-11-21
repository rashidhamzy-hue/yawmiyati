import {render,screen} from "@testing-library/react";
import {expect,it,vi} from "vitest";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreCommerceGuard} from "../components/store/StoreCommerceGuard";
import {StoreInfoPage} from "../components/store/StoreInfoPage";

it("describes Saudi supplier shipping and ETA quotes honestly without enabling orders",()=>{
 const {container}=render(<MarketPreview market="sa"/>);
 expect(screen.getByText(/الدفع عند الاستلام مخطط له — لا توجد طلبات مفعّلة/)).toBeTruthy();
 expect(screen.getByRole("heading",{name:/عرض شحن إرشادي: ٢٨ ر.س/})).toBeTruthy();
 expect(container.textContent).toMatch(/٢–٣ أيام/);
 expect(container.textContent).toMatch(/٤–٥ أيام/);
 expect(container.textContent).toMatch(/إرشادي/);
 expect(screen.getByRole("link",{name:/اعرفي أكثر عن الشحن والاسترجاع/}).getAttribute("href")).toBe("/sa/info/shipping-returns");
 expect(screen.queryByRole("button",{name:/تأكيد الطلب|إتمام الدفع|شراء الآن/})).toBeNull();
});
it.each(["help","terms","privacy","shipping-returns"] as const)(
 "keeps Saudi %s disclosures non-transactional",(topic)=>{
 const {container}=render(<StoreInfoPage market="sa" topic={topic}/>);
 expect(screen.getByRole("heading",{level:1})).toBeTruthy();
 expect(container.textContent).not.toContain("Taager");
 if(topic==="shipping-returns"){
  expect(container.textContent).toContain("٢٨ ريالاً سعودياً");
  expect(container.textContent).toContain("إرشادي");
  expect(container.textContent).toContain("٧ أيام");
  expect(container.textContent).toContain("الحقوق النظامية");
 }
});
it.each(["cart","checkout","order"] as const)(
 "keeps Saudi %s non-transactional",(type)=>{
 const {container}=render(<StoreCommerceGuard market="sa" type={type}/>);
 expect(container.textContent).not.toMatch(/شراء الآن|طلب ناجح/);
 expect(screen.queryByRole("button",{name:/ادفعي|تأكيد الطلب|شراء الآن/})).toBeNull();
});
