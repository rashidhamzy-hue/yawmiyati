import {cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {MarketPreview} from "../components/store/MarketPreview";
import {fetchPublicCatalog} from "../lib/store/public-catalog";
import {marketExperience} from "../lib/store/market-experience";

vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"https://example.invalid",key:"public-test-key"})}));
vi.mock("../lib/store/public-catalog",async importOriginal=>{
 const original=await importOriginal<typeof import("../lib/store/public-catalog")>();
 return {...original,fetchPublicCatalog:vi.fn(async()=>[]),fetchPublicSearch:vi.fn(async()=>[])};
});
afterEach(()=>{cleanup();vi.clearAllMocks();});

describe("shopping-first homepage interactions",()=>{
 it.each(["sa","ae","om","eg","iq"] as const)("%s hero search stays on the current page and closes with Escape",async market=>{
  render(<MarketPreview market={market}/>);
  const currentPath=window.location.pathname;
  await waitFor(()=>expect(fetchPublicCatalog).toHaveBeenCalledWith("https://example.invalid","public-test-key",market));
  fireEvent.click(screen.getByRole("button",{name:marketExperience[market].searchCta}));
  const dialog=screen.getByRole("dialog",{name:"بحث يومياتي الذكي"});
  const input=within(dialog).getByRole("searchbox",{name:"ابحثي في منتجات يومياتي"});
  fireEvent.change(input,{target:{value:"قهوة"}});
  expect((input as HTMLInputElement).value).toBe("قهوة");
  expect(window.location.pathname).toBe(currentPath);
  fireEvent.keyDown(document,{key:"Escape"});
  await waitFor(()=>expect(screen.queryByRole("dialog",{name:"بحث يومياتي الذكي"})).toBeNull());
  expect(document.body.style.overflow).not.toBe("hidden");
 });
 it("compact story discovery respects reduced motion",async()=>{
  const media=vi.spyOn(window,"matchMedia").mockReturnValue({matches:true,media:"(prefers-reduced-motion: reduce)",onchange:null,addListener:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn(),dispatchEvent:vi.fn()});
  render(<MarketPreview market="sa"/>);
  const categorySection=document.getElementById("discover");
  if(!categorySection)throw new Error("Category discovery is missing");
  const scroll=vi.fn();categorySection.scrollIntoView=scroll;
  fireEvent.click(screen.getByRole("link",{name:/اختاري اللي يعجبك/}));
  expect(scroll).toHaveBeenCalledWith({behavior:"auto",block:"start"});
  await waitFor(()=>expect(fetchPublicCatalog).toHaveBeenCalled());
  media.mockRestore();
 });
});