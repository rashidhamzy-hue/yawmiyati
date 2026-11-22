import {paymentAnswer, paymentLabel} from "../../../supabase/functions/_shared/payment-policy";
import type {MarketCode} from "./markets";

/** Customer-facing policy for the five storefronts. Checkout is configured separately. */
export type CustomerServiceCopy={
 readonly payment:string;
 readonly shipping:string;
 readonly delivery:string;
 readonly returns:string;
 readonly tracking:string;
 readonly confirmation:string;
 readonly paymentHeading:string;
 readonly shippingHeading:string;
 readonly deliveryHeading:string;
 readonly returnsHeading:string;
 readonly shippingIntro:string;
 readonly preCheckoutNotice:string;
};
export const customerServiceCopy:Readonly<Record<MarketCode,CustomerServiceCopy>>={
 sa:{
  payment:paymentAnswer,
  shipping:"رسوم التوصيل داخل المملكة ٢٨ ريالًا للطلب كاملًا.",
  delivery:"عادةً يصل الطلب بعد التأكيد خلال يومين إلى ثلاثة أيام في الرياض وجدة والدمام، وخلال أربعة إلى خمسة أيام في بقية المناطق.",
  returns:"يمكنك طلب الاسترجاع خلال ٧ أيام. احتفظي برقم الطلب، مع حفظ حقوقك النظامية.",
  tracking:"تُعرض حالة الطلب بالاعتماد على رقم طلب مسجّل وصحيح. لا توجد حالة متابعة لطلب لم يُسجّل.",
  confirmation:"راجعي المنتج والكمية والعنوان ورقم التواصل قبل تأكيد الطلب.",
  paymentHeading:paymentLabel,shippingHeading:"رسوم التوصيل",deliveryHeading:"مواعيد التوصيل",returnsHeading:"الاسترجاع والاستبدال",
  shippingIntro:"تفاصيل واضحة عن الدفع والتوصيل والاسترجاع داخل السعودية.",
  preCheckoutNotice:"إتمام الطلب غير مفعّل في هذه النسخة من المتجر. تصفّحي المنتجات والأقسام بكل سهولة."
 },
 ae:{
  payment:paymentAnswer,
  shipping:"التوصيل لجميع الإمارات بـ١٩ درهمًا للطلب كاملًا.",
  delivery:"يستغرق التوصيل عادةً من ٢٤ إلى ٤٨ ساعة.",
  returns:"تقدرين تطلبين الاسترجاع خلال ٧ أيام. احتفظي برقم الطلب.",
  tracking:"متابعة الطلب تعتمد على رقمه المسجّل وبياناته الصحيحة. ما نعرض حالة لطلب غير مسجّل.",
  confirmation:"راجعي المنتج والكمية ورقمج وعنوانج قبل تأكيد الطلب.",
  paymentHeading:paymentLabel,shippingHeading:"رسوم التوصيل",deliveryHeading:"موعد التوصيل",returnsHeading:"الاسترجاع والاستبدال",
  shippingIntro:"كل ما يخص الدفع والتوصيل والاسترجاع في يومياتي الإمارات.",
  preCheckoutNotice:"إتمام الطلب غير مفعّل في هذه النسخة. تصفّحي الأقسام والمنتجات بكل راحة."
 },
 om:{
  payment:paymentAnswer,
  shipping:"رسوم التوصيل داخل عُمان ٣ ريالات عُمانية للطلب كاملًا.",
  delivery:"ما عندنا مدة توصيل محددة لكل الولايات.",
  returns:"إذا وصلك منتج معيب أو مختلف عن الوصف، يمكنك طلب إرجاعه خلال ١٥ يومًا.",
  tracking:"تظهر بيانات المتابعة للطلبات المسجّلة والمتحقّق من أرقامها فقط.",
  confirmation:"راجعي اسم المستلم ورقم التواصل والعنوان والمنتج قبل تأكيد الطلب.",
  paymentHeading:paymentLabel,shippingHeading:"رسوم التوصيل",deliveryHeading:"مدة التوصيل",returnsHeading:"الإرجاع والاستبدال",
  shippingIntro:"معلومات الدفع والتوصيل والإرجاع في متجر يومياتي عُمان.",
  preCheckoutNotice:"إتمام الطلب غير مفعّل في هذه النسخة. استكشفي المنتجات والأقسام المتاحة للتصفّح."
 },
 eg:{
  payment:paymentAnswer,
  shipping:"الشحن بـ٩٥ جنيه للقاهرة والجيزة والإسكندرية، وبـ١٠٠ أو ١٠٥ جنيه لباقي الوجهات المدرجة في صفحة الشحن. المصاريف بتتحسب مرة واحدة للطلب كله.",
  delivery:"التوصيل عادةً خلال يومي عمل في القاهرة والجيزة والإسكندرية، وثلاثة أيام عمل في الوجه البحري والقليوبية. المدة المسجلة للوجهات الأخرى المدرجة من يومين إلى خمسة أيام.",
  returns:"تقدري ترجّعي المنتج أو تستبدليه خلال ١٤ يوم. احتفظي بالفاتورة. فتح الشحنة بيكون بعد الدفع.",
  tracking:"متابعة الطلب مرتبطة برقم طلب متسجّل وصحيح؛ مش بنعرض حالة لطلب مش موجود.",
  confirmation:"راجعي المنتج والعدد والعنوان ورقم الموبايل قبل تأكيد الطلب.",
  paymentHeading:paymentLabel,shippingHeading:"مصاريف الشحن حسب المنطقة",deliveryHeading:"مواعيد التوصيل",returnsHeading:"الاسترجاع والاستبدال",
  shippingIntro:"تفاصيل الدفع والشحن والاسترجاع في يومياتي مصر.",
  preCheckoutNotice:"إتمام الطلب مش مفعّل في النسخة دي. تقدري تتصفحي الأقسام والمنتجات."
 },
 iq:{
  payment:paymentAnswer,
  shipping:"أجرة التوصيل ٧٬٠٠٠ دينار عراقي للطلب كله، بكل المحافظات.",
  delivery:"ما عدنا مدة توصيل محددة لكل المحافظات.",
  returns:"حتى تطلبين إرجاع أو استبدال، احتفظي برقم الطلب وتفاصيل المنتج. إذا بيه عيب، اذكري المشكلة عند تقديم الطلب.",
  tracking:"متابعة الطلب تكون برقمه المسجّل والصحيح. ما نعرض حالة لطلب مو مسجّل.",
  confirmation:"راجعي المنتج والعدد ورقم الموبايل والعنوان قبل تأكيد الطلب.",
  paymentHeading:paymentLabel,shippingHeading:"أجرة التوصيل",deliveryHeading:"وقت التوصيل",returnsHeading:"الاسترجاع والاستبدال",
  shippingIntro:"تفاصيل الدفع والتوصيل والإرجاع في يومياتي العراق.",
  preCheckoutNotice:"إتمام الطلب مو مفعّل بهالنسخة. تصفّحي الأقسام والمنتجات على راحتچ."
 }
} as const;
