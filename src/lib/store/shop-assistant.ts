import {egyptScreenshotShippingEvidence} from "./egypt-shipping-evidence";
import {asksAboutPayment} from "../../../supabase/functions/_shared/payment-policy";
import type {MarketCode} from "./markets";
import type {PublicListing} from "./public-catalog";
import {customerServiceCopy} from "./customer-service-copy";
export const SHOP_ASSISTANT_SUGGESTIONS=["كيف أختار القسم المناسب؟","أريني المنتجات المتاحة","كيف أعرف السعر؟","ماذا عن التوصيل؟"] as const;
export type ShopMessage={role:"visitor"|"assistant";text:string};
export const greeting="أهلاً بك في يومياتي! ✨ أقدر أساعدك في اكتشاف الأقسام، البحث بين المنتجات المعروضة، وفهم المعلومات المتاحة عن التسوّق.";
export function marketGreeting(market:MarketCode){
 return market==="sa"?greeting:({ae:"هلا وغلا! ✨ شو ودّج تكتشفين في يومياتي الإمارات؟ أساعدج بالأقسام والمعلومات المتاحة.",om:"أهلاً بك! ✨ اختاري من أقسام يومياتي عُمان، وأسعد أساعدك بمعلومات المنتجات المتاحة.",eg:"أهلاً بيكي في يومياتي! ✨ قوليلي بتدوّري على إيه، وأساعدك تلاقي الأقسام والمعلومات المتاحة.",iq:"هلا بيچ في يومياتي! ✨ شنو ببالچ؟ أساعدچ تختارين الأقسام وتعرفين المعلومات المتاحة."} as const)[market];
}
const groups=["المنزل والديكور","المطبخ والقهوة","الجمال والعناية","الأزياء والإكسسوارات","الراحة والرفاهية","التنظيم الذكي"];
export function serviceAnswer(query:string,market:MarketCode){
 const service=customerServiceCopy[market];
 if(/(ترجيع|أرجع|ارجع|استرجاع|إرجاع|استبدال|مرتجع|return|refund)/i.test(query))return service.returns;
 if(/(شحن|توصيل|يوصل|بيوصل|shipping|delivery)/i.test(query)){
  if(market==="eg"){
   for(const band of egyptScreenshotShippingEvidence.bands){
    const destination=band.destinations.find(name=>query.includes(name));
    if(destination)return "مصاريف الشحن إلى "+destination+" "+Number(band.amountEgp).toLocaleString("ar-EG")+" جنيه. "+service.delivery;
   }
  }
  return service.shipping+" "+service.delivery;
 }
 return null;
}
export function localShopAnswer(question:string,market:MarketCode,products:readonly PublicListing[]):string{
 const query=question.trim().toLowerCase();
 if(!query)return "اكتبي سؤالك لأساعدك في استكشاف يومياتي.";
 if(query.length>500)return "سؤالك طويل جداً. اختصريه إلى ٥٠٠ حرف أو أقل.";
 if(asksAboutPayment(query))return customerServiceCopy[market].payment;
 const policy=serviceAnswer(query,market);
 if(policy)return policy;
 if(/(قسم|أقسام|تصنيف|فئات|اختار|اختيار|category|categories)/i.test(query))
  return "يمكنك استكشاف: "+groups.join("، ")+". اختاري القسم الذي يناسب اهتماماتك، أو ابحثي باسم منتج في قسم المنتجات.";
 if(/(منتج|منتجات|متاح|موجود|عرض|products|stock|available)/i.test(query)){
  if(!products.length)return "ما لقيت منتجات معروضة في كتالوج "+countryName(market)+" حالياً. يمكنك تصفّح الأقسام وأفكار يومياتي في الصفحة.";
  return "هذه أسماء بعض المنتجات الظاهرة في الكتالوج: "+products.slice(0,4).map(p=>p.title).join("، ")+". يمكنك فتح كل منتج لقراءة تفاصيله.";
 }
 if(/(متابعة|تتبع|track|tracking|طلبي)/i.test(query))return customerServiceCopy[market].tracking;

 if(/(سعر|أسعار|ثمن|كم|خصم|price|discount)/i.test(query))return "تظهر الأسعار بالعملة المحلية فقط على المنتجات التي لديها سعر معتمد. لا يمكنني تأكيد أي خصم أو سعر غير موجود في صفحة المنتج.";
 if(/(مرحبا|مرحب|هلا|أهلا|السلام|hello|hi)/i.test(query))return greeting;
 return "يسعدني مساعدتك في الأقسام والمنتجات والأسعار وسياسات التوصيل. لم أجد معلومات موثوقة للإجابة عن هذا السؤال تحديداً؛ يمكنك تجربة أحد الأسئلة المقترحة.";
}
export function countryName(market:MarketCode){return ({sa:"السعودية",ae:"الإمارات",om:"عُمان",eg:"مصر",iq:"العراق"} as const)[market];}
