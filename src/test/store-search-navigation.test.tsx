import {render,screen,fireEvent,within} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
import {StoreFrame} from "../components/store/StoreChrome";
import {MarketPreview} from "../components/store/MarketPreview";
import {ApprovedCatalogBrowser} from "../lib/store/ApprovedProductExperience";
afterEach(()=>{document.body.innerHTML="";});
it("opens the same in-page search from mobile navigation, never changes routes",()=>{
 render(<StoreFrame market="sa"><h1>المتجر</h1></StoreFrame>);
 const nav=screen.getByRole("navigation",{name:"التنقل السريع للجوال"});
 fireEvent.click(within(nav).getByRole("button",{name:"البحث"}));
 expect(screen.getByRole("dialog",{name:"بحث يومياتي الذكي"})).toBeTruthy();
 expect(screen.getByRole("searchbox",{name:"ابحثي في منتجات يومياتي"})).toBeTruthy();
 fireEvent.change(screen.getByRole("searchbox",{name:"ابحثي في منتجات يومياتي"}),{target:{value:"دله"}});
 expect(screen.getByRole("link",{name:/المطبخ والقهوة/}).getAttribute("href")).toBe("/sa/c/kitchen");
 fireEvent.click(screen.getByRole("button",{name:"إغلاق البحث"}));
 expect(screen.queryByRole("dialog",{name:"بحث يومياتي الذكي"})).toBeNull();
});
it("editorial CTA scrolls to real visible categories rather than empty catalog",()=>{
 render(<MarketPreview market="sa"/>);
 const section=document.getElementById("discover");
 expect(section).toBeTruthy();
 const scroll=vi.fn();if(section)section.scrollIntoView=scroll;
 fireEvent.click(screen.getByRole("link",{name:/اختاري اللي يعجبك/}));
 expect(scroll).toHaveBeenCalledWith({behavior:"smooth",block:"start"});
});

it("routes the mobile category shortcut back to the storefront discovery section from any route",()=>{
 render(<StoreFrame market="sa"><h1>تفاصيل المنتج</h1></StoreFrame>);
 const nav=screen.getByRole("navigation",{name:"التنقل السريع للجوال"});
 expect(within(nav).getByRole("link",{name:"الأقسام"}).getAttribute("href")).toBe("/sa/#discover");
});
it("shows product breadcrumbs with reliable home and catalogue destinations",()=>{
 render(<MarketPreview market="sa" slug="preview-sa-1"/>);
 const nav=screen.getByRole("navigation",{name:"مسار التنقل"});
 expect(within(nav).getByRole("link",{name:"الرئيسية"}).getAttribute("href")).toBe("/sa");
 expect(within(nav).getByRole("link",{name:"كل المنتجات"}).getAttribute("href")).toBe("/sa/search");
});

it("keeps the all-products catalogue compact with one heading, search, filters and popularity sorting",()=>{render(<ApprovedCatalogBrowser market="sa" products={[{listing_id:"p1",slug:"p1",title:"منتج تجريبي",price_minor:"1000",currency:"SAR"}]}/>);expect(screen.getByRole("heading",{level:1,name:"كل المنتجات"})).toBeTruthy();expect(screen.getByRole("searchbox",{name:"بحث المنتجات"})).toBeTruthy();const sort=screen.getByRole("combobox",{name:"ترتيب المنتجات"});expect(within(sort).getByRole("option",{name:"الأكثر رواجاً"}).hasAttribute("disabled")).toBe(false);});
