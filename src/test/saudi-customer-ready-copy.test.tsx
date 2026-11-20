import {render,screen} from "@testing-library/react";
import {expect,it,vi} from "vitest";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreCommerceGuard} from "../components/store/StoreCommerceGuard";
import {StoreInfoPage} from "../components/store/StoreInfoPage";
const forbidden=/عند تفعيل الطلبات|الطلبات غير مفعّلة|معلومات تشغيلية مبدئية|المورّد|بعد إطلاق الشراء|قبل الإطلاق|هذا ليس عرض شحن/;
it("presents COD, shipping and clear fulfillment expectations on Saudi home",()=>{
 const {container}=render(<MarketPreview market="sa"/>);
 expect(screen.getByText(/ادفعي عند الاستلام — بدون بطاقات أو تحويلات/)).toBeTruthy();
 expect(screen.getByRole("heading",{name:/٢٨ ر.س لجميع المناطق/})).toBeTruthy();
 expect(screen.getByRole("link",{name:/اعرفي أكثر عن الشحن والاسترجاع/}).getAttribute("href")).toBe("/sa/info/shipping-returns");
 expect(container.textContent).not.toMatch(forbidden);
 expect(screen.queryByRole("button",{name:/تأكيد الطلب|إتمام الدفع/})).toBeNull();
});
it.each(["help","terms","privacy","shipping-returns"] as const)("has customer-ready Saudi %s policy without supplier or launch copy",topic=>{
 const {container}=render(<StoreInfoPage market="sa" topic={topic}/>);
 expect(container.textContent).not.toMatch(forbidden);
});
it.each(["cart","checkout","order"] as const)("keeps Saudi %s commerce state safe and natural",type=>{
 const {container}=render(<StoreCommerceGuard market="sa" type={type}/>);
 expect(container.textContent).not.toMatch(forbidden);
 expect(screen.queryByRole("button",{name:/ادفعي|تأكيد الطلب|شراء الآن/})).toBeNull();
});
