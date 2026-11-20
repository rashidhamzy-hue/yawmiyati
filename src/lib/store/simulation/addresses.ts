/**
 * Non-personal five-country address *shapes* for deterministic UI tests.
 * These are synthetic locality examples, never real recipients or orders.
 */
import {markets,type MarketCode} from "../markets";
export type SimAddress={
 readonly synthetic:true;readonly market:MarketCode;readonly label:string;
 readonly city:string;readonly district:string;readonly street:"شارع تجريبي";
 readonly building:"مبنى تجريبي";readonly landmark:"علامة تجريبية";
 readonly postalCode?:string;readonly nationalShortAddress?:string;
 readonly governorate?:string;readonly wilayat?:string;readonly emirate?:string;
 readonly phonePlaceholder:string;
};
export const addressSamples:Record<MarketCode,SimAddress>={
 sa:{synthetic:true,market:"sa",label:"عنوان تجريبي — الرياض",city:"الرياض",district:"حي تجريبي",street:"شارع تجريبي",building:"مبنى تجريبي",landmark:"علامة تجريبية",postalCode:"00000",nationalShortAddress:"TEST0000",phonePlaceholder:"+9665XXXXXXXX"},
 ae:{synthetic:true,market:"ae",label:"عنوان تجريبي — دبي",city:"دبي",district:"منطقة تجريبية",street:"شارع تجريبي",building:"مبنى تجريبي",landmark:"علامة تجريبية",emirate:"دبي",phonePlaceholder:"+9715XXXXXXXX"},
 om:{synthetic:true,market:"om",label:"عنوان تجريبي — مسقط",city:"مسقط",district:"منطقة تجريبية",street:"شارع تجريبي",building:"مبنى تجريبي",landmark:"علامة تجريبية",wilayat:"السيب",phonePlaceholder:"+968XXXXXXXX"},
 eg:{synthetic:true,market:"eg",label:"عنوان تجريبي — القاهرة",city:"القاهرة",district:"منطقة تجريبية",street:"شارع تجريبي",building:"مبنى تجريبي",landmark:"علامة تجريبية",governorate:"القاهرة",phonePlaceholder:"+20XXXXXXXXXX"},
 iq:{synthetic:true,market:"iq",label:"عنوان تجريبي — بغداد",city:"بغداد",district:"منطقة تجريبية",street:"شارع تجريبي",building:"مبنى تجريبي",landmark:"علامة تجريبية",governorate:"بغداد",phonePlaceholder:"+9647XXXXXXXXX"},
};
export function validateSyntheticAddress(market:MarketCode,raw:unknown):SimAddress{
 if(!Object.hasOwn(markets,market)||!raw||typeof raw!=="object")throw Error("invalid_synthetic_address");
 const v=raw as Partial<SimAddress>;
 if(v.synthetic!==true||v.market!==market||v.street!=="شارع تجريبي"||v.building!=="مبنى تجريبي"||v.landmark!=="علامة تجريبية"||v.phonePlaceholder!==addressSamples[market].phonePlaceholder)throw Error("unsafe_or_cross_market_address");
 if(market==="sa"&&(!v.nationalShortAddress||!v.postalCode)||market==="ae"&&!v.emirate||market==="om"&&!v.wilayat||["eg","iq"].includes(market)&&!v.governorate)throw Error("missing_country_address_fields");
 return {...addressSamples[market]};
}
