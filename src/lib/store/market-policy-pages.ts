import type {MarketCode} from "./markets";
import {customerServiceCopy} from "./customer-service-copy";

/**
 * Public country service pages share approved wording, not unverified supplier
 * quotations, return windows, fixed shipping fees or guessed delivery SLAs.
 * Quotes remain in the internal evidence ledger pending signed commercial terms.
 */
export type MarketPolicyPage={title:string;intro:string;groups:readonly (readonly [string,string])[]};
type Country=Exclude<MarketCode,"sa">;
const heading:Record<Country,string>={
 ae:"الدفع والتوصيل والاسترجاع",om:"الدفع والتوصيل والاسترجاع",
 eg:"الدفع والشحن والاسترجاع",iq:"الدفع والتوصيل والاسترجاع"
};
const questions:Record<Country,readonly [string,string,string,string,string]>={
 ae:["شو طريقة الدفع؟","كم تكلفة الشحن؟","متى يوصل الطلب؟","كيف أراجع بيانات الطلب؟","كيف أرجّع المنتج؟"],
 om:["كيف أدفع؟","كم تكلفة الشحن؟","متى يوصل الطلب؟","كيف أتأكد من بيانات الطلب؟","كيف يعمل الاسترجاع والاستبدال؟"],
 eg:["الدفع بيكون إزاي؟","مصاريف الشحن كام؟","الطلب بيوصل إمتى؟","أراجع تفاصيل الطلب إزاي؟","إزاي أرجّع أو أستبدل المنتج؟"],
 iq:["شلون أدفع؟","شكد أجرة التوصيل؟","متى يوصل طلبي؟","شلون أتأكد من بيانات الطلب؟","شلون أقدّم طلب استرجاع؟"]
};
const page=(market:Country):MarketPolicyPage=>{
 const c=customerServiceCopy[market];
 const [pay,ship,delivery,confirm,returns]=questions[market];
 return {
  title:heading[market],intro:c.shippingIntro,
  groups:[[pay,c.payment],[ship,c.shipping],[delivery,c.delivery],
   [confirm,c.confirmation],[returns,c.returns],[
     market==="eg"?"أتابع طلبي إزاي؟":market==="iq"?"شلون أتابع الطلب؟":"كيف أتابع الطلب؟",
     c.tracking
   ]]
 };
};
export const marketPolicyPages:Record<Country,MarketPolicyPage>={
 ae:page("ae"),om:page("om"),eg:page("eg"),iq:page("iq")
};
