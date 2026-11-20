import {render,screen,fireEvent,vi} from "@testing-library/react";
import {expect,it} from "vitest";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
import {StoreCommerceGuard} from "../components/store/StoreCommerceGuard";
for(const type of ["cart","checkout","order"] as const){
 it(type+" has branded navigation, genuine photo and no fake purchase execution",()=>{
  const {container}=render(<StoreCommerceGuard market="sa" type={type}/>);
  expect(screen.getByRole("navigation",{name:"التنقل الرئيسي"})).toBeTruthy();
  expect(container.querySelectorAll("img").length).toBeGreaterThan(0);
  expect(screen.getByRole("link",{name:/اكتشفي الأقسام/}).getAttribute("href")).toBe("/sa#discover");
  expect(screen.queryByRole("button",{name:/ادفعي|اشتري الآن|تأكيد الدفع/})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:/ابحثي في يومياتي/}));
  expect(screen.getByRole("dialog",{name:"بحث يومياتي الذكي"})).toBeTruthy();
 });
}
