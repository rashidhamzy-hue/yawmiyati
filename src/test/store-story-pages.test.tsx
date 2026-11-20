import {render,screen} from "@testing-library/react";
import {describe,it,expect,vi} from "vitest";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"",key:""})}));
import {StoreStoryPage} from "../components/store/StoreStoryPage";
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreHeader,StoreFooter} from "../components/store/StoreChrome";
import {brandStory} from "../lib/store/brand-story";

describe("full Yawmiyati brand story",()=>{
 it.each(["sa","ae","om","eg","iq"] as const)("builds meaningful %s origin page with editorial imagery and links",(market)=>{
  const {container}=render(<StoreStoryPage market={market}/>);
  expect(screen.getByRole("heading",{level:1})).toBeTruthy();
  expect(container.querySelectorAll("article").length).toBeGreaterThanOrEqual(6);
  expect(container.querySelectorAll("img").length).toBeGreaterThanOrEqual(4);
  expect(container.textContent).toContain(brandStory[market].origin);
  expect(container.textContent).toContain(brandStory[market].turning);
  expect(container.textContent).toContain(brandStory[market].promise);
  expect(screen.getByRole("link",{name:new RegExp(brandStory[market].shopCta)}).getAttribute("href")).toBe("/"+market+"#discover");
  expect(container.textContent).not.toMatch(/مليون|عميل راض|الأفضل في المنطقة|أرقام مبيعات/);
 });
 it("links Saudi homepage story teaser to dedicated route",()=>{
  render(<MarketPreview market="sa"/>);
  expect(screen.getByRole("link",{name:/اقرئي قصتنا كاملة/}).getAttribute("href")).toBe("/sa/story");
 });
 it.each(["sa","eg","iq"] as const)("exposes story in shared navigation and footer",market=>{
  const {container}=render(<><StoreHeader market={market}/><StoreFooter market={market}/></>);
  const hrefs=[...container.querySelectorAll('a[href$="/story"]')].map(a=>a.getAttribute("href"));
  expect(hrefs).toContain("/"+market+"/story");
  expect(hrefs.length).toBeGreaterThanOrEqual(2);
 });
});
