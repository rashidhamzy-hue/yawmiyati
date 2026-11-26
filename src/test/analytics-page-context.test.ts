import {describe,it,expect} from "vitest";
import {pageContext} from "../lib/analytics/page-context";
describe("analytics page context",()=>{
 it("classifies every market page type with its currency",()=>{
  expect(pageContext("/")).toEqual({market:null,currency:null,page_type:"market_select",page_slug:null});
  expect(pageContext("/sa")).toMatchObject({market:"sa",currency:"SAR",page_type:"home"});
  expect(pageContext("/ae/c/kitchen")).toMatchObject({market:"ae",currency:"AED",page_type:"category",page_slug:"kitchen"});
  expect(pageContext("/om/p/salad-spinner")).toMatchObject({market:"om",currency:"OMR",page_type:"product",page_slug:"salad-spinner"});
  expect(pageContext("/eg/checkout")).toMatchObject({market:"eg",currency:"EGP",page_type:"checkout"});
  expect(pageContext("/iq/cart")).toMatchObject({market:"iq",currency:"IQD",page_type:"cart"});
  expect(pageContext("/sa/info/shipping-returns")).toMatchObject({page_type:"info",page_slug:"shipping-returns"});
  expect(pageContext("/admin")).toMatchObject({page_type:"admin",market:null});
  expect(pageContext("/xx/c/a")).toMatchObject({page_type:"other",market:null});
 });
});
