import {describe,expect,it,vi} from "vitest";
import {render,screen} from "@testing-library/react";
vi.mock("@/lib/analytics/analytics",()=>({track:vi.fn()}));
import {freeDeliveryState,lineEligible,timeLeft,type FreeDeliveryLine} from "../lib/store/free-delivery";
import {parseStoreOffers,type StoreOffers} from "../lib/store/store-offers";
import {parsePublicListings,parsePublicProductPage,type PublicListing} from "../lib/store/public-catalog";
import {FreeDeliveryBar,OfferUntil} from "../components/store/FreeDelivery";
import {ProductTile} from "../components/store/ProductTile";
import {track} from "../lib/analytics/analytics";

const row=(id:string,price:string,extra:Partial<PublicListing>={}):PublicListing=>({listing_id:id,slug:id,title:"منتج "+id,price_minor:price,currency:"SAR",...extra});
const item=(id:string,total:bigint,r:PublicListing|null,saving=0n):FreeDeliveryLine=>({line:{kind:"item",listing_id:id,slug:id,title:id,image:null,quantity:1},available:!!r,total,saving,row:r,bundle:null});
const offers=(o:Partial<StoreOffers>={}):StoreOffers=>({free_delivery:{threshold_minor:40000},bundles:[],delivery_included:[],...o});
const none=new Map<string,{free_delivery?:boolean}[]>();

describe("free delivery in the cart: eligible products only",()=>{
 it("counts flagged lines toward the threshold and leaves unflagged ones out with a note",()=>{
  const lines=[item("a",25000n,row("a","25000",{free_delivery:true})),item("thin",30000n,row("thin","30000"))];
  const s=freeDeliveryState(lines,offers(),none);
  expect(s).toMatchObject({offered:true,free:false,eligible:25000n,left:15000n,progress:62,partial:true,why:null});
  const reached=freeDeliveryState([...lines,item("b",15000n,row("b","15000",{free_delivery:true}))],offers(),none);
  expect(reached).toMatchObject({free:true,why:"threshold",left:0n,progress:100});
 });
 it("a discounted quantity price counts only when the database flagged the offer; a set by its own flag",()=>{
  const packed=item("a",38000n,row("a","20000",{free_delivery:true}),2000n);
  expect(lineEligible(packed,[{free_delivery:true}])).toBe(true);
  expect(lineEligible(packed,[{}])).toBe(false);
  expect(lineEligible({...packed,saving:0n},[{}])).toBe(true);
  const set=(flag:boolean):FreeDeliveryLine=>({line:{kind:"bundle",bundle_id:"s",slug:"s",title:"s",image:null,quantity:1},available:true,total:45000n,saving:1000n,row:null,
   bundle:{id:"s",slug:"s",title:"طقم",price_minor:45000,items:[],...(flag?{free_delivery:true}:{})}});
  expect(freeDeliveryState([set(true)],offers(),none).free).toBe(true);
  expect(freeDeliveryState([set(false)],offers(),none)).toMatchObject({free:false,eligible:0n,partial:true});
 });
 it("a product with delivery in its price makes the order ship free; nothing is free without an approved rule or when a line is unavailable",()=>{
  const inc=freeDeliveryState([item("p",9900n,row("p","9900"))],offers({free_delivery:null,delivery_included:["p"]}),none);
  expect(inc).toMatchObject({offered:false,free:true,why:"included",progress:100,partial:false});
  expect(freeDeliveryState([item("p",9900n,row("p","9900",{delivery_included:true}))],offers({free_delivery:null}),none).free).toBe(true);
  expect(freeDeliveryState([item("a",90000n,row("a","90000",{free_delivery:true}))],offers({free_delivery:null}),none)).toMatchObject({offered:false,free:false});
  expect(freeDeliveryState([item("a",90000n,row("a","90000",{free_delivery:true})),item("gone",0n,null)],offers(),none,true).free).toBe(false);
 });
 it("the bar shows the amount left in the market's wording, then the reached state, and reports it once",()=>{
  const left=freeDeliveryState([item("a",25000n,row("a","25000",{free_delivery:true}))],offers(),none);
  const {rerender,container}=render(<FreeDeliveryBar market="sa" state={left} where="cart"/>);
  expect(screen.getByText(/باقي لك .*(150|١٥٠).* للتوصيل المجاني/)).toBeTruthy();
  expect(container.querySelector("[role=progressbar]")!.getAttribute("aria-valuenow")).toBe("62");
  const done=freeDeliveryState([item("a",45000n,row("a","45000",{free_delivery:true}))],offers(),none);
  rerender(<FreeDeliveryBar market="sa" state={done} where="cart"/>);rerender(<FreeDeliveryBar market="sa" state={done} where="cart"/>);
  expect(screen.getByText("طلبك مؤهل للتوصيل المجاني")).toBeTruthy();
  expect(vi.mocked(track).mock.calls.filter(c=>c[0]==="free_delivery_reached")).toHaveLength(1);
  const off=render(<FreeDeliveryBar market="eg" state={freeDeliveryState([],offers({free_delivery:null}),none)} where="product"/>);
  expect(off.container.innerHTML).toBe("");
  render(<FreeDeliveryBar market="eg" state={freeDeliveryState([item("a",25000n,row("a","25000",{free_delivery:true})),item("t",1n,row("t","1"))],offers(),none)} where="cart"/>);
  expect(screen.getByText(/فاضل لك .* على الشحن المجاني/)).toBeTruthy();expect(screen.getByText(/مش داخل في حساب الشحن المجاني/)).toBeTruthy();
 });
});

describe("approved offers arrive fail-closed",()=>{
 const now=Date.parse("2026-12-01T00:00:00Z");
 it("an offer price replaces the normal price only while it is lower and its end date is ahead; 'was' only when the database sends it",()=>{
  const base={listing_id:"1",slug:"p",title:"منتج",price_minor:"14900",currency:"SAR"};
  const [live]=parsePublicListings([{...base,sale_price_minor:12900,sale_ends_at:"2026-12-05T00:00:00Z",was_price_minor:14900,free_delivery:true,is_new:true,trending:false}],"sa",now);
  expect(live).toMatchObject({price_minor:"12900",sale:{ends_at:"2026-12-05T00:00:00Z",list_price_minor:"14900",was_price_minor:"14900"},free_delivery:true,is_new:true});
  expect(live!.trending).toBeUndefined();
  expect(parsePublicListings([{...base,sale_price_minor:12900,sale_ends_at:"2026-12-05T00:00:00Z"}],"sa",now)[0]!.sale).toEqual({ends_at:"2026-12-05T00:00:00Z",list_price_minor:"14900"});
  for(const bad of [{sale_price_minor:12900,sale_ends_at:"2026-11-30T00:00:00Z"},{sale_price_minor:15900,sale_ends_at:"2026-12-05T00:00:00Z"},{sale_price_minor:12900},{sale_price_minor:"12900",sale_ends_at:"2026-12-05T00:00:00Z"}]){
   const [r]=parsePublicListings([{...base,...bad}],"sa",now);expect(r!.price_minor).toBe("14900");expect(r!.sale).toBeUndefined();
  }
 });
 it("the product page carries the sale, eligibility and delivery-included flags",()=>{
  const data={release:"public_approved",market:"sa",listing_id:"1",page:{title:"خلاط",description:"وصف"},images:[],quantity_offers:[{quantity:2,price_minor:25900,free_delivery:true},{quantity:3,price_minor:37900}],
   sale:{price_minor:12900,ends_at:new Date(Date.now()+5*86400000).toISOString(),was_price_minor:null},free_delivery:true,delivery_included:false};
  const page=parsePublicProductPage(data,"sa","1")!;
  expect(page.sale).toMatchObject({price_minor:12900,was_price_minor:null});expect(page.free_delivery).toBe(true);expect(page.delivery_included).toBe(false);
  expect(page.quantity_offers).toEqual([{quantity:2,price_minor:25900,free_delivery:true},{quantity:3,price_minor:37900}]);
  expect(parsePublicProductPage({...data,sale:{price_minor:12900,ends_at:"2020-01-01T00:00:00Z"}},"sa","1")!.sale).toBeNull();
 });
 it("store offers: threshold with its end date, delivery-included listings, themed set fields; an ended rule is dropped",()=>{
  const good={market:"sa",release:"owner_approved",free_delivery:{threshold_minor:40000,ends_at:new Date(Date.now()+86400000).toISOString()},delivery_included:["l1",5,""],
   bundles:[{id:"b",slug:"routine-hair-care-3",title:"روتين العناية بالشعر",tagline:"كل ما يحتاجه شعرك",theme:"hair-care",free_delivery:true,price_minor:29900,items:[{listing_id:"a",quantity:1},{listing_id:"b",quantity:1},{listing_id:"c",quantity:1}]}]};
  const o=parseStoreOffers(good,"sa");
  expect(o.free_delivery!.threshold_minor).toBe(40000);expect(o.delivery_included).toEqual(["l1"]);
  expect(o.bundles[0]).toMatchObject({tagline:"كل ما يحتاجه شعرك",theme:"hair-care",free_delivery:true});
  expect(parseStoreOffers({...good,free_delivery:{threshold_minor:40000,ends_at:"2020-01-01T00:00:00Z"}},"sa").free_delivery).toBeNull();
 });
 it("tiles show the offer price with its end date, a crossed-out price only when one was charged, and the delivery label",()=>{
  const {container,rerender}=render(<ProductTile market="sa" item={row("a","12900",{sale:{ends_at:"2026-12-28T19:59:59Z",list_price_minor:"14900"},delivery_included:true})}/>);
  expect(container.querySelector("[data-offer-until]")!.textContent).toMatch(/عرض لين (28|٢٨) ديسمبر/);
  expect(container.querySelector("s")).toBeNull();expect(screen.getByText("توصيل مجاني")).toBeTruthy();
  rerender(<ProductTile market="sa" item={row("a","12900",{sale:{ends_at:"2026-12-28T19:59:59Z",list_price_minor:"14900",was_price_minor:"14900"}})}/>);
  expect(container.querySelector("s")!.textContent).toMatch(/149|١٤٩/);
 });
 it("the countdown comes only from the real end date and disappears when it has passed",()=>{
  expect(timeLeft("2026-12-03T05:00:00Z",Date.parse("2026-12-01T00:00:00Z"))).toEqual({days:2,hours:5});
  expect(timeLeft("2026-11-30T00:00:00Z",Date.parse("2026-12-01T00:00:00Z"))).toBeNull();expect(timeLeft("soon")).toBeNull();
  const {container}=render(<OfferUntil market="iq" endsAt="2020-01-01T00:00:00Z"/>);expect(container.innerHTML).toBe("");
  const live=render(<OfferUntil market="eg" endsAt={new Date(Date.now()+30*3600000).toISOString()}/>);
  expect(live.container.textContent).toMatch(/عرض لحد/);expect(live.container.textContent).toMatch(/العرض هيخلص بعد يوم/);
 });
});
