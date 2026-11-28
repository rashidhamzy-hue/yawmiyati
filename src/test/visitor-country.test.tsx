import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,render,screen,waitFor,fireEvent} from "@testing-library/react";
vi.mock("@/lib/analytics/analytics",()=>({track:vi.fn()}));
import {countryFromRequest,handleVisitorCountry,isBot,phoneFromOtherMarket,rootRedirect,sameSpotIn,visitorPlace} from "../lib/store/visitor-country";
import {validateCod} from "../lib/store/cod-checkout";
import {sharedPageLinks} from "../lib/seo/site";
import {StoreChooser} from "../components/store/StoreChooser";
import {rememberedStore,storesInOrder} from "../lib/store/chosen-store";
import {CodCheckoutForm} from "../components/store/CodCheckoutForm";

const UA="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
const req=(path:string,country?:string,ua:string|null=UA)=>new Request("https://yawmiyati.shop"+path,{headers:{...(country?{"cf-ipcountry":country}:{}),...(ua?{"user-agent":ua}:{})}});

describe("root: visitors from our countries go to their store, everyone else and bots get the chooser",()=>{
 it("redirects by Cloudflare's country header, uncached, keeping campaign parameters",()=>{
  for(const [c,m] of [["SA","sa"],["AE","ae"],["OM","om"],["EG","eg"],["IQ","iq"],["eg","eg"]] as const){
   const r=rootRedirect(req("/?utm_source=fb",c))!;
   expect(r.status).toBe(302);expect(r.headers.get("location")).toBe("/"+m+"?utm_source=fb");expect(r.headers.get("cache-control")).toBe("private, no-store");
  }
 });
 it("shows the chooser to other countries, unknown countries, Tor, bots, an explicit choice, and never touches other paths",()=>{
  for(const c of ["LB","JO","KW","DE","XX","T1",undefined])expect(rootRedirect(req("/",c))).toBeNull();
  expect(rootRedirect(req("/","SA","Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"))).toBeNull();
  expect(rootRedirect(req("/","SA","facebookexternalhit/1.1"))).toBeNull();
  expect(rootRedirect(req("/","SA",null))).toBeNull();
  expect(rootRedirect(req("/?choose=1","SA"))).toBeNull();
  expect(rootRedirect(req("/sa","EG"))).toBeNull();expect(rootRedirect(req("/ae/p/x","SA"))).toBeNull(); // store pages are never redirected
  expect(isBot("Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36")).toBe(false);expect(isBot("GPTBot/1.0")).toBe(true);
 });
 it("the country endpoint answers from the header only and is never cached",async()=>{
  const r=handleVisitorCountry(req("/api/visitor-country","ae"))!;
  expect(await r.json()).toEqual({country:"AE",market:"ae"});expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect(await handleVisitorCountry(req("/api/visitor-country","LB"))!.json()).toEqual({country:"LB",market:null});
  expect(await handleVisitorCountry(req("/api/visitor-country"))!.json()).toEqual({country:null,market:null});
  expect(handleVisitorCountry(req("/sa"))).toBeNull();
  expect(countryFromRequest(req("/","x1"))).toBeNull();
 });
 it("the chooser links every store with its own hreflang, and home pages point x-default at it",()=>{
  const {container}=render(<StoreChooser/>);
  expect([...container.querySelectorAll("[data-store-link]")].map(a=>[a.getAttribute("href"),a.getAttribute("hreflang")])).toEqual([["/sa","ar-SA"],["/ae","ar-AE"],["/om","ar-OM"],["/eg","ar-EG"],["/iq","ar-IQ"]]);
  expect(screen.getByRole("heading",{level:1}).textContent).toBe("تفاصيل صغيرة تجمّل يومك");
  expect(screen.getByRole("heading",{level:2}).textContent).toBe("اختاري بلد التوصيل");
  // Each store says what it offers in its own words, with the currency by name and no flag emoji.
  expect(container.querySelector('[data-store-link="eg"]')!.textContent).toContain("جنيه مصري");
  expect(container.querySelector('[data-store-link="eg"]')!.textContent).toContain("الدفع كاش عند الاستلام · التوصيل جوه مصر");
  expect(container.textContent).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u);
  expect(container.querySelector("img")!.getAttribute("src")).toMatch(/^\/media\/photo-/);
  expect(sharedPageLinks("eg").find(l=>l.hrefLang==="x-default")!.href).toBe("https://yawmiyati.shop/");
  expect(sharedPageLinks("eg","/info/help").find(l=>l.hrefLang==="x-default")!.href).toBe("https://yawmiyati.shop/sa/info/help");
  expect(sharedPageLinks("eg").filter(l=>l.rel==="alternate")).toHaveLength(6);
 });
 it("remembers the store picked on the chooser in this browser and shows it first next time, without redirecting",async()=>{
  window.localStorage.clear();
  const first=render(<StoreChooser/>);
  const eg=first.container.querySelector('[data-store-link="eg"]')!;
  eg.addEventListener("click",e=>e.preventDefault());fireEvent.click(eg);
  expect(window.localStorage.getItem("yawmiyati.store")).toBe("eg");
  first.unmount();
  const {container}=render(<StoreChooser/>);
  await waitFor(()=>expect([...container.querySelectorAll("[data-store-link]")].map(a=>a.getAttribute("data-store-link"))).toEqual(["eg","sa","ae","om","iq"]));
  expect(container.querySelector("[data-remembered]")!.getAttribute("data-store-link")).toBe("eg");
  expect(storesInOrder(["sa","ae"],"iq")).toEqual(["sa","ae"]);
  window.localStorage.setItem("yawmiyati.store","xx");expect(rememberedStore()).toBeNull();
  window.localStorage.clear();
 });
});

describe("a visitor on another country's store",()=>{
 it("is told which store is hers, never blocked; unknown countries get the delivery note",()=>{
  expect(visitorPlace("sa","SA")).toEqual({kind:"same"});
  expect(visitorPlace("sa","AE")).toEqual({kind:"other_store",market:"ae"});
  expect(visitorPlace("iq","LB")).toEqual({kind:"elsewhere"});expect(visitorPlace("iq",null)).toEqual({kind:"elsewhere"});
 });
 it("links to the same spot in her store: section and offers pages as they are, a product by its name, otherwise home",()=>{
  expect(sameSpotIn("ae","/sa/c/kitchen")).toBe("/ae/c/kitchen");expect(sameSpotIn("ae","/sa/offers")).toBe("/ae/offers");
  expect(sameSpotIn("eg","/iq/p/some-slug","خلاط محمول")).toBe("/eg/search?q="+encodeURIComponent("خلاط محمول"));
  expect(sameSpotIn("eg","/iq/p/some-slug")).toBe("/eg");expect(sameSpotIn("om","/sa/cart")).toBe("/om");expect(sameSpotIn("om","/sa")).toBe("/om");
 });
});

describe("the notice bar",()=>{
 afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.resetModules();window.localStorage.clear();});
 const mount=async(country:string|null,market:"sa"|"eg")=>{
  vi.stubGlobal("fetch",vi.fn(async()=>Response.json({country,market:null})));
  const {default:CountryNotice}=await import("../components/store/CountryNotice");
  return render(<CountryNotice market={market}/>);
 };
 it("speaks the store's dialect, offers her own store, and remembers the dismissal in this browser",async()=>{
  const first=await mount("AE","sa");
  await waitFor(()=>expect(first.container.querySelector("[data-country-notice=other_store]")).toBeTruthy());
  expect(first.container.textContent).toContain("أنتِ في الإمارات، وهذا المتجر يوصّل داخل السعودية بس.");
  expect(screen.getByRole("link",{name:"روحي لمتجر الإمارات"}).getAttribute("href")).toBe("/ae");
  fireEvent.click(screen.getByRole("button",{name:"إغلاق التنبيه"}));
  expect(first.container.querySelector("[data-country-notice]")).toBeNull();
  expect(window.localStorage.getItem("yawmiyati.place.sa.ae")).toBe("1");
  cleanup();vi.resetModules();
  const again=await mount("AE","sa");
  await new Promise(r=>setTimeout(r,20));
  expect(again.container.querySelector("[data-country-notice]")).toBeNull();
 });
 it("shows nothing at home, and only a delivery note elsewhere or when the country is unknown",async()=>{
  const home=await mount("EG","eg");await new Promise(r=>setTimeout(r,20));
  expect(home.container.innerHTML).toBe("");
  cleanup();vi.resetModules();
  const abroad=await mount(null,"eg");
  await waitFor(()=>expect(abroad.container.querySelector("[data-country-notice=elsewhere]")).toBeTruthy());
  expect(abroad.container.textContent).toContain("المتجر ده بيوصّل جوه مصر بس");
  expect(screen.getByRole("link",{name:"كل المتاجر"}).getAttribute("href")).toBe("/?choose=1");
 });
});

describe("order form: the delivery country is the store's country",()=>{
 it("recognises a number from another of our countries and says where to order instead",()=>{
  expect(phoneFromOtherMarket("sa","+971501234567")).toBe("ae");expect(phoneFromOtherMarket("sa","00201012345678")).toBe("eg");
  expect(phoneFromOtherMarket("sa","+966501234567")).toBeNull();expect(phoneFromOtherMarket("sa","0501234567")).toBeNull();expect(phoneFromOtherMarket("eg","+9611234567")).toBeNull();
  const e=validateCod("sa",{name:"سارة أحمد",phone:"+971501234567",city:"الرياض",address:"حي النخيل شارع 5",notes:""});
  expect(e.phone).toContain("هذا رقم من الإمارات");expect(e.phone).toContain("داخل السعودية");
  expect(validateCod("sa",{name:"سارة أحمد",phone:"12345",city:"الرياض",address:"حي النخيل شارع 5",notes:""}).phone).toMatch(/05xxxxxxxx/);
  expect(validateCod("eg",{name:"منى علي",phone:"01012345678",city:"القاهرة",address:"مدينة نصر شارع 9",notes:""}).phone).toBeUndefined();
 });
 it("shows the fixed country and that the person receiving pays on delivery",()=>{
  const {container}=render(<CodCheckoutForm market="iq"/>);
  const box=container.querySelector("[data-delivery-country=iq]")!;
  expect(box.textContent).toContain("العراق");expect(box.textContent).toContain("التوصيل داخل العراق بس");expect(box.textContent).toContain("اللي يستلم الطلب هو اللي يدفع عند الاستلام");
  expect(container.querySelector("select[name=country],input[name=country]")).toBeNull(); // nothing to change
 });
});
