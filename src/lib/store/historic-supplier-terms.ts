/**
 * Owner-supplied supplier terms recorded 20 Nov 2026, retained for source
 * reconciliation only. NOT authenticated/current rate cards, legal seller
 * policy, confirmed supplier availability or permission to sell.
 *
 * Money values are unit strings for quote reconciliation, NOT checkout charges.
 * Do not feed these into pricing, cart, order, finance, schema Offer or shipping.
 */
import type {MarketCode} from "./markets";
export type HistoricPolicyEvidence={
 readonly source:"owner_supplied_2026_11_20";
 readonly status:"historic_unverified";
 readonly shippingQuote:{readonly amount:string;readonly currency:string}|null;
 readonly deliveryEstimate:string|null;
 readonly supplierReturnQuote:string|null;
 readonly customerPriceAuthorized:false;
 readonly supplierConnected:false;
 readonly checkoutEnabled:false;
};
export const historicSupplierTerms:Record<MarketCode,HistoricPolicyEvidence>={
 sa:{source:"owner_supplied_2026_11_20",status:"historic_unverified",
  shippingQuote:{amount:"28",currency:"SAR"},
  deliveryEstimate:"Riyadh/Jeddah/Dammam: 2–3 days; elsewhere 4–5 days after confirmation",
  supplierReturnQuote:"7 days — not a reviewed seller policy",
  customerPriceAuthorized:false,supplierConnected:false,checkoutEnabled:false},
 ae:{source:"owner_supplied_2026_11_20",status:"historic_unverified",
  shippingQuote:{amount:"19",currency:"AED"},
  deliveryEstimate:"24–48 hours, start point and serviceability unconfirmed",
  supplierReturnQuote:"7 days — not a reviewed seller policy",
  customerPriceAuthorized:false,supplierConnected:false,checkoutEnabled:false},
 om:{source:"owner_supplied_2026_11_20",status:"historic_unverified",
  shippingQuote:{amount:"3",currency:"OMR"},
  deliveryEstimate:null,
  supplierReturnQuote:"15 days for defect or not as described only; legal review outstanding",
  customerPriceAuthorized:false,supplierConnected:false,checkoutEnabled:false},
 eg:{source:"owner_supplied_2026_11_20",status:"historic_unverified",
  shippingQuote:null,
  deliveryEstimate:"Cairo/Giza/Alexandria: 2 workdays; Lower Egypt/Qalyubia: 3; other listed regions: 2–5",
  supplierReturnQuote:null,
  customerPriceAuthorized:false,supplierConnected:false,checkoutEnabled:false},
 iq:{source:"owner_supplied_2026_11_20",status:"historic_unverified",
  shippingQuote:{amount:"7000",currency:"IQD"},
  deliveryEstimate:null,
  supplierReturnQuote:"3 days general and separate 14 days for defective goods — conflict unresolved",
  customerPriceAuthorized:false,supplierConnected:false,checkoutEnabled:false},
};
