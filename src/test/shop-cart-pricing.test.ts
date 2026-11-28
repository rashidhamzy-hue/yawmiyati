import {describe,expect,it} from "vitest";
import {priceCart} from "../components/store/ShopCartPage";
import {parseStoreOffers,NO_OFFERS} from "../lib/store/store-offers";
import {deliveryFee,egyptDestinations} from "../lib/store/delivery-fees";
import {formatPrice,type PublicListing} from "../lib/store/public-catalog";
import type {CartLine} from "../lib/store/shop-cart";

const row=(id:string,price:number):PublicListing=>({listing_id:id,slug:id,title:"منتج "+id,price_minor:String(price),currency:"SAR"});
const rows=[row("a",22500),row("b",16000)];
const item=(id:string,quantity:number):CartLine=>({kind:"item",listing_id:id,slug:id,title:"t",image:null,quantity});
describe("cart totals come from the released catalogue and approved offers only",()=>{
 it("applies quantity offers, reports the saving and the next-piece nudge",()=>{
  const offers=new Map([["a",[{quantity:2,price_minor:39900}]]]);
  const one=priceCart([item("a",1),item("b",1)],rows,[],offers);
  expect(one.subtotal).toBe(38500n);expect(one.saving).toBe(0n);expect(one.lines[0]!.nextSaving).toBe(5100n);expect(one.lines[1]!.nextSaving).toBe(0n);
  const two=priceCart([item("a",2),item("b",1)],rows,[],offers);
  expect(two.subtotal).toBe(55900n);expect(two.saving).toBe(5100n);expect(two.blocked).toBe(false);
 });
 it("blocks the order while a line is no longer released, and never counts it",()=>{
  const cart=priceCart([item("gone",1),item("b",1)],rows,[],new Map());
  expect(cart.blocked).toBe(true);expect(cart.subtotal).toBe(16000n);
 });
 it("prices an approved set once, and refuses a set that is missing a piece or is not cheaper than its pieces",()=>{
  const set={id:"s1",slug:"set-a-b",title:"طقم",price_minor:34900,items:[{listing_id:"a",quantity:1},{listing_id:"b",quantity:1}]};
  const line:CartLine={kind:"bundle",bundle_id:"s1",slug:"set-a-b",title:"طقم",image:null,quantity:1};
  expect(priceCart([line],rows,[set],new Map())).toMatchObject({subtotal:34900n,saving:3600n,blocked:false});
  expect(priceCart([line],[rows[0]!],[set],new Map()).blocked).toBe(true);
  expect(priceCart([line],rows,[{...set,price_minor:38500}],new Map()).blocked).toBe(true);
  expect(priceCart([line],rows,[],new Map()).blocked).toBe(true);
 });
});
describe("store offers contract fails closed",()=>{
 it("accepts only an owner-approved payload for this market",()=>{
  const good={market:"sa",release:"owner_approved",free_delivery:{threshold_minor:65000},bundles:[{id:"1",slug:"set-a-b",title:"طقم",price_minor:34900,items:[{listing_id:"a",quantity:1},{listing_id:"b",quantity:1}]}]};
  expect(parseStoreOffers(good,"sa").free_delivery).toEqual({threshold_minor:65000});
  expect(parseStoreOffers(good,"sa").bundles).toHaveLength(1);
  expect(parseStoreOffers(good,"iq")).toEqual(NO_OFFERS);
  expect(parseStoreOffers({...good,release:"proposed"},"sa")).toEqual(NO_OFFERS);
  expect(parseStoreOffers(null,"sa")).toEqual(NO_OFFERS);
  const bad={...good,free_delivery:{threshold_minor:-5},bundles:[{...good.bundles[0],items:[{listing_id:"a",quantity:1}]},{...good.bundles[0],slug:"x/y"},{...good.bundles[0],price_minor:"34900"}]};
  expect(parseStoreOffers(bad,"sa")).toEqual(NO_OFFERS);
 });
});
describe("delivery fee shown in the cart matches the service pages",()=>{
 it("is flat outside Egypt and by destination in Egypt",()=>{
  expect(deliveryFee("sa")).toBe(2800);expect(deliveryFee("ae")).toBe(1900);expect(deliveryFee("om")).toBe(3000);expect(deliveryFee("iq")).toBe(7000000);
  expect(deliveryFee("eg")).toBeNull();expect(deliveryFee("eg","القاهرة")).toBe(9500);expect(deliveryFee("eg","طنطا")).toBe(10000);expect(deliveryFee("eg","أسوان")).toBe(10500);
  expect(deliveryFee("eg","مكان غير مدرج")).toBeNull();expect(new Set(egyptDestinations).size).toBe(egyptDestinations.length);
 });
 it("formats whole prices without an empty fraction and keeps real fractions",()=>{
  expect(formatPrice("22500","sa")).toMatch(/٢٢٥/);expect(formatPrice("22500","sa")).not.toMatch(/٫/);
  expect(formatPrice("4500","om")).toMatch(/٤٫٥٠٠/);expect(formatPrice(7000000n,"iq")).toMatch(/٧٬٠٠٠/);
 });
});
