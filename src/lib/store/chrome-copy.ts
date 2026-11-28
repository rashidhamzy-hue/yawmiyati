import type {MarketCode} from "./markets";
/**
 * Words of the store frame in each market: navigation, footer, consent prompt, order form, not-found and error pages.
 * Labels that assistive technology and the browser checks rely on stay identical in every market; everything a shopper
 * reads as a sentence is in that market's own dialect. Part of the market dictionary (dictionary.ts).
 */
const base={
 skip:"تخطي إلى المحتوى",mainNav:"التنقل الرئيسي",mobileMenu:"قائمة الجوال",openMenu:"فتح القائمة",closeMenu:"إغلاق القائمة",
 openSearch:"افتح بحث يومياتي",quickNav:"التنقل السريع للجوال",
 navSections:"الأقسام",navAll:"كل المنتجات",navOffers:"العروض",navStory:"قصتنا",navFaq:"الأسئلة الشائعة",
 tabHome:"الرئيسية",tabSections:"الأقسام",tabSearch:"البحث",tabHelp:"المساعدة",
 homeOf:(name:string)=>"يومياتي "+name+"، الصفحة الرئيسية",countryCurrency:(country:string,currency:string)=>"البلد والعملة: "+country+"، "+currency,
 chooseCountry:"اختاري بلد التسوق",countryNote:"كل متجر يعرض الأسعار والمنتجات الخاصة ببلده.",flagOf:(name:string)=>"علم "+name,storeOf:(name:string)=>"متجر "+name,
 footerLinks:"روابط المتجر",footerDiscover:"اكتشفي يومياتي",footerBySection:"تسوقي حسب القسم",footerOffers:"العروض والأطقم",footerHelp:"مركز المساعدة",
 footerPolicies:"السياسات والبلدان",footerInfo:"معلومات تهمك",footerShipping:"الدفع والتوصيل والاسترجاع",footerPrivacy:"سياسة الخصوصية",footerTerms:"شروط الاستخدام",
 rights:"© ٢٠٢٦ يومياتي. جميع الحقوق محفوظة.",
 focusedNote:"الدفع نقداً عند الاستلام · نتصل بك لتأكيد الطلب قبل الشحن",
 consentLabel:"خصوصية التصفح",consentText:"نستخدم أدوات قياس مجهولة الهوية لتحسين تجربة التسوق. هل توافقين على حفظ تفضيلاتك؟",consentAccept:"موافقة",consentDecline:"لا، شكراً",
 notFoundBadge:"٤٠٤ · الصفحة غير موجودة",notFoundTitle:"هذه الصفحة غير موجودة",notFoundBody:"قد يكون الرابط تغيّر أو الصفحة لم تعد متاحة. عودي للرئيسية أو تصفّحي الأقسام.",
 notFoundHome:"العودة للرئيسية",notFoundBrowse:"تصفّحي الأقسام",notFoundAlt:"تفاصيل منزلية دافئة",
 errorTitle:"حدث خطأ غير متوقع",errorBody:"تعذّر عرض الصفحة الآن. حاولي مرة أخرى أو عودي للرئيسية. لا حاجة لإعادة إدخال بياناتك هنا.",errorRetry:"إعادة المحاولة",errorHome:"العودة إلى يومياتي",
 formTitle:"بيانات التوصيل",formCod:"الدفع نقداً عند الاستلام",formCall:"نتصل بك لتأكيد الطلب قبل الشحن",formNoCard:"لا حاجة لبطاقة أو حساب",
 formName:"الاسم الكامل",formPhone:"رقم الجوال",formAddress:"العنوان بالتفصيل",formAddressHint:"الحي، الشارع، رقم المبنى أو أقرب معلم",formNote:"ملاحظة للمندوب (اختياري)",
 errName:"اكتبي الاسم الكامل",errNameDigits:"الاسم لا يحتوي على أرقام",errPhoneRequired:"رقم الجوال مطلوب لتأكيد الطلب",errPhone:(example:string)=>"رقم الجوال غير صحيح، مثال: "+example,
 errCity:(label:string)=>"اختاري أو اكتبي "+label,errAddress:"اكتبي الحي والشارع ورقم المبنى أو أقرب معلم",errNote:"الملاحظة طويلة، 200 حرف كحد أقصى",
};
export type ChromeCopy=typeof base;
const overrides:Record<MarketCode,Partial<ChromeCopy>>={
 sa:{notFoundTitle:"ضيعتي الطريق؟ خلّينا نرجعك للأشياء الحلوة",notFoundBody:"يمكن الرابط تغيّر أو الصفحة ما عادت متاحة. تقدرين ترجعين ليومياتي أو تتصفحين الأقسام.",
  errorTitle:"صار شيء غير متوقع",errorBody:"ما قدرنا نعرض الصفحة الآن. جرّبي مرة ثانية، أو ارجعي للرئيسية. معلوماتك ما تحتاجين تعيدين إدخالها هنا.",formCall:"نتواصل معك لتأكيد الطلب قبل الشحن",focusedNote:"الدفع نقداً عند الاستلام · نتواصل معك لتأكيد الطلب قبل الشحن"},
 ae:{notFoundTitle:"الصفحة مب موجودة",notFoundBody:"يمكن الرابط تغيّر أو الصفحة ما عادت متوفرة. ردّي للرئيسية أو لفّي على الأقسام.",notFoundHome:"ردّي للرئيسية",
  errorTitle:"صار شي مب متوقع",errorBody:"ما قدرنا نعرض الصفحة الحين. جرّبي مرة ثانية أو ردّي للرئيسية. ما تحتاجين تعيدين إدخال بياناتج هني.",errorRetry:"جرّبي مرة ثانية",
  consentText:"نستخدم أدوات قياس مجهولة الهوية عشان نحسّن تجربة التسوق. موافقة نحفظ تفضيلاتج؟",formCall:"بنتواصل وياج لتأكيد الطلب قبل الشحن",focusedNote:"الدفع نقداً عند الاستلام · بنتواصل وياج لتأكيد الطلب قبل الشحن",
  errName:"اكتبي الاسم كامل",errAddress:"اكتبي المنطقة والشارع ورقم المبنى أو أقرب معلم",formAddressHint:"المنطقة، الشارع، رقم المبنى أو أقرب معلم"},
 om:{notFoundTitle:"هذي الصفحة غير موجودة",notFoundBody:"يمكن الرابط تغيّر أو الصفحة ما عادت متوفرة. ارجعي للرئيسية أو تصفّحي الأقسام.",notFoundHome:"ارجعي للرئيسية",
  errorTitle:"صار شيء غير متوقع",errorBody:"ما قدرنا نعرض الصفحة الحين. جرّبي مرة ثانية أو ارجعي للرئيسية. ما تحتاجين تعيدين إدخال بياناتك هنا.",formCall:"نتواصل معك لتأكيد الطلب قبل الشحن",focusedNote:"الدفع نقداً عند الاستلام · نتواصل معك لتأكيد الطلب قبل الشحن",
  formAddressHint:"المنطقة، الشارع، رقم المبنى أو أقرب معلم",errAddress:"اكتبي المنطقة والشارع ورقم المبنى أو أقرب معلم"},
 eg:{notFoundTitle:"الصفحة دي مش موجودة",notFoundBody:"ممكن الرابط اتغيّر أو الصفحة مبقتش متاحة. ارجعي للرئيسية أو اتفرّجي على الأقسام.",notFoundHome:"ارجعي للرئيسية",notFoundBrowse:"اتفرّجي على الأقسام",
  errorTitle:"حصلت مشكلة غير متوقعة",errorBody:"مقدرناش نعرض الصفحة دلوقتي. جرّبي تاني أو ارجعي للرئيسية. مش محتاجة تكتبي بياناتك تاني هنا.",errorRetry:"جرّبي تاني",errorHome:"ارجعي ليومياتي",
  consentText:"بنستخدم أدوات قياس من غير بيانات شخصية عشان نحسّن تجربة التسوق. موافقة نحفظ اختياراتك؟",
  formCod:"الدفع كاش عند الاستلام",formCall:"هنكلمك نأكد الطلب قبل الشحن",formNoCard:"من غير بطاقة ولا حساب",formPhone:"رقم الموبايل",formAddressHint:"المنطقة، الشارع، رقم العمارة أو أقرب علامة مميزة",formNote:"ملاحظة للمندوب (اختياري)",
  focusedNote:"الدفع كاش عند الاستلام · هنكلمك نأكد الطلب قبل الشحن",errName:"اكتبي الاسم بالكامل",errNameDigits:"الاسم من غير أرقام",errPhoneRequired:"رقم الموبايل مطلوب عشان نأكد الطلب",
  errPhone:(example:string)=>"رقم الموبايل مش صحيح، مثال: "+example,errCity:(label:string)=>"اختاري أو اكتبي "+label,errAddress:"اكتبي المنطقة والشارع ورقم العمارة أو أقرب علامة مميزة",errNote:"الملاحظة طويلة، 200 حرف بحد أقصى"},
 iq:{notFoundTitle:"هاي الصفحة مو موجودة",notFoundBody:"يمكن الرابط تغيّر أو الصفحة بعد ما متوفرة. ارجعي للرئيسية أو لفّي على الأقسام.",notFoundHome:"ارجعي للرئيسية",notFoundBrowse:"لفّي على الأقسام",
  errorTitle:"صار شي مو متوقع",errorBody:"ما گدرنا نعرض الصفحة هسه. جرّبي مرة ثانية أو ارجعي للرئيسية. ما تحتاجين ترجعين تكتبين معلوماتچ هنا.",errorRetry:"جرّبي مرة ثانية",
  consentText:"نستخدم أدوات قياس بدون معلومات شخصية حتى نحسّن تجربة التسوق. توافقين نحفظ اختياراتچ؟",
  formCall:"نتصل بيچ نأكد الطلب قبل الشحن",formPhone:"رقم الموبايل",formAddressHint:"المنطقة، الشارع، رقم الدار أو أقرب نقطة دالة",focusedNote:"الدفع نقداً عند الاستلام · نتصل بيچ نأكد الطلب قبل الشحن",
  errName:"اكتبي الاسم الكامل",errPhoneRequired:"رقم الموبايل مطلوب حتى نأكد الطلب",errPhone:(example:string)=>"رقم الموبايل مو صحيح، مثال: "+example,errAddress:"اكتبي المنطقة والشارع ورقم الدار أو أقرب نقطة دالة"},
};
export const chromeCopy=(market:MarketCode):ChromeCopy=>({...base,...overrides[market]});
/** Market from a storefront address ("/iq/p/x" → "iq"); Saudi when the address names no market. */
export function marketFromPath(pathname:string):MarketCode{
 const first=pathname.split("/")[1]??"";
 return first==="ae"||first==="om"||first==="eg"||first==="iq"||first==="sa"?first:"sa";
}
