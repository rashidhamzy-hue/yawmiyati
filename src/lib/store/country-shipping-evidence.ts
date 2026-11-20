import {markets,type MarketCode} from "./markets";

/**
 * Owner-supplied 2026-11-20 shipping facts — PROVISIONAL SUPPLIER EVIDENCE.
 * Not a current merchant/courier checkout quote. Never use this table alone
 * to charge a customer or publish a delivery guarantee.
 *
 * Money amounts use each existing market's stored minor-unit precision.
 * IQD is recorded with 3 minor digits in the staging database.
 */
export type ProvisionalShippingEvidence={
 market:MarketCode;
 sourceDate:"2026-11-20";
 sourceStatus:"owner_supplied_unverified";
 currency:string;
 flatShippingMinor:string|null;
 estimatedDelivery:string|null;
 returns:string;
 unresolved:readonly string[];
};
export const provisionalShippingEvidence:Record<MarketCode,ProvisionalShippingEvidence>={
 sa:{market:"sa",sourceDate:"2026-11-20",sourceStatus:"owner_supplied_unverified",currency:"SAR",flatShippingMinor:"2800",estimatedDelivery:"Riyadh/Jeddah/Dammam 2–3 days; other regions 4–5 days after confirmation",returns:"Provider references 7-day return period; seller legal terms pending",unresolved:["conflicting confirmation hours and time zones","seller refund rules and consumer rights","live provider identity/courier availability"]},
 ae:{market:"ae",sourceDate:"2026-11-20",sourceStatus:"owner_supplied_unverified",currency:"AED",flatShippingMinor:"1900",estimatedDelivery:"24–48h operational estimate after confirmation",returns:"Provider references 7-day return; bank refund",unresolved:["delivery trigger and excluded service zones","seller return rights and payout verification"]},
 om:{market:"om",sourceDate:"2026-11-20",sourceStatus:"owner_supplied_unverified",currency:"OMR",flatShippingMinor:"3000",estimatedDelivery:null,returns:"Provider references 15-day defect/nonconformity return or exchange; courier cash refund for COD upon inspection",unresolved:["missing delivery ETA","Egypt-specific payout boilerplate in supplier page","legal return eligibility"]},
 eg:{market:"eg",sourceDate:"2026-11-20",sourceStatus:"owner_supplied_unverified",currency:"EGP",flatShippingMinor:null,estimatedDelivery:"Cairo/Giza/Alexandria 2 business days; Lower Egypt/Qalyubia 3; Upper Egypt/Sinai/Matrouh/Red Sea 2–5 after confirmation",returns:"Category restrictions and after-sales procedure require legal review; EGP 5 seller return fees not assumed to be customer charges",unresolved:["broken province shipping price table","conflicting confirmation hours","personal-care returns and customer rights"]},
 iq:{market:"iq",sourceDate:"2026-11-20",sourceStatus:"owner_supplied_unverified",currency:"IQD",flatShippingMinor:"7000000",estimatedDelivery:null,returns:"Source conflicts between a 3-day supplier return and 14-day defect guidance; no final customer return period",unresolved:["conflicting return periods","missing delivery SLA","Egypt-specific cash-out boilerplate"]},
};

/** Display-only evidence; deliberately never marks any shipping charge approved. */
export function readProvisionalShipping(market:MarketCode){
 const source=provisionalShippingEvidence[market];
 if(source.currency!==markets[market].currency)throw Error("Shipping evidence market/currency mismatch");
 const amount=source.flatShippingMinor;
 if(amount!==null&&(!/^\d+$/.test(amount)||!Number.isSafeInteger(Number(amount))))throw Error("Invalid shipping evidence amount");
 return {...source,customerCheckoutApproved:false as const};
}

/** Checkout must use a separate authenticated, market-scoped verified quote. */
export type VerifiedCourierQuote={
 market:MarketCode;
 currency:string;
 shippingMinor:string;
 sourceReference:string;
 verifiedAt:string;
 authenticatedSource:boolean;
 acceptedForCurrentOrder:boolean;
};
export function validateCourierQuote(input:VerifiedCourierQuote,expected:MarketCode,now:string){
 const failures:string[]=[];
 if(input.market!==expected)failures.push("market_mismatch");
 if(input.currency!==markets[expected].currency)failures.push("currency_mismatch");
 if(!/^\d+$/.test(input.shippingMinor)||!Number.isSafeInteger(Number(input.shippingMinor)))failures.push("invalid_fee");
 if(!input.sourceReference.trim()||!input.authenticatedSource)failures.push("unverified_source");
 if(!input.acceptedForCurrentOrder)failures.push("quote_not_accepted_for_order");
 const asOf=Date.parse(input.verifiedAt),current=Date.parse(now);
 if(!Number.isFinite(asOf)||!Number.isFinite(current)||asOf>current||current-asOf>15*60_000)failures.push("stale_quote");
 return {accepted:failures.length===0,failures};
}
