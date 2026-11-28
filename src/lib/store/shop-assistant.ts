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
    const destination=band.destinations.find(name=>query.trim().replace(/[؟?.!]+$/, "").trim().endsWith(name));
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

// ---- Assistant v2 (29 Nov 2026): structured local answers with product cards, shared rules with the paid path -------
import {detectIntent,parseBudget,searchProducts,formatMoney,MAX_QUESTION,type AssistantProduct,type Intent} from "../../../supabase/functions/_shared/assistant/core";
import {assistantCopy} from "./assistant-copy";
import {markets} from "./markets";
import {chromeCopy} from "./chrome-copy";

export type AssistantLink={href:string;label:string;external?:boolean};
export type AssistantAnswer={text:string;products:PublicListing[];links:AssistantLink[];intent:Intent};
export type AssistantMessage={role:"visitor"|"assistant";text:string;products?:PublicListing[];links?:AssistantLink[];addSlug?:string|null};
/** WhatsApp numbers where a person answers, per market (digits only, with country code). None configured yet: owner decision. */
export const SUPPORT_WHATSAPP:Readonly<Record<MarketCode,string|null>>={sa:null,ae:null,om:null,eg:null,iq:null};
export const humanLink=(market:MarketCode):string|null=>{const n=SUPPORT_WHATSAPP[market];return n&&/^\d{8,15}$/.test(n)?"https://wa.me/"+n:null;};
export function toAssistantProducts(rows:readonly PublicListing[]):AssistantProduct[]{
 return rows.map(r=>({slug:r.slug,title:r.title,price_minor:Number(r.price_minor),category:r.approved_category_slugs?.[0]??null,offer:r.offer===true,is_bundle:r.kind==="bundle",
  is_new:r.is_new===true,free_delivery:r.free_delivery===true,delivery_included:r.delivery_included===true,sale_until:r.sale?.ends_at??null}));
}
/**
 * The free answer, computed in the browser from the released catalogue and the published policies only.
 * Policy questions are answered with the store's own published sentences, word for word. Product questions return
 * real published products (as cards) or an honest "nothing fits". It never states an amount of its own.
 */
export function assistantAnswer(question:string,market:MarketCode,rows:readonly PublicListing[],freeDeliveryMinor:number|null=null):AssistantAnswer{
 const copy=assistantCopy(market),service=customerServiceCopy[market],path="/"+market,q=question.trim();
 const done=(intent:Intent,text:string,products:PublicListing[]=[],links:AssistantLink[]=[]):AssistantAnswer=>({intent,text,products,links});
 const help={href:path+"/info/help",label:copy.helpLink},human=humanLink(market);
 if(q.length>MAX_QUESTION)return done("other",copy.tooLong);
 const intent=detectIntent(q),facts={currency:markets[market].currency,minor_digits:markets[market].minorDigits};
 if(asksAboutPayment(q)||intent==="payment")return done("payment",service.payment,[],[{href:path+"/info/shipping-returns",label:chromeCopy(market).footerShipping}]);
 if(intent==="returns")return done(intent,service.returns,[],[{href:path+"/info/shipping-returns",label:chromeCopy(market).footerShipping}]);
 if(intent==="confirmation_call")return done(intent,copy.callAnswer);
 if(intent==="order_status")return done(intent,service.tracking,[],human?[{href:human,label:copy.humanLink,external:true}]:[help]);
 if(intent==="human")return done(intent,human?copy.humanYes:copy.humanNo,[],human?[{href:human,label:copy.humanLink,external:true}]:[help]);
 if(intent==="free_delivery")return done(intent,freeDeliveryMinor?copy.freeDeliveryYes(formatMoney(freeDeliveryMinor,facts)):copy.freeDeliveryNo+" "+service.shipping);
 if(intent==="delivery")return done(intent,serviceAnswer(q,market)??service.shipping+" "+service.delivery);
 if(intent==="sections")return done(intent,copy.sectionsLead+" "+groups.join("، ")+".",[],[{href:path+"/search",label:chromeCopy(market).navAll}]);
 if(intent==="greeting")return done(intent,marketGreeting(market));
 const bySlug=new Map(rows.map(r=>[r.slug,r]));
 const found=searchProducts(q,toAssistantProducts(rows),facts.minor_digits,4).map(p=>bySlug.get(p.slug)!).filter(Boolean);
 const budget=parseBudget(q,facts.minor_digits).max_minor;
 if(found.length)return done("products",budget?copy.foundInBudget(formatMoney(budget,facts)):copy.found(found.length),found);
 if(/عرض|عروض|خصم|تخفيض|offer|discount|sale/i.test(q)){
  const offers=rows.filter(r=>r.offer||r.sale||r.kind==="bundle").slice(0,4);
  return done("products",copy.offersLead,offers,[{href:path+"/offers",label:copy.offersLink}]);
 }
 if(intent==="products")return done(intent,budget?copy.nothingInBudget(formatMoney(budget,facts)):rows.length?copy.nothingFits+" "+copy.askMore:copy.nothingFits,[],[{href:path+"/search",label:chromeCopy(market).navAll}]);
 return done("other",copy.dontKnow,[],[help]);
}
