import {render,screen} from "@testing-library/react";
import {expect,it,vi} from "vitest";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreCommerceGuard} from "../components/store/StoreCommerceGuard";
import {StoreInfoPage} from "../components/store/StoreInfoPage";
import {customerServiceCopy} from "../lib/store/customer-service-copy";

it("presents Saudi COD, shipping and returns in natural operational wording without promising checkout",()=>{
 const {container}=render(<MarketPreview market="sa"/>);
 expect(screen.getByText(/الدفع عند الاستلام · التفاصيل حسب عنوانك/)).toBeTruthy();
 expect(screen.getByRole("heading",{name:"رسوم التوصيل حسب العنوان"})).toBeTruthy();
 expect(container.textContent).toContain(customerServiceCopy.sa.shipping);
 expect(container.textContent).toContain(customerServiceCopy.sa.returns);
 expect(container.textContent).not.toMatch(/المتوقعة|سيكون متاحاً|سيتم نشر|٢٨ ر.س|المورد|Taager/);
 expect(screen.getByRole("link",{name:/اعرفي أكثر عن الشحن والاسترجاع/}).getAttribute("href")).toBe("/sa/info/shipping-returns");
 expect(screen.queryByRole("button",{name:/تأكيد الطلب|إتمام الدفع|شراء الآن/})).toBeNull();
});
it.each(["help","terms","privacy","shipping-returns"] as const)(
 "keeps Saudi %s disclosures relevant and direct",(topic)=>{
 const {container}=render(<StoreInfoPage market="sa" topic={topic}/>);
 expect(screen.getByRole("heading",{level:1})).toBeTruthy();
 expect(container.textContent).not.toMatch(/المورّد|المورد|Taager|المتوقعة|سيتم نشر/);
 if(topic==="shipping-returns"){
  expect(container.textContent).toContain(customerServiceCopy.sa.shipping);
  expect(container.textContent).toContain(customerServiceCopy.sa.returns);
  expect(container.textContent).toContain("حقوقك النظامية");
 }
});
it.each(["cart","checkout","order"] as const)(
 "keeps Saudi %s non-transactional",(type)=>{
 const {container}=render(<StoreCommerceGuard market="sa" type={type}/>);
 expect(container.textContent).not.toMatch(/شراء الآن|طلب ناجح|سيكون متاحاً/);
 expect(screen.queryByRole("button",{name:/ادفعي|تأكيد الطلب|شراء الآن/})).toBeNull();
});
