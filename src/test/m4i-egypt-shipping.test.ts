import {describe,it,expect} from "vitest";
import {egyptScreenshotShippingEvidence,lookupEgyptScreenshotShipping} from "../lib/store/egypt-shipping-evidence";
import {marketPolicyPages} from "../lib/store/market-policy-pages";

const rows=[
 {amountEgp:"95",destinations:["القاهرة","الجيزة","الإسكندرية"]},
 {amountEgp:"100",destinations:["بورسعيد","كفر الشيخ","المحلة","العاشر من رمضان","طنطا","بني سويف","دمياط","البحيرة","الدقهلية","الشرقية","الغربية","القليوبية","الإسماعيلية","السويس","المنوفية"]},
 {amountEgp:"105",destinations:["المنيا","وادي النطرون","مطروح","الأقصر","الساحل الشمالي","البحر الأحمر","سوهاج","أسيوط","الفيوم","العين السخنة","أسوان","قنا"]},
] as const;
describe("M4I Egypt screenshot shipping evidence is advisory only",()=>{
 it("exactly preserves all three bands and 30 screenshot destinations",()=>{
  expect(egyptScreenshotShippingEvidence.bands).toEqual(rows);
  expect(egyptScreenshotShippingEvidence.bands.flatMap(x=>x.destinations)).toHaveLength(30);
  const names=egyptScreenshotShippingEvidence.bands.flatMap(x=>x.destinations);
  expect(new Set(names).size).toBe(30);
 });
 it.each(rows.flatMap(r=>r.destinations.map(destination=>({destination,price:r.amountEgp}))))("$destination -> EGP $price screenshot estimate only",({destination,price})=>{
  expect(lookupEgyptScreenshotShipping(destination)).toEqual({
   kind:"screenshot_estimate",amountEgp:price,currency:"EGP",customerPriceAuthorized:false,
  });
 });
 it.each(["","unknown","الإسكندريه","الاسكندرية","القاهرة الجديدة","الغردقة","دمياط الجديدة","  القاهرة - مصر  "])("never infers a price for unlisted variant %s",destination=>{
  expect(lookupEgyptScreenshotShipping(destination)).toEqual({
   kind:"unknown_destination",amountEgp:null,currency:"EGP",customerPriceAuthorized:false,
  });
 });
 it("does not authorize real checkout or treat EGP 5 refusal deduction as customer fee",()=>{
  const card=egyptScreenshotShippingEvidence;
  expect(card.status).toBe("owner_supplied_unverified_for_checkout");
  expect(card.source).toBe("owner_screenshot_2026_11_21");
  expect(card.refusalDeductionMerchantEgp).toBe("5");
  expect(card.refusalDeductionIsCustomerCharge).toBe(false);
  expect(card.customerPriceAuthorized).toBe(false);
  expect(card.checkoutEnabled).toBe(false);
  expect(card.supplierConnected).toBe(false);
  const customer=JSON.stringify(marketPolicyPages.eg);
  expect(customer).not.toMatch(/خصم.{0,15}٥ جنيه|رفض.{0,15}٥ جنيه/);
  expect(customer).not.toContain("خصم ٥");
  expect(customer).not.toMatch(/المورّد|المورد|Taager|تاجر/);
  expect(customer).toContain("التكلفة");
 });
 it("displays each listed group and clearly leaves unspecified destinations unknown",()=>{
  const shipping=marketPolicyPages.eg.groups[1][1];
  for(const {destinations} of rows){
   for(const city of destinations)expect(shipping).toContain(city);
  }
  for(const value of ["٩٥ جنيه","١٠٠ جنيه","١٠٥ جنيه"])expect(shipping).toContain(value);
  expect(shipping).toContain("لو عنوانك مش مذكور");
  expect(shipping).toMatch(/تأكيد|إرشادية/);
 });
});
