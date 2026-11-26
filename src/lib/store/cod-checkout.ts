/**
 * COD checkout form rules per market: the minimum a courier and Taager's confirmation
 * call need (name, mobile, city, address). Pure and unit-tested; nothing is stored or sent.
 */
import type {MarketCode} from "./markets";

export type CodForm={name:string;phone:string;city:string;address:string;notes:string};
export type CodField=keyof CodForm;
export type CodErrors=Partial<Record<CodField,string>>;

export const dialCode:Record<MarketCode,string>={sa:"+966",ae:"+971",om:"+968",eg:"+20",iq:"+964"};
/** National mobile number after removing a leading 0: pattern + example shown to shoppers. */
const mobile:Record<MarketCode,{re:RegExp;example:string}>={
 sa:{re:/^5\d{8}$/,example:"05xxxxxxxx"},
 ae:{re:/^5\d{8}$/,example:"05xxxxxxxx"},
 om:{re:/^[79]\d{7}$/,example:"9xxxxxxx"},
 eg:{re:/^1[0125]\d{8}$/,example:"01xxxxxxxxx"},
 iq:{re:/^7[3-9]\d{8}$/,example:"07xxxxxxxxx"},
};
export const phoneExample=(m:MarketCode)=>mobile[m].example;
export const cityLabel:Record<MarketCode,string>={sa:"المدينة",ae:"الإمارة / المدينة",om:"الولاية / المدينة",eg:"المحافظة / المدينة",iq:"المحافظة / المدينة"};

const arabicDigits="٠١٢٣٤٥٦٧٨٩",persianDigits="۰۱۲۳۴۵۶۷۸۹";
export function toLatinDigits(s:string){return s.replace(/[٠-٩۰-۹]/g,d=>String(Math.max(arabicDigits.indexOf(d),persianDigits.indexOf(d))));}

/** Normalises what shoppers type (spaces, Arabic digits, +code, 00code, leading 0) to E.164, or null. */
export function normalizePhone(market:MarketCode,raw:string):string|null{
 let d=toLatinDigits(raw).replace(/[\s\-()]/g,"");
 const code=dialCode[market].slice(1);
 if(d.startsWith("+"))d=d.slice(1);else if(d.startsWith("00"))d=d.slice(2);
 if(d.startsWith(code)&&d.length>code.length+7)d=d.slice(code.length);
 if(d.startsWith("0"))d=d.slice(1);
 if(!/^\d+$/.test(d)||!mobile[market].re.test(d))return null;
 return "+"+code+d;
}

export function validateCod(market:MarketCode,f:CodForm):CodErrors{
 const e:CodErrors={};
 const name=f.name.trim();
 if(name.length<3)e.name="اكتبي الاسم الكامل";
 else if(/\d/.test(toLatinDigits(name)))e.name="الاسم لا يحتوي على أرقام";
 if(!f.phone.trim())e.phone="رقم الجوال مطلوب لتأكيد الطلب";
 else if(!normalizePhone(market,f.phone))e.phone="رقم الجوال غير صحيح، مثال: "+phoneExample(market);
 if(f.city.trim().length<2)e.city="اختاري أو اكتبي "+cityLabel[market];
 if(f.address.trim().length<8)e.address="اكتبي الحي والشارع ورقم المبنى أو أقرب معلم";
 if(f.notes.length>200)e.notes="الملاحظة طويلة، 200 حرف كحد أقصى";
 return e;
}
