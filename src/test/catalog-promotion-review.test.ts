import {describe,expect,it} from "vitest";
import {promotionReview} from "../../scripts/catalog/workspace";
import type {Offer} from "../lib/store/offer-selection";

const offer={sellerFloor:700,shopperShipping:100,economics:{price:1000,supplierCost:500,outboundDelivery:0,
  deliveredFees:0,returnCost:0,adCost:50,deliveryBps:8000}} as Offer;
describe("catalog promotion review",()=>{
 it("keeps the seller floor and expected profit target when comparing the same pack",()=>{
  const options=promotionReview(offer,250,[]);
  expect(options.map(x=>[x.kind,x.doorTotalMinor,x.expectedContributionMinor])).toEqual([
   ["regular",1100,"350"],["maximum_item_discount",975,"250"],["merchant_funded_shipping",1000,"270"]]);
  expect(options[2].requiresShippingVerification).toBe(true);
  expect(promotionReview(offer,300,[])[2].meetsTarget).toBe(false);
  expect(promotionReview(offer,1,[])[1].itemMinor).toBe(700);
 });
 it("does not invent margins for a held pack or missing inputs",()=>{
  expect(promotionReview(offer,250,["unverified_components"])).toEqual([]);
  expect(promotionReview(offer,undefined,[])).toEqual([]);
  expect(promotionReview({...offer,shopperShipping:null},250,[])).toEqual([]);
  expect(promotionReview(offer,400,[])).toEqual([]);
 });
});
