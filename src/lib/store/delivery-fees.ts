import type {MarketCode} from "./markets";
/**
 * Delivery fee the shopper pays per order, in minor units: the same amounts the service pages state
 * (customer-service-copy.ts). Egypt depends on the destination, so the order form asks for it first.
 * Display only: the order itself is priced by the server when order submission is switched on (G3).
 */
export const flatDeliveryFee:Record<Exclude<MarketCode,"eg">,number>={sa:2800,ae:1900,om:3000,iq:7000000};
export const egyptDeliveryBands=[
 {fee_minor:9500,destinations:["القاهرة","الجيزة","الإسكندرية"]},
 {fee_minor:10000,destinations:["بورسعيد","كفر الشيخ","المحلة","العاشر من رمضان","طنطا","بني سويف","دمياط","البحيرة","الدقهلية","الشرقية","الغربية","القليوبية","الإسماعيلية","السويس","المنوفية"]},
 {fee_minor:10500,destinations:["المنيا","وادي النطرون","مطروح","الأقصر","الساحل الشمالي","البحر الأحمر","سوهاج","أسيوط","الفيوم","العين السخنة","أسوان","قنا"]},
] as const;
export const egyptDestinations=egyptDeliveryBands.flatMap(b=>b.destinations);
/** Fee in minor units, or null when it cannot be known yet (Egypt before a destination is chosen). */
export function deliveryFee(market:MarketCode,destination?:string|null):number|null{
 if(market!=="eg")return flatDeliveryFee[market];
 return egyptDeliveryBands.find(b=>(b.destinations as readonly string[]).includes(destination??""))?.fee_minor??null;
}
