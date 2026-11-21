/**
 * M4I — OWNER-SUPPLIED SCREENSHOT TRANSCRIPTION (21 Nov 2026).
 * This is an internal, offline shipping reference. Not a live provider quote,
 * customer checkout rate, complete governorate coverage, or seller price policy.
 * Never dispatch an order, calculate a customer total, or silently match an
 * unlisted destination based on another city/governorate.
 *
 * Screenshot also states EGP 5 deduction when a customer refuses at delivery.
 * This is internal merchant economics, NOT a customer shipping surcharge.
 */
export const egyptScreenshotShippingEvidence={
 source:"owner_screenshot_2026_11_21" as const,
 status:"owner_supplied_unverified_for_checkout" as const,
 currency:"EGP" as const,
 rateBasis:"destination_as_written" as const,
 customerPriceAuthorized:false as const,
 checkoutEnabled:false as const,
 supplierConnected:false as const,
 refusalDeductionMerchantEgp:"5" as const,
 refusalDeductionIsCustomerCharge:false as const,
 bands:[
  {amountEgp:"95",destinations:["القاهرة","الجيزة","الإسكندرية"]},
  {amountEgp:"100",destinations:[
   "بورسعيد","كفر الشيخ","المحلة","العاشر من رمضان","طنطا","بني سويف","دمياط",
   "البحيرة","الدقهلية","الشرقية","الغربية","القليوبية","الإسماعيلية","السويس","المنوفية"
  ]},
  {amountEgp:"105",destinations:[
   "المنيا","وادي النطرون","مطروح","الأقصر","الساحل الشمالي","البحر الأحمر",
   "سوهاج","أسيوط","الفيوم","العين السخنة","أسوان","قنا"
  ]},
 ] as const
} as const;

export type EgyptRateLookup=
 |{readonly kind:"screenshot_estimate";readonly amountEgp:"95"|"100"|"105";readonly currency:"EGP";readonly customerPriceAuthorized:false}
 |{readonly kind:"unknown_destination";readonly amountEgp:null;readonly currency:"EGP";readonly customerPriceAuthorized:false};

/** Strict literal lookup: intentionally does not infer a new location's region. */
export function lookupEgyptScreenshotShipping(destination:string):EgyptRateLookup{
 if(typeof destination!=="string"||destination.length>120)return {kind:"unknown_destination",amountEgp:null,currency:"EGP",customerPriceAuthorized:false};
 const label=destination.trim().replace(/\s+/g," ");
 for(const band of egyptScreenshotShippingEvidence.bands){
  if((band.destinations as readonly string[]).includes(label)){
   return {kind:"screenshot_estimate",amountEgp:band.amountEgp,currency:"EGP",customerPriceAuthorized:false};
  }
 }
 return {kind:"unknown_destination",amountEgp:null,currency:"EGP",customerPriceAuthorized:false};
}
