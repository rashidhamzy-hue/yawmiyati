import {render,screen,fireEvent,within} from "@testing-library/react";
import {describe,expect,it} from "vitest";
import {createSyntheticCatalog} from "../lib/store/simulation/fixtures";
import {demoListing,demoProduct,demoVariant,formatDemoMoney,normalizeDemoQuery} from "../lib/store/simulation/product-experience";
import {SyntheticProductExperience} from "../lib/store/simulation/SyntheticProductExperience";

describe("Milestone 2 isolated product discovery engine",()=>{
 it("filters by local market and category without cross-country leaks",()=>{
  const rows=demoListing({market:"sa",category:"kitchen"});
  expect(rows.total).toBe(5);
  expect(rows.products.every(x=>x.market==="sa"&&x.category==="kitchen"&&x.mayPublish===false)).toBe(true);
  expect(demoListing({market:"iq",category:"kitchen"}).products.every(x=>x.market==="iq")).toBe(true);
  const combined=[...createSyntheticCatalog("sa"),...createSyntheticCatalog("eg")];
  expect(demoListing({market:"sa"},combined).total).toBe(30);
 });
 it("normalizes Arabic diacritics, hamza and search text",()=>{
  expect(normalizeDemoQuery("إِكْسِسوارات")).toBe("اكسسوارات");
  expect(demoListing({market:"sa",search:"ديكور"}).total).toBe(5);
  expect(demoListing({market:"eg",search:"SIM-EG-001"}).total).toBe(1);
  expect(demoListing({market:"eg",search:"SIM-SA-001"}).total).toBe(0);
 });
 it("supports deterministic price sorting, stock, page and range filters",()=>{
  const low=demoListing({market:"om",sort:"price_asc",page:1,pageSize:7});
  const high=demoListing({market:"om",sort:"price_desc",page:1,pageSize:7});
  expect(low.products).toHaveLength(7);
  expect(high.products).toHaveLength(7);
  expect(low.products[0].priceMinor).toBeLessThan(high.products[0].priceMinor);
  expect(demoListing({market:"sa",stock:"available"}).products.every(x=>x.variants.some(v=>v.stock==="available"&&v.availableUnits>0))).toBe(true);
  expect(demoListing({market:"sa",page:4,pageSize:9}).products).toHaveLength(3);
  expect(demoListing({market:"sa",minPriceMinor:999999}).total).toBe(0);
  expect(()=>demoListing({market:"sa",page:0})).toThrow("invalid_pagination");
  expect(()=>demoListing({market:"sa",minPriceMinor:300,maxPriceMinor:20})).toThrow("invalid_price_range");
 });
 it("keeps variant stock separate from product stock and uses market money precision",()=>{
  const p=demoProduct("sa","SIM-SA-001")!;
  expect(p.synthetic).toBe(true);
  expect(demoVariant(p,p.variants[0].sku).stock).toBe("unknown");
  expect(demoVariant(p,p.variants[1].sku).stock).toBe("unavailable");
  expect(()=>demoVariant(p,"wrong")).toThrow("invalid_variant");
  expect(formatDemoMoney("om",5000)).toContain("5");
  expect(formatDemoMoney("iq",7000000)).toContain("7");
 });
});
describe("isolated owner-only simulation component",()=>{
 it("shows conspicuous simulation warning and no checkout action",()=>{
  const {container}=render(<SyntheticProductExperience/>);
  expect(screen.getByRole("heading",{name:"مختبر تجربة منتجات يومياتي"})).toBeTruthy();
  expect(screen.getByText("DEMO · SIMULATION ONLY")).toBeTruthy();
  expect(screen.getByText(/30 نتيجة اصطناعية/)).toBeTruthy();
  expect(container.querySelector('[data-simulation-only="true"]')).toBeTruthy();
  expect(screen.queryByRole("button",{name:/شراء|اطلب|ادفعي|إضافة للسلة/})).toBeNull();
  expect(container.querySelector('form[action]')).toBeNull();
 });
 it("filters, sorts, opens gallery and updates variant without purchase",()=>{
  render(<SyntheticProductExperience/>);
  fireEvent.change(screen.getByRole("combobox",{name:"تصفية القسم"}),{target:{value:"kitchen"}});
  expect(screen.getByText(/5 نتيجة اصطناعية/)).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox",{name:"ترتيب المنتجات"}),{target:{value:"price_desc"}});
  const item=screen.getAllByRole("button",{name:/عرض تفاصيل/})[0];
  fireEvent.click(item);
  expect(screen.getByRole("group",{name:"صور المنتج التجريبية"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"عرض التفاصيل"}));
  expect(screen.getByRole("button",{name:"عرض التفاصيل"}).getAttribute("aria-pressed")).toBe("true");
  const optionButtons=screen.getAllByRole("button",{name:/خيار [أب]/});
  fireEvent.click(optionButtons[1]);
  expect(optionButtons[1].getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText(/لا توجد صور فعلية أو مواصفات/)).toBeTruthy();
 });
 it("switches country and clears previous country filters",()=>{
  render(<SyntheticProductExperience/>);
  fireEvent.change(screen.getByRole("searchbox",{name:"بحث المنتجات التجريبية"}),{target:{value:"SIM-SA-001"}});
  expect(screen.getByText(/1 نتيجة اصطناعية/)).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox",{name:"دولة التجربة"}),{target:{value:"eg"}});
  expect(screen.getByText(/30 نتيجة اصطناعية/)).toBeTruthy();
  expect(screen.getByRole("searchbox",{name:"بحث المنتجات التجريبية"})).toHaveProperty("value","");
 });
});
