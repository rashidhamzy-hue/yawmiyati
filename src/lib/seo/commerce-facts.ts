/**
 * Machine-readable store facts for structured data, the Google product feed
 * and llms.txt. Every value mirrors customer copy in
 * src/lib/store/customer-service-copy.ts (test: commerce-facts.test.ts).
 * Unknown facts stay null — never invent a delivery time or return window.
 */
import type {MarketCode} from "@/lib/store/markets";

export type MarketCommerceFacts={
 readonly countryCode:string;
 /** Flat delivery fee per order, as a decimal string, or null when it varies by area. */
 readonly flatShipping:string|null;
 /** Range when the fee varies by area (Egypt). */
 readonly shippingRange:{readonly min:string;readonly max:string}|null;
 /** Business days from confirmation to delivery, or null when not published. */
 readonly deliveryDays:{readonly min:number;readonly max:number}|null;
 /** Return window in days for any reason, or null when not offered/published. */
 readonly returnDays:number|null;
 /** Return limited to defective or not-as-described items. */
 readonly defectiveOnlyReturnDays:number|null;
};

export const commerceFacts:Readonly<Record<MarketCode,MarketCommerceFacts>>={
 sa:{countryCode:"SA",flatShipping:"28",shippingRange:null,deliveryDays:{min:2,max:5},returnDays:7,defectiveOnlyReturnDays:null},
 ae:{countryCode:"AE",flatShipping:"19",shippingRange:null,deliveryDays:{min:1,max:2},returnDays:7,defectiveOnlyReturnDays:null},
 om:{countryCode:"OM",flatShipping:"3",shippingRange:null,deliveryDays:null,returnDays:null,defectiveOnlyReturnDays:15},
 eg:{countryCode:"EG",flatShipping:null,shippingRange:{min:"95",max:"105"},deliveryDays:{min:2,max:5},returnDays:14,defectiveOnlyReturnDays:null},
 iq:{countryCode:"IQ",flatShipping:"7000",shippingRange:null,deliveryDays:null,returnDays:null,defectiveOnlyReturnDays:null},
};

/** Payment is cash on delivery only, in every market. */
export const PAYMENT_METHOD="cash_on_delivery" as const;
