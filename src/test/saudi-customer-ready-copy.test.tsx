import {render,screen} from "@testing-library/react";
import {expect,it,vi} from "vitest";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreCommerceGuard} from "../components/store/StoreCommerceGuard";
import {StoreInfoPage} from "../components/store/StoreInfoPage";

const unsupported=/٢٨ ر\.س لجميع|٢٨ ريالاً سعودياً|٢–٣ أيام|٤–٥ أيام|٧ أيام من الاستلام/;
it("describes Saudi COD as planned and shipping as unverified on home",()=>{
 const {container}=render(<MarketPreview market="sa"/>);
 expect(screen.getByText(/الدفع عند الاستلام مخطط له — لا توجد طلبات مفعّلة/)).toBeTruthy();
 expect(screen.getByRole("heading",{name:"التكلفة قيد الاعتماد"})).toBeTruthy();
 expect(screen.getByRole("link",{name:/اعرفي أكثر عن الشحن والاسترجاع/}).getAttribute("href")).toBe("/sa/info/shipping-returns");
 expect(container.textContent).not.toMatch(unsupported);
 expect(screen.queryByRole("button",{name:/تأكيد الطلب|إتمام الدفع|شراء الآن/})).toBeNull();
});
it.each(["help","terms","privacy","shipping-returns"] as const)(
 "keeps Saudi %s disclosures conditional, without invented seller promises",(topic)=>{
 const {container}=render(<StoreInfoPage market="sa" topic={topic}/>);
 expect(container.textContent).not.toMatch(unsupported);
 expect(container.textContent).not.toMatch(/مورد Taager|المورّد.*يضمن/);
 expect(screen.getByRole("heading",{level:1})).toBeTruthy();
});
it.each(["cart","checkout","order"] as const)(
 "keeps Saudi %s non-transactional and avoids supplier quoted rates",(type)=>{
 const {container}=render(<StoreCommerceGuard market="sa" type={type}/>);
 expect(container.textContent).not.toMatch(unsupported);
 expect(screen.queryByRole("button",{name:/ادفعي|تأكيد الطلب|شراء الآن/})).toBeNull();
});
