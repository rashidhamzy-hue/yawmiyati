import type {MarketCode} from "./markets";
import type {PublicListing} from "./public-catalog";
export const SHOP_ASSISTANT_SUGGESTIONS=["كيف أختار القسم المناسب؟","أريني المنتجات المتاحة","كيف أعرف السعر؟","ماذا عن التوصيل؟"] as const;
export type ShopMessage={role:"visitor"|"assistant";text:string};
export const greeting="أهلاً بك في يومياتي! ✨ أقدر أساعدك في اكتشاف الأقسام، البحث بين المنتجات المعروضة، وفهم المعلومات المتاحة عن التسوّق.";
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
 if(market==="sa"&&/(دفع|استلام|كاش|cod|payment)/i.test(query))return "الدفع كاش عند الاستلام فقط، بدون بطاقات أو تحويلات. تأكدي من اسمك وعنوانك ورقم التواصل عند إتمام الطلب.";
 if(market==="sa"&&/(استرجاع|إرجاع|استبدال|مرتجع|return|refund)/i.test(query))return "يمكن طلب الاسترجاع خلال ٧ أيام من الاستلام وفق شروط المنتج وحالته، مع حفظ حقوقك النظامية. تفاصيل الإجراءات في صفحة الشحن والاسترجاع.";
 if(market==="sa"&&/(شحن|توصيل|shipping|delivery)/i.test(query))return "رسوم الشحن ٢٨ ر.س لجميع مناطق المملكة. المدة التقديرية بعد تأكيد الطلب ٢–٣ أيام للرياض وجدة والدمام و٤–٥ أيام لبقية المناطق، وقد تختلف حسب ظروف الشحن.";
 if(/(شحن|توصيل|استرجاع|إرجاع|استبدال|دفع|cod|shipping|delivery|return|payment)/i.test(query))return "تختلف تفاصيل الشحن والدفع والاسترجاع حسب البلد والمنتج. لا أملك حالياً شروطاً مؤكدة أستطيع نسبتها إلى طلبك، لذلك لا أعدك برسوم أو مواعيد محددة.";
 if(/(سعر|أسعار|ثمن|كم|خصم|price|discount)/i.test(query))return "تظهر الأسعار بالعملة المحلية فقط على المنتجات التي لديها سعر معتمد. لا يمكنني تأكيد أي خصم أو سعر غير موجود في صفحة المنتج.";
 if(/(مرحبا|مرحب|هلا|أهلا|السلام|hello|hi)/i.test(query))return greeting;
 return "يسعدني مساعدتك في الأقسام والمنتجات والأسعار وسياسات التوصيل. لم أجد معلومات موثوقة للإجابة عن هذا السؤال تحديداً؛ يمكنك تجربة أحد الأسئلة المقترحة.";
}
export function countryName(market:MarketCode){return ({sa:"السعودية",ae:"الإمارات",om:"عُمان",eg:"مصر",iq:"العراق"} as const)[market];}
