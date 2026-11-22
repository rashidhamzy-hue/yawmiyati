import {paymentAnswer, paymentLabel} from "../../../supabase/functions/_shared/payment-policy";
import type {MarketCode} from "./markets";

/**
 * M9: a single, evergreen customer-facing voice for COD, shipping and returns.
 *
 * IMPORTANT:
 * - These are explanations of how approved orders are handled, not evidence that
 *   checkout is running. The checkout route remains disabled by independent gates.
 * - Quoted supplier fees/ETAs/return windows are NOT customer-approved prices/SLAs.
 *   Keep them in historicSupplierTerms/egypt-shipping-evidence until a verified
 *   commercial policy is approved and served by an authenticated backend.
 * - Do not add "coming soon", "will publish", "estimated delivery", or
 *   previous-supplier phrases to this customer copy.
 */
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
  shipping:"تُحدد رسوم التوصيل بحسب عنوان التسليم، وتُراجع مع إجمالي الطلب قبل تأكيده.",
  delivery:"تختلف مدة التوصيل بحسب المدينة وتجهيز المنتج. راجعي تفاصيل التوصيل المرتبطة بعنوانك.",
  returns:"يمكنك طلب الإرجاع أو الاستبدال بحسب حالة المنتج وحقوقك النظامية. احتفظي برقم الطلب وتفاصيل المنتج عند التواصل بشأن الاسترجاع.",
  tracking:"تُعرض حالة الطلب بالاعتماد على رقم طلب مسجّل وصحيح. لا توجد حالة متابعة لطلب لم يُسجّل.",
  confirmation:"راجعي المنتج والكمية والعنوان ورقم التواصل قبل تأكيد الطلب.",
  paymentHeading:paymentLabel,shippingHeading:"رسوم التوصيل حسب العنوان",deliveryHeading:"مواعيد التوصيل",returnsHeading:"الاسترجاع والاستبدال",
  shippingIntro:"تفاصيل واضحة عن الدفع والتوصيل والاسترجاع داخل السعودية.",
  preCheckoutNotice:"إتمام الطلب غير مفعّل في هذه النسخة من المتجر. تصفّحي المنتجات والأقسام بكل سهولة."
 },
 ae:{
  payment:paymentAnswer,
  shipping:"رسوم التوصيل مرتبطة بعنوانج داخل الإمارات. راجعي الرسوم مع إجمالي الطلب قبل التأكيد.",
  delivery:"موعد التوصيل يعتمد على الإمارة والعنوان وتجهيز المنتج. التفاصيل تُراجع حسب وجهة الطلب.",
  returns:"طلب الإرجاع أو الاستبدال يعتمد على حالة المنتج وحقوقج كمستهلكة. احتفظي برقم الطلب للمراجعة.",
  tracking:"متابعة الطلب تعتمد على رقمه المسجّل وبياناته الصحيحة. ما نعرض حالة لطلب غير مسجّل.",
  confirmation:"راجعي المنتج والكمية ورقمج وعنوانج قبل تأكيد الطلب.",
  paymentHeading:paymentLabel,shippingHeading:"رسوم التوصيل",deliveryHeading:"موعد التوصيل",returnsHeading:"الاسترجاع والاستبدال",
  shippingIntro:"كل ما يخص الدفع والتوصيل والاسترجاع في يومياتي الإمارات.",
  preCheckoutNotice:"إتمام الطلب غير مفعّل في هذه النسخة. تصفّحي الأقسام والمنتجات بكل راحة."
 },
 om:{
  payment:paymentAnswer,
  shipping:"تُراجع رسوم التوصيل بحسب موقع التسليم في عُمان، مع إجمالي الطلب قبل تأكيده.",
  delivery:"مدة التوصيل تختلف حسب الولاية والعنوان وتجهيز المنتج. راجعي التفاصيل المرتبطة بطلبك.",
  returns:"الإرجاع والاستبدال يعتمدان على حالة المنتج وحقوق المستهلك. احتفظي برقم الطلب وتفاصيل المنتج للمراجعة.",
  tracking:"تظهر بيانات المتابعة للطلبات المسجّلة والمتحقّق من أرقامها فقط.",
  confirmation:"راجعي اسم المستلم ورقم التواصل والعنوان والمنتج قبل تأكيد الطلب.",
  paymentHeading:paymentLabel,shippingHeading:"رسوم التوصيل",deliveryHeading:"مدة التوصيل",returnsHeading:"الإرجاع والاستبدال",
  shippingIntro:"معلومات الدفع والتوصيل والإرجاع في متجر يومياتي عُمان.",
  preCheckoutNotice:"إتمام الطلب غير مفعّل في هذه النسخة. استكشفي المنتجات والأقسام المتاحة للتصفّح."
 },
 eg:{
  payment:paymentAnswer,
  shipping:"مصاريف الشحن بتختلف حسب منطقة التوصيل. راجعي المصاريف مع إجمالي الطلب قبل التأكيد.",
  delivery:"ميعاد التوصيل حسب المحافظة والعنوان وتجهيز المنتج. تفاصيل التوصيل بتكون مرتبطة بوجهة الطلب.",
  returns:"تقدري تطلبي استرجاع أو استبدال حسب حالة المنتج وحقوقك القانونية. احتفظي برقم الطلب وتفاصيل المنتج.",
  tracking:"متابعة الطلب مرتبطة برقم طلب متسجّل وصحيح؛ مش بنعرض حالة لطلب مش موجود.",
  confirmation:"راجعي المنتج والعدد والعنوان ورقم الموبايل قبل تأكيد الطلب.",
  paymentHeading:paymentLabel,shippingHeading:"مصاريف الشحن حسب المنطقة",deliveryHeading:"مواعيد التوصيل",returnsHeading:"الاسترجاع والاستبدال",
  shippingIntro:"تفاصيل الدفع والشحن والاسترجاع في يومياتي مصر.",
  preCheckoutNotice:"إتمام الطلب مش مفعّل في النسخة دي. تقدري تتصفحي الأقسام والمنتجات."
 },
 iq:{
  payment:paymentAnswer,
  shipping:"أجرة التوصيل تعتمد على عنوانچ داخل العراق، وتراجعينها ويا مجموع الطلب قبل التأكيد.",
  delivery:"وقت التوصيل يختلف حسب المحافظة والعنوان وتجهيز المنتج. تفاصيل الوجهة مرتبطة بالطلب.",
  returns:"تكدرين تطلبين إرجاع أو استبدال حسب حالة المنتج وحقوقچ القانونية. احتفظي برقم الطلب والتفاصيل.",
  tracking:"متابعة الطلب تكون برقمه المسجّل والصحيح. ما نعرض حالة لطلب مو مسجّل.",
  confirmation:"راجعي المنتج والعدد ورقم الموبايل والعنوان قبل تأكيد الطلب.",
  paymentHeading:paymentLabel,shippingHeading:"أجرة التوصيل",deliveryHeading:"وقت التوصيل",returnsHeading:"الاسترجاع والاستبدال",
  shippingIntro:"تفاصيل الدفع والتوصيل والإرجاع في يومياتي العراق.",
  preCheckoutNotice:"إتمام الطلب مو مفعّل بهالنسخة. تصفّحي الأقسام والمنتجات على راحتچ."
 }
} as const;
