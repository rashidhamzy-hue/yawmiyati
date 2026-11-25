import {fireEvent,render,screen} from "@testing-library/react";
import {expect,it,vi} from "vitest";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
import {StoreInfoPage} from "../components/store/StoreInfoPage";
import {customerServiceCopy} from "../lib/store/customer-service-copy";
it("displays a photographic help page with a working search action",()=>{
 const {container}=render(<StoreInfoPage market="sa" topic="help"/>);
 expect(screen.getByRole("heading",{name:"كيف نقدر نساعدك؟"})).toBeTruthy();
 expect(container.querySelectorAll("img").length).toBeGreaterThanOrEqual(3);
 const eventSpy=vi.fn();
 document.addEventListener("yawmiyati:open-search",eventSpy,{once:true});
 fireEvent.click(screen.getByRole("button",{name:/البحث في يومياتي/}));
 expect(eventSpy).toHaveBeenCalledTimes(1);
});
it("shows verified-safe Saudi service details and protected navigation",()=>{
 const {container}=render(<StoreInfoPage market="sa" topic="shipping-returns"/>);
 expect(container.querySelectorAll("img").length).toBeGreaterThanOrEqual(3);
 expect(screen.getByRole("link",{name:"الخصوصية"}).getAttribute("href")).toBe("/sa/info/privacy");
 expect(container.textContent).toContain(customerServiceCopy.sa.shipping);
 expect(container.textContent).toContain(customerServiceCopy.sa.payment);
 expect(container.textContent).toContain(customerServiceCopy.sa.returns);
 expect(container.textContent).not.toMatch(/المتوقعة|سيكون متاحاً|سيتم نشر|٢٨ ريالاً|Taager/);
});
it("shows all three Egyptian shipping prices",()=>{
 const {container}=render(<StoreInfoPage market="eg" topic="shipping-returns"/>);
 expect(container.textContent).toContain(customerServiceCopy.eg.shipping);
 for(const fee of ["٩٥ جنيه","١٠٠ جنيه","١٠٥ جنيه"])expect(container.textContent).toContain(fee);
});

it("removes the repeated Saudi payment question and adapts help microcopy per country",()=>{
 const sa=render(<StoreInfoPage market="sa" topic="help"/>);
 expect(screen.getAllByText("كيف أدفع؟")).toHaveLength(1);
 sa.unmount();
 const eg=render(<StoreInfoPage market="eg" topic="help"/>);
 expect(screen.getByText("هتلاقي اللي على ذوقك")).toBeTruthy();
 eg.unmount();
 const iq=render(<StoreInfoPage market="iq" topic="help"/>);
 expect(screen.getByText("اختيارچ صار أسهل")).toBeTruthy();
 iq.unmount();
});
