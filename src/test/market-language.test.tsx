import {cleanup,render} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {markets,type MarketCode} from "../lib/store/markets";
import {marketDictionary} from "../lib/store/dictionary";
import {chromeCopy,marketFromPath} from "../lib/store/chrome-copy";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"https://sample.invalid",key:"fixture"})}));
vi.mock("../lib/store/public-catalog",async load=>({...(await load<typeof import("../lib/store/public-catalog")>()),fetchPublicCatalog:async()=>[]}));
import {MarketPreview} from "../components/store/MarketPreview";
import {StoreCommerceGuard} from "../components/store/StoreCommerceGuard";
import {StoreCategoryPage} from "../components/store/StoreCategoryPage";

afterEach(cleanup);
const all=Object.keys(markets) as MarketCode[];
const visible=(el:HTMLElement)=>{el.querySelectorAll("script,style,svg").forEach(n=>n.remove());return el.textContent??"";};
describe("every storefront speaks Arabic in its own dialect",()=>{
 it.each(all)("renders no Latin words on the home, section, cart and order pages of %s",market=>{
  for(const page of [<MarketPreview market={market}/>,<StoreCategoryPage market={market} slug="kitchen"/>,<StoreCommerceGuard market={market} type="cart"/>,<StoreCommerceGuard market={market} type="checkout"/>]){
   const {container,unmount}=render(page);
   expect(visible(container).match(/[A-Za-z]{3,}/g)??[]).toEqual([]);
   unmount();
  }
 });
 it("gives each market its own words where the dialect differs, and the same labels where checks rely on them",()=>{
  expect(chromeCopy("eg").formPhone).toBe("رقم الموبايل");expect(chromeCopy("sa").formPhone).toBe("رقم الجوال");
  expect(chromeCopy("iq").notFoundTitle).toMatch(/مو موجودة/);expect(chromeCopy("eg").notFoundTitle).toMatch(/مش موجودة/);
  expect(new Set(all.map(m=>chromeCopy(m).openSearch)).size).toBe(1);
  expect(new Set(all.map(m=>marketDictionary(m).shop.orderNow)).size).toBeGreaterThanOrEqual(4);
  expect(marketFromPath("/iq/p/x")).toBe("iq");expect(marketFromPath("/admin")).toBe("sa");expect(marketFromPath("/")).toBe("sa");
 });
});
