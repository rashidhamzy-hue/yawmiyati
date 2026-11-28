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
 picksTitle:"اختيارات يومياتي",
 orderNow:"اطلبي الآن",addToCart:"أضيفي للسلة",addedToCart:"أُضيف للسلة",viewCart:"عرض السلة",cart:"السلة",
 chooseQuantity:"اختاري الكمية",onePiece:"قطعة واحدة",twoPieces:"قطعتان",pieces:(n:number)=>n+" قطع",
 save:(amount:string)=>"وفّري "+amount,bestValue:"الأوفر",lowStock:"الكمية محدودة",
 gallery:"صور المنتج",photo:(i:number,n:number)=>"صورة "+i+" من "+n,video:"فيديو المنتج",watchVideo:"شاهدي الفيديو",
 aboutProduct:"عن المنتج",readMore:"اقرئي المزيد",readLess:"عرض أقل",specs:"المواصفات",productFaq:"أسئلة شائعة",
 bundleContents:"محتويات الطقم",inThisSet:(n:number)=>n===2?"قطعتان في طقم واحد":n+" قطع في طقم واحد",
 reassureCall:"نتصل بك لتأكيد الطلب قبل الشحن",unitEach:(amount:string)=>amount+" للقطعة",
 breadcrumbHome:"الرئيسية",productNotFoundTitle:"هذا المنتج غير متاح الآن",productNotFoundBody:"قد يكون نفد أو تغيّر رابطه. تصفّحي بقية المنتجات.",moreFrom:(name:string)=>"من "+name,
};
export type ShopCopy=typeof base;
const overrides:Record<MarketCode,Partial<ShopCopy>>={
 sa:{twoPieces:"قطعتين",readMore:"اقرئي أكثر",reassureCall:"نتواصل معك لتأكيد الطلب قبل الشحن",watchVideo:"شوفي الفيديو",seeAll:"شوفي الكل",loadMore:"شوفي أكثر",searchInSection:"دوّري في هذا القسم"},
 ae:{orderNow:"اطلبي الحين",twoPieces:"قطعتين",readMore:"اقري أكثر",reassureCall:"بنتواصل وياج لتأكيد الطلب قبل الشحن",watchVideo:"شوفي الفيديو",productNotFoundBody:"يمكن خلص أو تغيّر الرابط. شوفي باقي المنتجات.",seeAll:"شوفي الكل",loadMore:"شوفي أكثر",offerChip:"وفّري أكثر",searchInSection:"دوّري في هالقسم"},
 om:{twoPieces:"قطعتين",reassureCall:"نتواصل معك لتأكيد الطلب قبل الشحن",watchVideo:"شوفي الفيديو",seeAll:"شوفي الكل",loadMore:"شوفي أكثر"},
 eg:{orderNow:"اطلبي دلوقتي",addToCart:"ضيفي للسلة",addedToCart:"اتضاف للسلة",viewCart:"شوفي السلة",twoPieces:"قطعتين",readMore:"اقري أكتر",readLess:"عرض أقل",lowStock:"الكمية محدودة",reassureCall:"هنكلمك نأكد الطلب قبل الشحن",watchVideo:"شوفي الفيديو",productNotFoundTitle:"المنتج ده مش متاح دلوقتي",productNotFoundBody:"ممكن يكون خلص أو الرابط اتغيّر. اتفرّجي على باقي المنتجات.",seeAll:"شوفي الكل",loadMore:"شوفي أكتر",offerChip:"وفّري أكتر",sectionEmptyBody:"اتفرّجي على باقي الأقسام أو كل المنتجات.",searchInSection:"دوّري في القسم ده"},
 iq:{orderNow:"اطلبي هسه",addToCart:"ضيفي للسلة",addedToCart:"انضاف للسلة",viewCart:"شوفي السلة",twoPieces:"قطعتين",readMore:"اقري أكثر",reassureCall:"نتصل بيچ نأكد الطلب قبل الشحن",watchVideo:"شوفي الفيديو",productNotFoundTitle:"هذا المنتج مو متوفر هسه",productNotFoundBody:"يمكن خلص أو تغيّر الرابط. شوفي بقية المنتجات.",seeAll:"شوفي الكل",loadMore:"شوفي أكثر",sectionEmptyBody:"لفّي على بقية الأقسام أو كل المنتجات.",searchInSection:"دوّري بهالقسم"},
};
export const shopCopy=(market:MarketCode):ShopCopy=>({...base,...overrides[market]});
