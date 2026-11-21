import {customerServiceCopy} from "./customer-service-copy";

/**
 * Saudi customer-facing service content. The supplier quote ledger remains
 * INTERNAL and unapproved for a customer shipping fee, ETA or return window.
 * Checkout release is controlled independently by verified server policy.
 */
const c=customerServiceCopy.sa;
export const saudiDelivery={
 payment:c.payment,shipping:c.shipping,near:c.delivery,far:c.confirmation,returns:c.returns
} as const;
export const saudiShippingPage={
 title:"الدفع والتوصيل والاسترجاع",
 intro:c.shippingIntro,
 groups:[
  ["كيف أدفع؟",c.payment],
  ["كم رسوم الشحن؟",c.shipping],
  ["كم يستغرق التوصيل؟",c.delivery],
  ["كيف أتأكد من طلبي؟",c.confirmation],
  ["كيف أسترجع أو أستبدل؟",c.returns],
  ["وش لو احتجت مساعدة في التوصيل؟","راجعي تفاصيل عنوانك ورقم الطلب عند طلب المساعدة، حتى يسهل التحقق من الحالة."],
  ["كيف أتابع أو ألغي طلبي؟",c.tracking],
 ] as readonly (readonly [string,string])[],
} as const;
export const saudiHomeQuestions=[
 {question:"أقدر أدفع عند الاستلام؟",answer:c.payment},
 {question:"بكم الشحن داخل السعودية؟",answer:c.shipping},
 {question:"متى يوصلني طلبي؟",answer:c.delivery},
 {question:"وش إجراءات الاسترجاع؟",answer:c.returns},
] as const;
