import {afterEach,describe,expect,it} from "vitest";
import {cartAddOns,completeTheSet,relatedProducts,sameness} from "../lib/store/recommendations";
import {readViewed,rememberViewed} from "../lib/store/recently-viewed";
import {priceForQuantity,parseCart,addToCart,readCart,setLineQuantity} from "../lib/store/shop-cart";
import type {PublicListing} from "../lib/store/public-catalog";

const row=(slug:string,title:string,cat:string,price:number,rank:number):PublicListing=>({listing_id:"id-"+slug,slug,title,price_minor:String(price),currency:"SAR",approved_category_slugs:[cat as never],rank});
const rows=[
 row("grill","طاولة شواء خارجية محمولة","kitchen",22500,1),row("grill-2","عرض طاولتين شواء خارجية محمولة","kitchen",39900,9),
 row("blender","خلاط كهربائي للعصائر","kitchen",15000,2),row("rack","رف تنظيم المطبخ","organize",9900,3),
 row("lamp","مصباح طاولة للمنزل","home",8000,4),row("serum","سيروم العناية بالشعر","beauty",6000,5),row("sofa","كنبة فاخرة","home",90000,6),
];
afterEach(()=>window.localStorage.clear());
describe("recommendations from the released catalogue",()=>{
 it("complete the set pairs partner sections, skips other packs of the same product and anything dearer",()=>{
  const set=completeTheSet(rows[0]!,rows);
  expect(set.map(r=>r.slug)).toEqual(["rack","lamp","blender"]);
  expect(set.some(r=>r.slug==="grill-2"||r.slug==="sofa"||r.slug==="serum")).toBe(false);
  expect(sameness(rows[0]!.title,rows[1]!.title)).toBeGreaterThan(0.7);
 });
 it("related products prefer the same section and never repeat the product itself",()=>{
  const related=relatedProducts(rows[0]!,rows,3).map(r=>r.slug);
  expect(related[0]).toBe("blender");expect(related).not.toContain("grill");expect(related).not.toContain("grill-2");
 });
 it("cart add-ons exclude what is already in the cart and never cost more than her dearest item",()=>{
  const picks=cartAddOns([rows[2]!],rows).map(r=>r.slug);
  expect(picks).toEqual(["rack","lamp"]);
 });
 it("is the same for every shopper: results depend only on the catalogue and the inputs",()=>{
  expect(completeTheSet(rows[0]!,rows)).toEqual(completeTheSet(rows[0]!,[...rows].reverse()));
 });
});
describe("viewed before stays in the browser and needs consent",()=>{
 it("stores nothing until consent is granted, and forgets when consent is not granted",()=>{
  rememberViewed("sa","grill");expect(readViewed("sa")).toEqual([]);expect(window.localStorage.length).toBe(0);
  window.localStorage.setItem("yawmiyati.consent.v1","granted");
  rememberViewed("sa","grill");rememberViewed("sa","rack");rememberViewed("sa","grill");rememberViewed("sa","bad/slug");
  expect(readViewed("sa")).toEqual(["grill","rack"]);expect(readViewed("iq")).toEqual([]);
  window.localStorage.setItem("yawmiyati.consent.v1","denied");
  expect(readViewed("sa")).toEqual([]);rememberViewed("sa","lamp");
  expect(window.localStorage.getItem("yawmiyati.viewed.v1.sa")).toBeNull();
 });
});
describe("browser cart",()=>{
 it("prices a quantity with the cheapest mix of approved offers and ignores offers that are not cheaper",()=>{
  const offers=[{quantity:2,price_minor:39900},{quantity:3,price_minor:54900},{quantity:4,price_minor:99900}];
  expect(priceForQuantity(22500n,offers,1)).toEqual({total:22500n,saving:0n});
  expect(priceForQuantity(22500n,offers,2)).toEqual({total:39900n,saving:5100n});
  expect(priceForQuantity(22500n,offers,4).total).toBe(77400n); // 3-pack + 1 single beats two 2-packs (79800)
  expect(priceForQuantity(22500n,offers,5).total).toBe(94800n); // 3-pack + 2-pack
  expect(()=>priceForQuantity(22500n,offers,0)).toThrow();
 });
 it("keeps identities and quantities only, caps quantities and drops malformed lines",()=>{
  addToCart("sa",{kind:"item",listing_id:"a",slug:"grill",title:"طاولة",image:null,quantity:2});
  addToCart("sa",{kind:"item",listing_id:"a",slug:"grill",title:"طاولة",image:null,quantity:9});
  expect(readCart("sa").lines).toEqual([{kind:"item",listing_id:"a",slug:"grill",title:"طاولة",image:null,quantity:6}]);
  expect(JSON.stringify(readCart("sa"))).not.toMatch(/price/);
  expect(readCart("iq").lines).toEqual([]);
  setLineQuantity("sa","i:a",0);expect(readCart("sa").lines).toEqual([]);
  expect(parseCart({lines:[{kind:"item",listing_id:"x",slug:"a/b",title:"t",quantity:1},{kind:"item",listing_id:"y",slug:"ok",title:"t",quantity:99},{kind:"bundle",bundle_id:"b1",slug:"set",title:"طقم",image:null,quantity:1}]},"sa").lines.map(l=>l.slug)).toEqual(["set"]);
 });
});
