import {fireEvent,render,screen} from "@testing-library/react";
import {expect,it,vi} from "vitest";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
import {StoreInfoPage} from "../components/store/StoreInfoPage";
it("displays a photographic hero and supporting editorial photos in help",()=>{
 const {container}=render(<StoreInfoPage market="sa" topic="help"/>);
 expect(screen.getByRole("heading",{name:"كيف نقدر نساعدك؟"})).toBeTruthy();
 expect(container.querySelectorAll("img").length).toBeGreaterThanOrEqual(3);
 const eventSpy=vi.fn();
 document.addEventListener("yawmiyati:open-search",eventSpy,{once:true});
 fireEvent.click(screen.getByRole("button",{name:/البحث في يومياتي/}));
 expect(eventSpy).toHaveBeenCalledTimes(1);
});
it("shows evidence-qualified Saudi shipping and COD with protected navigation",()=>{
 const {container}=render(<StoreInfoPage market="sa" topic="shipping-returns"/>);
 expect(container.querySelectorAll("img").length).toBeGreaterThanOrEqual(3);
 expect(screen.getByRole("link",{name:"الخصوصية"}).getAttribute("href")).toBe("/sa/info/privacy");
 expect(screen.getByText(/رسوم التوصيل المتوقعة ٢٨ ريالاً سعودياً داخل المملكة/)).toBeTruthy();
 expect(screen.getByText(/الدفع نقداً عند الاستلام سيكون متاحاً/)).toBeTruthy();
 expect(screen.getByText(/شروط الاسترجاع والاستبدال/)).toBeTruthy();
 expect(screen.getByText(/الحقوق النظامية/)).toBeTruthy();
 expect(container.textContent).toContain("مدة التوصيل المتوقعة");
 expect(container.textContent).not.toMatch(/المورّد|المورد|Taager/);
});

it("shows Egypt screenshot shipping bands as estimates without authorizing orders",()=>{
 render(<StoreInfoPage market="eg" topic="shipping-returns"/>);
 expect(screen.getByText(/مصاريف الشحن المتوقعة حسب المنطقة — ٩٥ جنيه/)).toBeTruthy();
 expect(screen.queryByText(/٢٨ ريالاً سعودياً/)).toBeNull();
});
