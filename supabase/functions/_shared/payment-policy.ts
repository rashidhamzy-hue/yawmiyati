export const paymentLabel = "الدفع عند الاستلام";
export const paymentAnswer = "الدفع عند الاستلام فقط. لا يتوفر الدفع الإلكتروني عبر الموقع.";

export function asksAboutPayment(message: string): boolean {
  const text = message.toLowerCase().replace(/[\u064b-\u065f\u0640]/g, "").replace(/[أإآ]/g, "ا");
  return /دفع|بتقبلوا.{0,10}كروت|بطاق|فيزا|ماستر\s?كارد|ابل\s?باي|مدى|انستا\s?باي|فودافون\s?كاش|كاش|نقد|اون\s?لاين|عند الاستلام|\b(pay(?:ment|pal)?|prepaid|cash|cod|cards?|visa|mastercard|mada|online payment)\b/i.test(text);
}
