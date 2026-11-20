import {render,screen,fireEvent,within} from "@testing-library/react";
import {expect,it} from "vitest";
import {StoreHeader,StoreFooter,StoreFrame} from "../components/store/StoreChrome";
import {marketIdentity} from "../lib/store/market-identity";
it("uses Saudi flag and readable local riyal rather than orphan SAR badge",()=>{
 render(<StoreHeader market="sa"/>);
 const chooser=screen.getByLabelText("البلد والعملة: المملكة العربية السعودية، ريال سعودي");
 expect(chooser).toBeTruthy();
 expect(chooser.textContent).toContain("🇸🇦");
 expect(chooser.textContent).toContain("ر.س");
 expect(screen.getByRole("link",{name:"البحث في المنتجات"}).getAttribute("href")).toBe("/sa/search");
 expect(screen.getByRole("navigation",{name:"التنقل الرئيسي"})).toBeTruthy();
});
it("provides mobile-menu navigation with real section links",()=>{
 render(<StoreHeader market="sa"/>);
 fireEvent.click(screen.getByRole("button",{name:"فتح القائمة"}));
 expect(screen.getByRole("navigation",{name:"قائمة الجوال"})).toBeTruthy();
 expect(within(screen.getByRole("navigation",{name:"قائمة الجوال"})).getByRole("link",{name:"الأقسام"}).getAttribute("href")).toBe("/sa#discover");
});
it("keeps all five flags and local currencies independent",()=>{
 expect(Object.keys(marketIdentity)).toEqual(["sa","ae","om","eg","iq"]);
 expect(new Set(Object.values(marketIdentity).map(x=>x.flag)).size).toBe(5);
 expect(marketIdentity.sa.currencyLabel).toBe("ر.س");
 render(<StoreFooter market="sa"/>);
 expect(screen.getByRole("link",{name:"متجر سلطنة عُمان"}).getAttribute("href")).toBe("/om");
 expect(screen.getByRole("link",{name:"سياسة الخصوصية"}).getAttribute("href")).toBe("/sa/info/privacy");
});
