import {cleanup,render,within,waitFor} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import type {MarketCode} from "../lib/store/markets";
import {markets} from "../lib/store/markets";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"https://sample.invalid",key:"fixture"})}));
vi.mock("../lib/store/public-catalog",async load=>{
 const real=await load<typeof import("../lib/store/public-catalog")>();
 return {...real,fetchPublicCatalog:async (_origin:string,_key:string,market:MarketCode)=>[
   {listing_id:"fixture-"+market,slug:"coffee-frother",title:"خفّاقة حليب",price_minor:String(30*10**markets[market].minorDigits),currency:markets[market].currency}
 ]};
});
import {MarketPreview} from "../components/store/MarketPreview";
afterEach(cleanup);
describe("shopping-first homes with a released product",()=>{
 it.each(Object.keys(markets) as MarketCode[])("shows the local product, price and detail link before the hero in %s",async market=>{
  const {container}=render(<MarketPreview market={market}/>);
  const shelf=container.querySelector("#collection") as HTMLElement;
  await waitFor(()=>expect(shelf.querySelector("article")).toBeTruthy());
  const card=within(shelf).getByRole("article");
  expect(within(card).getAllByRole("link")[0]?.getAttribute("href")).toBe("/"+market+"/p/coffee-frother");
  expect(within(card).getByText("خفّاقة حليب")).toBeTruthy();
  expect(card.querySelector("p")?.textContent?.trim()).toBeTruthy();
  expect(container.querySelector("main")?.firstElementChild?.id).toBe("collection");
  expect(shelf.querySelector("nav")).toBeNull();
 });
});
