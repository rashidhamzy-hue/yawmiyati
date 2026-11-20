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
 expect(screen.getByText(/٢٨ ريالاً سعودياً/)).toBeTruthy();
 expect(screen.getByText(/الدفع نقداً عند الاستلام فقط/)).toBeTruthy();
 expect(screen.getByText(/٧ أيام/)).toBeTruthy();
 expect(screen.getByText(/حقوقك النظامية/)).toBeTruthy();
 expect(container.textContent).not.toMatch(/عند تفعيل|المورّد|الطلبات غير مفعّلة|معلومات تشغيلية/);
});

it("keeps unverified Egypt delivery fees unspecified",()=>{
 render(<StoreInfoPage market="eg" topic="shipping-returns"/>);
 expect(screen.getByText(/لا توجد حالياً رسوم أو مدد شحن مؤكدة/)).toBeTruthy();
 expect(screen.queryByText(/٢٨ ريالاً سعودياً/)).toBeNull();
});
