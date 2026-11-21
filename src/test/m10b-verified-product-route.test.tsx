import {describe,it,expect,vi} from "vitest";
import {render,screen,waitFor,fireEvent} from "@testing-library/react";
import {ApprovedProductGallery} from "../lib/store/ApprovedProductExperience";
import {MarketPreview} from "../components/store/MarketPreview";
import type {PublicDetail} from "../lib/store/public-catalog";
import type {ApprovedExtra} from "../lib/store/approved-product-experience";
vi.mock("../lib/store/staging-public-config",()=>({
 publicBrowserConfig:()=>({origin:"https://example.supabase.co/",key:"anon-publishable"})
}));
vi.mock("../lib/store/public-catalog",async importOriginal=>{
 const original=await importOriginal<typeof import("../lib/store/public-catalog")>();
 const detail:PublicDetail={listing_id:"released-1",slug:"quality-item",title:"إبريق قهوة معتمد",description:"وصف المنتج المعتمد فقط",price_minor:"12500",currency:"SAR"};
 return {...original,fetchPublicCatalog:vi.fn(async()=>[detail]),fetchPublicDetail:vi.fn(async()=>detail),fetchPublicSearch:vi.fn(async()=>[])};
});
const detail:PublicDetail={listing_id:"released-1",slug:"quality-item",title:"إبريق قهوة معتمد",description:"وصف المنتج المعتمد فقط",price_minor:"12500",currency:"SAR"};
describe("M10B verified approved-product route",()=>{
 it("actually renders approved gallery rather than generic package illustration",async()=>{
  const {container}=render(<MarketPreview market="sa" slug="quality-item"/>);
  await waitFor(()=>expect(screen.getByRole("article",{name:"تفاصيل المنتج"})).toBeTruthy());
  expect(screen.getByRole("heading",{name:detail.title})).toBeTruthy();
  expect(screen.getByText(detail.description)).toBeTruthy();
  expect(screen.getByText("لا تتوفر صورة معتمدة لهذا المنتج")).toBeTruthy();
  expect(container.textContent).not.toMatch(/تم قبول طلبك|تم إرسال الطلب بنجاح/);
  expect(screen.queryByRole("button",{name:"شراء الآن"})).toBeNull();
 });
 it("shows real media/variants/specifications ONLY for properly approved extras",()=>{
  const approved:ApprovedExtra={
   listing_id:detail.listing_id,market:"sa",release:"public_approved",
   images:[
    {id:"photo-1",url:"https://images.example.com/item-1.webp",alt:"صورة إبريق من الأمام",approved:true},
    {id:"photo-2",url:"https://images.example.com/item-2.webp",alt:"إبريق من الخلف",approved:true}
   ],variants:[{id:"option-1",label:"حجم صغير",approved:true},{id:"option-2",label:"حجم كبير",approved:true}],
   specifications:[{label:"الخامة",value:"ستانلس ستيل",approved:true}]
  };
  const {rerender}=render(<ApprovedProductGallery market="sa" detail={detail} extras={approved}/>);
  expect(screen.getByRole("img",{name:"صورة إبريق من الأمام"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"عرض الصورة 2"}));
  expect(screen.getByRole("img",{name:"إبريق من الخلف"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"حجم كبير"}));
  expect(screen.getByRole("button",{name:"حجم كبير"}).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("ستانلس ستيل")).toBeTruthy();
  rerender(<ApprovedProductGallery market="sa" detail={detail} extras={{...approved,market:"eg"}}/>);
  expect(screen.getByText("لا تتوفر صورة معتمدة لهذا المنتج")).toBeTruthy();
  expect(screen.queryByText("ستانلس ستيل")).toBeNull();
 });
});
