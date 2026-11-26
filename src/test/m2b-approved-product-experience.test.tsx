import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ApprovedCatalogBrowser, ApprovedProductGallery } from "../lib/store/ApprovedProductExperience";
import { filterApprovedListings, presentApprovedDetail, validateApprovedExtra } from "../lib/store/approved-product-experience";
import type { PublicDetail, PublicListing } from "../lib/store/public-catalog";

const sa: PublicListing[] = [
  { listing_id:"approved-1", slug:"item-a", title:"منظم أنيق", price_minor:"12900", currency:"SAR" },
  { listing_id:"approved-2", slug:"item-b", title:"أداة المنزل", price_minor:"9900", currency:"SAR" },
  { listing_id:"approved-3", slug:"item-c", title:"قطعة", price_minor:"5900", currency:"SAR" }
];
const detail: PublicDetail = { ...sa[0], description:"وصف معتمد" };
const approved = {
  listing_id:"approved-1", market:"sa", release:"public_approved",
  images:[{id:"photo1",url:"https://images.example.org/approved/1.jpg",alt:"الواجهة",approved:true},{id:"photo2",url:"https://images.example.org/approved/2.jpg",alt:"الخلفية",approved:true}],
  variants:[{id:"variant-1",label:"لون أزرق",approved:true},{id:"variant-2",label:"لون أحمر",approved:true}],
  specifications:[{label:"المادة",value:"قطن",approved:true}]
} as const;

describe("M2B approved-only catalogue",()=>{
  it("filters, sorts and paginates only passed approved public rows",()=>{
    expect(filterApprovedListings(sa,"sa",{query:"انـيق".replace("ـ","")}).total).toBe(1);
    expect(filterApprovedListings(sa,"sa",{sort:"price_asc"}).products[0].slug).toBe("item-c");
    expect(filterApprovedListings(sa,"sa",{sort:"price_desc"}).products[0].slug).toBe("item-a");
    expect(filterApprovedListings(sa,"sa",{minPriceMinor:6000,maxPriceMinor:10000}).total).toBe(1);
    expect(filterApprovedListings(sa,"sa",{page:2,pageSize:2}).products).toHaveLength(1);
  });
  it("fails closed for invalid market, currencies, duplicate and malformed prices",()=>{
    expect(()=>filterApprovedListings(sa,"ae")).toThrow("invalid_approved_listing");
    expect(()=>filterApprovedListings([...sa,sa[0]],"sa")).toThrow("invalid_approved_listing");
    expect(()=>filterApprovedListings([{...sa[0],price_minor:"1.5"}],"sa")).toThrow();
    expect(()=>filterApprovedListings(sa,"sa",{pageSize:500})).toThrow("invalid_pagination");
    expect(()=>filterApprovedListings(sa,"sa",{minPriceMinor:200,maxPriceMinor:50})).toThrow("invalid_price_range");
    expect(()=>filterApprovedListings(sa,"sa",{query:"x".repeat(121)})).toThrow("invalid_query");
  });
  it("refuses all unverified enrichment and preserves approved public detail",()=>{
    const plain=presentApprovedDetail(detail,"sa",{images:[{url:"https://evil.example/img"}]});
    expect(plain.images).toHaveLength(0);
    expect(plain.variants).toHaveLength(0);
    expect(plain.specifications).toHaveLength(0);
    expect(plain.title).toBe(detail.title);
    expect(validateApprovedExtra({...approved,market:"ae"},detail,"sa")).toBeNull();
    expect(validateApprovedExtra({...approved,listing_id:"different"},detail,"sa")).toBeNull();
    expect(validateApprovedExtra({...approved,images:[{...approved.images[0],url:"javascript:alert(1)"}]},detail,"sa")).toBeNull();
    expect(validateApprovedExtra({...approved,variants:[{...approved.variants[0],approved:false}]},detail,"sa")).toBeNull();
    expect(validateApprovedExtra(approved,detail,"sa")?.images).toHaveLength(2);
  });
});
describe("M2B approved UI",()=>{
  it("renders no invented photo, spec, variant, stock or buy action from existing public detail",()=>{
    const {container}=render(<ApprovedProductGallery detail={detail} market="sa"/>);
    expect(screen.getByText("لا تتوفر صورة معتمدة لهذا المنتج")).toBeTruthy();
    expect(screen.getByText(detail.description)).toBeTruthy();
    expect(screen.queryByText("المواصفات")).toBeNull();
    expect(screen.queryByText("الخيارات المعتمدة")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("button",{name:/شراء|إضافة للسلة|اطلب/})).toBeNull();
  });
  it("renders and switches exclusively approved photos and options",()=>{
    render(<ApprovedProductGallery detail={detail} market="sa" extras={approved}/>);
    expect(screen.getByRole("group",{name:"معرض صور المنتج"})).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"عرض الصورة 2"}));
    expect(screen.getByRole("img",{name:"الخلفية"})).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"لون أحمر"}));
    expect(screen.getByRole("button",{name:"لون أحمر"}).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("قطن")).toBeTruthy();
    expect(screen.queryByRole("button",{name:/شراء|أضف/})).toBeNull();
  });
  it("supports accessible approved-only browsing and reset of pages",()=>{
    const {container}=render(<ApprovedCatalogBrowser market="sa" products={sa}/>);
    expect(screen.getByText("3 منتج متاح للعرض")).toBeTruthy();
    expect(container.querySelectorAll("article")).toHaveLength(3);
    fireEvent.change(screen.getByRole("combobox",{name:"ترتيب المنتجات"}),{target:{value:"price_desc"}});
    const articles=container.querySelectorAll("article");
    expect(within(articles[0] as HTMLElement).getByText(sa[0].title)).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox",{name:"بحث المنتجات"}),{target:{value:"لا يوجد"}});
    expect(screen.getByText("ما لقينا منتجات تطابق اختياراتك")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox",{name:"بحث المنتجات"}),{target:{value:""}});
    fireEvent.change(screen.getByRole("textbox",{name:"أقل سعر"}),{target:{value:"abc"}});
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
