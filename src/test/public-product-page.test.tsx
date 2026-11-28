import {afterEach,describe,expect,it,vi} from "vitest";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import {parsePublicListings,parsePublicProductPage,fetchPublicProductPage,type PublicDetail} from "@/lib/store/public-catalog";
import {ReleasedProductPage} from "@/components/store/ReleasedProductPage";
import {StorePublication} from "@/components/owner/StorePublication";
import {brainClient} from "@/lib/store/brain-client";

const img1="11111111-2222-3333-4444-555555555555.jpg",img2="aaaaaaaa-2222-3333-4444-555555555555.png";
const row={listing_id:"l1",slug:"milk-frother-22929",title:"خفاقة حليب",price_minor:"12900",currency:"SAR"};
const detail:PublicDetail={...row,description:"وصف"};
const vid="aaaaaaaa-1111-2222-3333-444444444444.mp4";
const payload={listing_id:"l1",market:"sa",release:"public_approved",category:"kitchen",
 videos:[vid,vid,"https://youtube.com/x"],quantity_offers:[{quantity:2,price_minor:22900},{quantity:3,price_minor:40000},{quantity:9,price_minor:1}],
 bundle:[{name:"سيروم الشعر",quantity:2,image:img1},{name:"",quantity:1,image:null},{name:"مشط",quantity:1,image:"https://x/y.jpg"}],
 images:[{id:img1,alt:"خفاقة على الطاولة"},{id:img2,alt:""},{id:img1,alt:"dup"},{id:"https://evil.example/x.jpg",alt:"x"}],
 page:{title:"خفاقة حليب كهربائية",subtitle:"رغوة في ثوانٍ",description:"وصف المنتج.",bullets:["سهلة التنظيف",""],specs:[{label:"اللون",value:"أسود"},{label:"",value:"x"}],
  faq:[{q:"هل تعمل بالبطارية؟",a:"نعم."}],tags:["قهوة"],seo:{title:"خفاقة حليب | يومياتي",description:"وصف قصير"}}};
afterEach(()=>{vi.unstubAllGlobals();document.title="";});

describe("released listings with pictures",()=>{
 it("accepts the brain card fields and treats null extras as absent",()=>{
  const [a]=parsePublicListings([{...row,approved_category_slugs:["kitchen"],category_release:"owner_approved",image:img1}],"sa");
  expect(a).toMatchObject({image:img1,approved_category_slugs:["kitchen"]});
  const [b]=parsePublicListings([{...row,approved_category_slugs:null,category_release:null,image:null}],"sa");
  expect(b!.image).toBeUndefined();expect(b!.approved_category_slugs).toBeUndefined();
  expect(()=>parsePublicListings([{...row,image:"https://media.taager.com/"+img1}],"sa")).toThrow();
 });
 it("parses only a released page for this exact listing and market",()=>{
  const page=parsePublicProductPage(payload,"sa","l1")!;
  expect(page.images).toEqual([{id:img1,alt:"خفاقة على الطاولة"},{id:img2,alt:"خفاقة حليب كهربائية"}]);
  expect(page.bullets).toEqual(["سهلة التنظيف"]);
  expect(page.videos).toEqual([vid]);
  expect(page.quantity_offers).toEqual([{quantity:2,price_minor:22900},{quantity:3,price_minor:40000}]);
  expect(page.bundle).toEqual([{name:"سيروم الشعر",quantity:2,image:img1},{name:"مشط",quantity:1,image:null}]);expect(page.specs).toHaveLength(1);expect(page.category).toBe("kitchen");
  expect(parsePublicProductPage(payload,"ae","l1")).toBeNull();
  expect(parsePublicProductPage(payload,"sa","other")).toBeNull();
  expect(parsePublicProductPage({...payload,release:"draft"},"sa","l1")).toBeNull();
  expect(parsePublicProductPage(null,"sa","l1")).toBeNull();
  expect(parsePublicProductPage({...payload,page:{...payload.page,title:" "}},"sa","l1")).toBeNull();
 });
 it("requests the page from the release-gated RPC",async()=>{
  const request=vi.fn(async()=>Response.json(payload));
  const page=await fetchPublicProductPage("https://x.supabase.co","pk","sa",row.slug,"l1",request as unknown as typeof fetch);
  expect(page!.title).toBe("خفاقة حليب كهربائية");
  const [url,init]=request.mock.calls[0]! as unknown as [URL,RequestInit];
  expect(url.pathname).toBe("/rest/v1/rpc/public_product_page");
  expect(JSON.parse(String(init.body))).toEqual({p_store:"sa",p_slug:row.slug});
  await expect(fetchPublicProductPage("https://x.supabase.co","pk","sa","a/b","l1",request as unknown as typeof fetch)).rejects.toThrow();
 });
 it("renders the approved page with same-origin pictures, or the fallback when there is none",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>Response.json(payload)));
  const {unmount,container}=render(<ReleasedProductPage origin="https://x.supabase.co" apiKey="pk" market="sa" detail={detail} fallback={<p>plain</p>}/>);
  expect(screen.getByText("plain")).toBeInTheDocument();
  expect(await screen.findByRole("heading",{level:1,name:"خفاقة حليب كهربائية"})).toBeInTheDocument();
  // The first picture paints from the cached card-size file, then sharpens once the page is idle.
  expect(screen.getByAltText("خفاقة على الطاولة")).toHaveAttribute("src","/media/p/360/"+img1);
  expect(screen.getByText("سهلة التنظيف")).toBeInTheDocument();
  expect(screen.getByText("هل تعمل بالبطارية؟")).toBeInTheDocument();
  expect(screen.getAllByText(/الدفع عند الاستلام/).length).toBeGreaterThan(0);
  expect(container.innerHTML).not.toMatch(/taager/i);
  // 2 for 229 SAR saves 29 SAR on 2 × 129; 3 for 400 is dearer than 3 × 129 and is not offered.
  const two=screen.getByRole("radio",{name:/قطعتين/});
  expect(two.closest("label")).toHaveTextContent("٢٢٩");
  expect(two.closest("label")).toHaveTextContent(/وفّري.*٢٩/);
  expect(screen.queryByRole("radio",{name:/3 قطع/})).toBeNull();
  expect(screen.getAllByRole("radio")).toHaveLength(2);
  expect(screen.getByText("سيروم الشعر")).toBeInTheDocument();expect(screen.getByText("× 2")).toBeInTheDocument();
  // The video downloads nothing until she presses play.
  expect(container.querySelector("video")).toBeNull();
  fireEvent.click(screen.getAllByRole("button",{name:"شوفي الفيديو"})[0]!);
  expect(container.querySelector("video source")).toHaveAttribute("src","/media/v/"+vid);
  expect(screen.getByAltText("خفاقة حليب كهربائية")).toHaveAttribute("src","/media/p/"+img2);
  expect(screen.getByRole("button",{name:"اطلبي الآن"})).toBeInTheDocument();
  await waitFor(()=>expect(document.title).toBe("خفاقة حليب | يومياتي"));
  unmount();
  vi.stubGlobal("fetch",vi.fn(async()=>Response.json(null)));
  render(<ReleasedProductPage origin="https://x.supabase.co" apiKey="pk" market="sa" detail={detail} fallback={<p>plain only</p>}/>);
  await waitFor(()=>expect(fetch).toHaveBeenCalled());
  expect(screen.getByText("plain only")).toBeInTheDocument();
 });
});

describe("owner store publication panel",()=>{
 it("publishes approved picks, explains what was left out and shows the store",async()=>{
  const calls:string[]=[];
  let released=false;
  vi.stubGlobal("fetch",vi.fn(async(url:URL|string,init?:RequestInit)=>{
   const path=new URL(String(url)).pathname.split("/").pop()!;calls.push(path+" "+String(init?.body));
   if(path==="brain_publication_status")return Response.json({release_enabled:released,stock_max_age_hours:72,last_sync_at:new Date().toISOString(),listings:2,ready:1,hidden:{out_of_stock:1},
    sample:[{listing_id:"l1",slug:"a",title:"خفاقة",price_minor:12900,image:img1,hidden_reason:null},{listing_id:"l2",slug:"b",title:"مكواة",price_minor:9900,image:null,hidden_reason:"out_of_stock"}]});
   if(path==="brain_publish_approved")return Response.json({published:1,updated:1,skipped:[{product_id:5,variation_id:0,title:"منتج",reason:"below_supplier_cost"}]});
   if(path==="brain_set_release"){released=JSON.parse(String(init?.body)).p_enabled;return Response.json(released);}
   return Response.json(0);
  }));
  const client=brainClient("https://x.supabase.co","pk","tok");
  render(<StorePublication client={client} market="sa" runId="r1" approved={3}/>);
  expect(await screen.findByText("Store hidden from visitors")).toBeInTheDocument();
  expect(screen.getAllByText(/out of stock at Taager/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button",{name:/Publish approved products \(3\)/}));
  expect(await screen.findByText(/would be a loss/)).toBeInTheDocument();
  expect(calls.some(c=>c.startsWith("brain_publish_approved")&&c.includes('"p_run":"r1"'))).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:/Show store to visitors/}));
  expect(await screen.findByText("Store shown to visitors")).toBeInTheDocument();
  expect(screen.getByRole("link",{name:"Open /sa"})).toHaveAttribute("href","/sa/search");
 });
 it("cannot publish without a run or approved products",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>Response.json({})));
  render(<StorePublication client={brainClient("https://x.supabase.co","pk","tok")} market="sa" runId={null} approved={0}/>);
  expect(screen.getByRole("button",{name:/Publish approved products/})).toBeDisabled();
 });
});
