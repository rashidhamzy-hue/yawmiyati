import type {MarketCode} from "./markets";
/**
 * Short shopper-facing labels for the shopping flow, in each market's own dialect.
 * Service facts (payment, delivery, returns) stay in customer-service-copy.ts (M9); nothing here states a fee or a promise.
 */
const base={
 seeAll:"عرض الكل",allProducts:"كل المنتجات",loadMore:"عرض المزيد",retry:"إعادة المحاولة",
 bundleChip:"طقم",offerChip:"وفّري أكثر",videoChip:"فيديو",
 loadError:"تعذّر تحميل المنتجات الآن.",noResults:"لا توجد نتائج مطابقة.",
 sectionEmptyTitle:"لا توجد منتجات في هذا القسم الآن",sectionEmptyBody:"تصفّحي بقية الأقسام أو كل المنتجات.",
 sortLabel:"ترتيب المنتجات",sortFeatured:"اختيارات يومياتي",sortLow:"السعر: الأقل أولاً",sortHigh:"السعر: الأعلى أولاً",
 filter:"تصفية",searchInSection:"ابحثي في هذا القسم",priceFrom:"من السعر",priceTo:"إلى السعر",priceRangeError:"تحققي من نطاق السعر.",
 productsCount:(n:number)=>n===1?"منتج واحد":n===2?"منتجان":n<=10?n+" منتجات":n+" منتجاً",
 picksTitle:"اختيارات يومياتي",moreFrom:(name:string)=>"من "+name,
};
export type ShopCopy=typeof base;
const overrides:Record<MarketCode,Partial<ShopCopy>>={
 sa:{seeAll:"شوفي الكل",loadMore:"شوفي أكثر",searchInSection:"دوّري في هذا القسم"},
 ae:{seeAll:"شوفي الكل",loadMore:"شوفي أكثر",offerChip:"وفّري أكثر",searchInSection:"دوّري في هالقسم"},
 om:{seeAll:"شوفي الكل",loadMore:"شوفي أكثر"},
 eg:{seeAll:"شوفي الكل",loadMore:"شوفي أكتر",offerChip:"وفّري أكتر",sectionEmptyBody:"اتفرّجي على باقي الأقسام أو كل المنتجات.",searchInSection:"دوّري في القسم ده"},
 iq:{seeAll:"شوفي الكل",loadMore:"شوفي أكثر",sectionEmptyBody:"لفّي على بقية الأقسام أو كل المنتجات.",searchInSection:"دوّري بهالقسم"},
};
export const shopCopy=(market:MarketCode):ShopCopy=>({...base,...overrides[market]});
