import {render,screen} from "@testing-library/react";
import {expect,it,vi} from "vitest";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreCommerceGuard} from "../components/store/StoreCommerceGuard";
import {StoreInfoPage} from "../components/store/StoreInfoPage";

it("describes Saudi shipping estimates without supplier references without enabling orders",()=>{
 const {container}=render(<MarketPreview market="sa"/>);
 expect(screen.getByText(/الدفع عند الاستلام عند بدء الطلبات — الشراء غير متاح حالياً/)).toBeTruthy();
 expect(screen.getByRole("heading",{name:/رسوم التوصيل المتوقعة: ٢٨ ر.س/})).toBeTruthy();
 expect(container.textContent).toMatch(/٢–٣ أيام/);
 expect(container.textContent).toMatch(/٤–٥ أيام/);
 expect(container.textContent).toMatch(/المتوقعة/);
 expect(container.textContent).not.toMatch(/المورّد|المورد|Taager/);
 expect(screen.getByRole("link",{name:/اعرفي أكثر عن الشحن والاسترجاع/}).getAttribute("href")).toBe("/sa/info/shipping-returns");
 expect(screen.queryByRole("button",{name:/تأكيد الطلب|إتمام الدفع|شراء الآن/})).toBeNull();
});
it.each(["help","terms","privacy","shipping-returns"] as const)(
 "keeps Saudi %s disclosures non-transactional",(topic)=>{
 const {container}=render(<StoreInfoPage market="sa" topic={topic}/>);
 expect(screen.getByRole("heading",{level:1})).toBeTruthy();
 expect(container.textContent).not.toMatch(/المورّد|المورد|Taager/);
 if(topic==="shipping-returns"){
  expect(container.textContent).toContain("٢٨ ريالاً سعودياً");
  expect(container.textContent).toContain("المتوقعة");
  expect(container.textContent).toContain("شروط الاسترجاع");
  expect(container.textContent).toContain("حقوقك النظامية");
 }
});
it.each(["cart","checkout","order"] as const)(
 "keeps Saudi %s non-transactional",(type)=>{
 const {container}=render(<StoreCommerceGuard market="sa" type={type}/>);
 expect(container.textContent).not.toMatch(/شراء الآن|طلب ناجح/);
 expect(screen.queryByRole("button",{name:/ادفعي|تأكيد الطلب|شراء الآن/})).toBeNull();
});
