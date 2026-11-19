import { img, type ImgKey } from "./images";

export const country = {
  code: "sa",
  name: "السعودية",
  currency: "ر.س",
  deliveryFee: 25,
  freeDeliveryFrom: 199,
  deliveryDays: "٢–٥ أيام عمل",
  cities: ["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر", "الطائف", "تبوك", "أبها", "بريدة"],
};

export type Category = { slug: string; name: string; intro: string; image: ImgKey; subs: string[] };
export const categories: Category[] = [
  { slug: "home", name: "المنزل والديكور", intro: "قطع عملية وأنيقة ترتّب بيتك وتضيف له دفئاً.", image: "cat-home", subs: ["تخزين", "ديكور", "حمّام"] },
  { slug: "kitchen", name: "المطبخ والقهوة", intro: "أدوات تختصر وقتك في المطبخ وتجعل قهوتك أجمل.", image: "cat-kitchen", subs: ["قهوة", "تحضير", "تقديم"] },
  { slug: "beauty", name: "الجمال والعناية", intro: "أدوات عناية يومية مختارة بعناية.", image: "cat-beauty", subs: ["بشرة", "شعر", "مكياج"] },
  { slug: "fashion", name: "إكسسوارات", intro: "لمسات ناعمة تكمّل إطلالتك اليومية.", image: "cat-fashion", subs: ["أوشحة", "مجوهرات"] },
  { slug: "wellness", name: "الراحة والعطور", intro: "أجواء هادئة لبيتك: بخور ومعطرات وراحة.", image: "cat-wellness", subs: ["بخور", "نوم"] },
  { slug: "organize", name: "التنظيم", intro: "منظّمات تجعل كل شيء في مكانه.", image: "cat-organize", subs: ["مكياج", "أدراج"] },
];

export type Product = {
  slug: string; name: string; category: string; sub: string; price: number; compareAt?: number;
  badge?: string; image: ImgKey; gallery: ImgKey[]; variants?: { label: string; options: string[] };
  short: string; benefits: string[]; specs: [string, string][]; included: string[]; care: string;
  inStock: boolean; isNew?: boolean; trending?: boolean;
};

export const products: Product[] = [
  { slug: "milk-frother", name: "خفّاقة حليب كهربائية", category: "kitchen", sub: "قهوة", price: 59, compareAt: 79, badge: "الأكثر طلباً", image: "p1", gallery: ["p1", "cat-kitchen"], short: "رغوة كثيفة لقهوتك في ثوانٍ.", benefits: ["رغوة خلال ١٥ ثانية", "تعمل بالبطارية", "سهلة التنظيف"], specs: [["المادة", "ستانلس ستيل"], ["التشغيل", "بطاريتان AA"]], included: ["خفاقة", "حامل"], care: "اغسلي الرأس بالماء الدافئ فقط.", inStock: true, trending: true },
  { slug: "silk-sleep-set", name: "طقم حرير للنوم", category: "wellness", sub: "نوم", price: 89, badge: "جديد", image: "p2", gallery: ["p2"], variants: { label: "اللون", options: ["شامبين", "وردي", "رمادي"] }, short: "غطاء وسادة وقناع عين بملمس ناعم.", benefits: ["يقلل تشابك الشعر", "ناعم على البشرة"], specs: [["المقاس", "٥٠×٧٥ سم"], ["الخامة", "ساتان حريري"]], included: ["غطاء وسادة", "قناع عين"], care: "غسيل يدوي بماء بارد.", inStock: true, isNew: true, trending: true },
  { slug: "portable-blender", name: "خلاط محمول", category: "kitchen", sub: "تحضير", price: 99, compareAt: 129, image: "p3", gallery: ["p3"], variants: { label: "اللون", options: ["أبيض", "أخضر"] }, short: "عصير طازج أينما كنتِ.", benefits: ["شحن USB", "سعة ٤٠٠ مل"], specs: [["السعة", "٤٠٠ مل"], ["الشحن", "USB-C"]], included: ["خلاط", "كابل شحن"], care: "لا تغمري القاعدة بالماء.", inStock: true, trending: true },
  { slug: "bamboo-bath-set", name: "طقم حمّام من الخيزران", category: "home", sub: "حمّام", price: 119, badge: "طقم", image: "p4", gallery: ["p4", "cat-home"], short: "٤ قطع تنظّم حمّامك بأناقة طبيعية.", benefits: ["خيزران طبيعي", "مقاوم للرطوبة"], specs: [["عدد القطع", "٤"], ["الخامة", "خيزران"]], included: ["موزع صابون", "حامل فرش", "صحن صابون", "علبة قطن"], care: "امسحيه بقطعة قماش جافة.", inStock: true, isNew: true },
  { slug: "bakhoor-burner", name: "مبخرة خشبية فاخرة", category: "wellness", sub: "بخور", price: 75, image: "p5", gallery: ["p5", "cat-wellness"], short: "لمسة تراثية بتصميم عصري.", benefits: ["خشب منقوش", "قاعدة معدنية آمنة"], specs: [["الارتفاع", "١٤ سم"]], included: ["مبخرة"], care: "نظّفي الصحن بعد كل استخدام.", inStock: true, trending: true },
  { slug: "heatless-curls", name: "أداة تجعيد بدون حرارة", category: "beauty", sub: "شعر", price: 45, image: "p6", gallery: ["p6", "cat-beauty"], variants: { label: "اللون", options: ["وردي", "بيج"] }, short: "تموجات طبيعية أثناء النوم.", benefits: ["بدون حرارة", "مناسبة لكل أنواع الشعر"], specs: [["الخامة", "ساتان"]], included: ["شريط تجعيد", "٢ مشبك", "ربطة شعر"], care: "غسيل يدوي.", inStock: true, isNew: true },
  { slug: "led-mirror", name: "مرآة مكياج بإضاءة LED", category: "beauty", sub: "مكياج", price: 139, compareAt: 169, image: "p7", gallery: ["p7"], short: "إضاءة متساوية لمكياج دقيق.", benefits: ["٣ درجات إضاءة", "شحن USB"], specs: [["القطر", "٢٠ سم"], ["الإضاءة", "LED قابلة للتعتيم"]], included: ["مرآة", "كابل"], care: "امسحيها بقماش ناعم.", inStock: false },
  { slug: "spice-jars", name: "طقم برطمانات بهارات", category: "kitchen", sub: "تقديم", price: 85, badge: "طقم ١٢ قطعة", image: "p8", gallery: ["p8", "cat-kitchen"], short: "مطبخ مرتب بأغطية ذهبية.", benefits: ["زجاج سميك", "ملصقات عربية"], specs: [["عدد القطع", "١٢"], ["السعة", "١٢٠ مل"]], included: ["١٢ برطمان", "ملصقات"], care: "الزجاج آمن في غسالة الصحون، الأغطية يدوياً.", inStock: true, isNew: true },
];

export const getProduct = (slug: string) => products.find((p) => p.slug === slug);
export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
export const imageOf = (k: ImgKey) => img[k];

export function formatPrice(n: number) {
  return `${n.toLocaleString("ar-SA")} ${country.currency}`;
}

export function orderTotals(subtotal: number) {
  const delivery = subtotal === 0 || subtotal >= country.freeDeliveryFrom ? 0 : country.deliveryFee;
  return { subtotal, delivery, total: subtotal + delivery };
}

export function isValidSaudiPhone(raw: string) {
  const d = raw.replace(/[\s-]/g, "").replace(/^(\+966|00966|966)/, "0");
  return /^05\d{8}$/.test(d);
}
