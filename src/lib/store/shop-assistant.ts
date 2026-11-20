import type {MarketCode} from "./markets";
import type {PublicListing} from "./public-catalog";
import {marketPolicyPages} from "./market-policy-pages";
export const SHOP_ASSISTANT_SUGGESTIONS=["كيف أختار القسم المناسب؟","أريني المنتجات المتاحة","كيف أعرف السعر؟","ماذا عن التوصيل؟"] as const;
export type ShopMessage={role:"visitor"|"assistant";text:string};
export const greeting="أهلاً بك في يومياتي! ✨ أقدر أساعدك في اكتشاف الأقسام، البحث بين المنتجات المعروضة، وفهم المعلومات المتاحة عن التسوّق.";
export function marketGreeting(market:MarketCode){
 return market==="sa"?greeting:({ae:"هلا وغلا! ✨ شو ودّج تكتشفين في يومياتي الإمارات؟ أساعدج بالأقسام والمعلومات المتاحة.",om:"أهلاً بك! ✨ اختاري من أقسام يومياتي عُمان، وأسعد أساعدك بمعلومات المنتجات المتاحة.",eg:"أهلاً بيكي في يومياتي! ✨ قوليلي بتدوّري على إيه، وأساعدك تلاقي الأقسام والمعلومات المتاحة.",iq:"هلا بيچ في يومياتي! ✨ شنو ببالچ؟ أساعدچ تختارين الأقسام وتعرفين المعلومات المتاحة."} as const)[market];
}
const groups=["المنزل والديكور","المطبخ والقهوة","الجمال والعناية","الأزياء والإكسسوارات","الراحة والرفاهية","التنظيم الذكي"];
export function localShopAnswer(question:string,market:MarketCode,products:readonly PublicListing[]):string{
 const query=question.trim().toLowerCase();
 if(!query)return "اكتبي سؤالك لأساعدك في استكشاف يومياتي.";
 if(query.length>500)return "سؤالك طويل جداً. اختصريه إلى ٥٠٠ حرف أو أقل.";
 if(/(قسم|أقسام|تصنيف|فئات|اختار|اختيار|category|categories)/i.test(query))
  return "يمكنك استكشاف: "+groups.join("، ")+". اختاري القسم الذي يناسب اهتماماتك، أو ابحثي باسم منتج في قسم المنتجات.";
 if(/(منتج|منتجات|متاح|موجود|عرض|products|stock|available)/i.test(query)){
  if(!products.length)return "لا توجد منتجات معتمدة ظاهرة في كتالوج "+countryName(market)+" حالياً. يمكنك تصفّح الأقسام وأفكار يومياتي في الصفحة.";
  return "هذه أسماء بعض المنتجات الظاهرة في الكتالوج: "+products.slice(0,4).map(p=>p.title).join("، ")+". يمكنك فتح كل منتج لقراءة تفاصيله.";
 }
 if(market==="sa"&&/(دفع|استلام|كاش|cod|payment)/i.test(query))return "خيار الدفع المخطّط ليومياتي السعودية هو الدفع عند الاستلام فقط، بدون دفع إلكتروني. الطلبات غير مفعّلة حالياً؛ التفاصيل النهائية ستُعرض قبل قبول أي طلب.";
 if(market==="sa"&&/(استرجاع|إرجاع|استبدال|مرتجع|return|refund)/i.test(query))return "معلومات التشغيل الأولية تشير إلى نافذة استرجاع ٧ أيام. هذه ليست سياسة البائع النهائية ولا تلغي الحقوق النظامية. راجعي صفحة الدفع والتوصيل والاسترجاع؛ لن نستقبل طلبات قبل اعتماد الشروط.";
 if(market==="sa"&&/(شحن|توصيل|shipping|delivery)/i.test(query))return "بحسب المعلومات التشغيلية المقدّمة، الشحن المرجعي ٢٨ ر.س بالمملكة، والتقدير بعد التأكيد ٢–٣ أيام في الرياض وجدة والدمام و٤–٥ أيام لبقية المناطق. هذه تقديرات غير مضمونة، ولا يمكن طلب منتج حالياً.";
 if(market!=="sa"){
  const details=marketPolicyPages[market].groups;
  if(/(دفع|استلام|كاش|cod|payment)/i.test(query))return details[0][1];
  if(/(استرجاع|إرجاع|استبدال|مرتجع|return|refund)/i.test(query))return details[4][1];
  if(/(شحن|توصيل|shipping|delivery)/i.test(query))return details[1][1]+" "+details[2][1];
 }
 if(/(شحن|توصيل|استرجاع|إرجاع|استبدال|دفع|cod|shipping|delivery|return|payment)/i.test(query))return "تختلف تفاصيل الشحن والدفع والاسترجاع حسب البلد والمنتج. لا أملك حالياً شروطاً مؤكدة أستطيع نسبتها إلى طلبك، لذلك لا أعدك برسوم أو مواعيد محددة.";
 if(/(سعر|أسعار|ثمن|كم|خصم|price|discount)/i.test(query))return "تظهر الأسعار بالعملة المحلية فقط على المنتجات التي لديها سعر معتمد. لا يمكنني تأكيد أي خصم أو سعر غير موجود في صفحة المنتج.";
 if(/(مرحبا|مرحب|هلا|أهلا|السلام|hello|hi)/i.test(query))return greeting;
 return "يسعدني مساعدتك في الأقسام والمنتجات والأسعار وسياسات التوصيل. لم أجد معلومات موثوقة للإجابة عن هذا السؤال تحديداً؛ يمكنك تجربة أحد الأسئلة المقترحة.";
}
export function countryName(market:MarketCode){return ({sa:"السعودية",ae:"الإمارات",om:"عُمان",eg:"مصر",iq:"العراق"} as const)[market];}
