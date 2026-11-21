import {describe,it,expect,vi} from "vitest";
import {render,screen,waitFor} from "@testing-library/react";
import {parsePublicListings,PUBLIC_CATEGORY_SLUGS} from "../lib/store/public-catalog";
import {ApprovedCategoryProductGrid} from "../components/store/ApprovedCategoryProductGrid";
import {StoreCategoryPage} from "../components/store/StoreCategoryPage";
vi.mock("../lib/store/staging-public-config",()=>({publicBrowserConfig:()=>({origin:"https://example.supabase.co/",key:"public-publishable"})}));
vi.mock("../lib/store/public-catalog",async importOriginal=>{
 const original=await importOriginal<typeof import("../lib/store/public-catalog")>();
 return {...original,fetchPublicCatalog:vi.fn(async(_origin:string,_key:string,market:string)=>{
  if(market!=="sa")return [];
  return [
   {listing_id:"ok-1",slug:"coffee-pot",title:"إبريق قهوة معتمد",price_minor:"2500",currency:"SAR",approved_category_slugs:["kitchen"]},
   {listing_id:"ok-2",slug:"organizer",title:"منظّم منزلي",price_minor:"1500",currency:"SAR",approved_category_slugs:["organize"]}
  ];
 })};
});
const raw={listing_id:"r1",slug:"coffee-pot",title:"إبريق قهوة معتمد",price_minor:"2500",currency:"SAR"};
describe("M10D proof-based public categories",()=>{
 it("accepts only whitelisted owner-approved assignments; strips all other marketing attributes",()=>{
  const row={...raw,approved_category_slugs:["kitchen"],category_release:"owner_approved",supplier_name:"must_not_leak"};
  const result=parsePublicListings([row],"sa");
  expect(result[0].approved_category_slugs).toEqual(["kitchen"]);
  expect(JSON.stringify(result)).not.toContain("supplier_name");
  expect(PUBLIC_CATEGORY_SLUGS).toEqual(["home","kitchen","beauty","fashion","wellness","organize"]);
  expect(parsePublicListings([raw],"sa")).toEqual([raw]);
 });
 it("fails closed on unapproved, invalid or duplicate categories and mismatched market currency",()=>{
  for(const value of [
   {...raw,approved_category_slugs:["kitchen"]},
   {...raw,category_release:"owner_approved"},
   {...raw,approved_category_slugs:["kitchen","kitchen"],category_release:"owner_approved"},
   {...raw,approved_category_slugs:["unknown"],category_release:"owner_approved"},
   {...raw,approved_category_slugs:["../../admin"],category_release:"owner_approved"},
   {...raw,approved_category_slugs:["kitchen"],category_release:"supplier_inferred"},
   {...raw,approved_category_slugs:["kitchen"],category_release:"owner_approved",currency:"AED"}
  ])expect(()=>parsePublicListings([value],"sa")).toThrow();
 });
 it("shows only verified category items; a different category or country is not mislabeled",async()=>{
  const {unmount}=render(<ApprovedCategoryProductGrid market="sa" slug="kitchen" categoryTitle="المطبخ والقهوة"/>);
  await waitFor(()=>expect(screen.getByRole("heading",{name:"منتجات المطبخ والقهوة"})).toBeTruthy());
  expect(screen.getByText("إبريق قهوة معتمد")).toBeTruthy();
  expect(screen.queryByText("منظّم منزلي")).toBeNull();
  unmount();
  const page=render(<StoreCategoryPage market="sa" slug="kitchen"/>);
  await waitFor(()=>expect(screen.getByRole("heading",{name:"منتجات المطبخ والقهوة"})).toBeTruthy());
  page.unmount();
  const e=render(<ApprovedCategoryProductGrid market="ae" slug="kitchen" categoryTitle="المطبخ والقهوة"/>);
  expect(e.container.textContent).not.toContain("إبريق قهوة معتمد");
 });
});
