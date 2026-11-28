import type {MarketCode} from "./markets";
import {customerServiceCopy} from "./customer-service-copy";
import {assistantCopy} from "./assistant-copy";
import {chromeCopy} from "./chrome-copy";
/**
 * Words of the store's pages in each market: section pages, the story page, the empty cart and order pages, the
 * search panel, the home page's own lines, and the help, privacy and terms pages. Part of the market dictionary
 * (dictionary.ts): labels are the same everywhere, sentences are in the market's own dialect. Facts (payment, delivery,
 * returns, the confirmation call) are never written here: they come from customer-service-copy.ts and assistant-copy.ts.
 * The privacy and terms pages are in plain formal Arabic in all five markets on purpose: they are legal text.
 */
type Section="home"|"kitchen"|"kids"|"beauty"|"fashion"|"wellness"|"organize";
type Pair=readonly [string,string];
const shared={
 crumbs:"مسار الصفحة",skip:"تخطي إلى المحتوى",brand:"يومياتي",storyCrumb:"قصتنا",allProducts:"كل المنتجات",switchSections:"تبديل الأقسام",otherSections:"أقسام أخرى",sectionProducts:"منتجات القسم",
 productsOf:(name:string)=>"منتجات "+name,mostPopular:"الأكثر رواجاً",searchInThisSection:"البحث في هذا القسم",lowestPrice:"أقل سعر",highestPrice:"أعلى سعر",
 previewOnly:"منتجات للمعاينة فقط، لا يمكن إرسال طلب فعلي.",sectionNotFound:"القسم غير موجود",backToStore:"العودة إلى يومياتي",
 journeyLabel:"رحلة يومياتي",altCoffee:"تفاصيل ركن القهوة والحياة اليومية",altHome:"تفاصيل البيت التي تلهم اختياراتنا",altBeauty:"تفاصيل الجمال والعناية",
 cartEyebrow:"سلة يومياتي",cartAlt:"أفكار منزلية دافئة",checkoutEyebrow:"إتمام الطلب",checkoutAlt:"تفاصيل ركن القهوة",orderEyebrow:"متابعة الطلب",orderAlt:"مساحة منزلية مرتبة",
 policiesLink:"تفاصيل الدفع والشحن والاسترجاع",
 searchDialog:"بحث يومياتي الذكي",searchClose:"إغلاق البحث",searchInput:"ابحثي في منتجات يومياتي",searchClear:"مسح البحث",searchClearShort:"مسح",searchResultsLabel:"نتائج بحث المنتجات",
 searchResultsTitle:"نتائج المنتجات",searchShown:(n:number)=>n+" نتيجة معروضة",suggestedSections:"الأقسام المقترحة",allSections:"كل الأقسام",storeOf:(name:string)=>"يومياتي "+name,
 homeIntro:"مقدمة يومياتي",homePolicies:"الدفع والتوصيل والاسترجاع",shopBySection:"تسوقي حسب القسم",crumbPath:"مسار التنقل",crumbHome:"الرئيسية",productDetails:"تفاصيل المنتج",
 searchProducts:"ابحثي في المنتجات",searchProductsLabel:"بحث المنتجات المعتمدة",retry:"إعادة المحاولة",browseByType:"تصفّحي حسب نوع المنتج",
 browseFrothers:"خفّاقات الحليب",browseHair:"أدوات تصفيف الشعر",browseSpices:"عبوات التوابل",browseBath:"أطقم الحمّام",
 beautyAlt:"مجموعة مستوحاة من الجمال والعناية",homeAlt:"تفاصيل منزلية دافئة",worldAlt:"تفاصيل من عالم يومياتي",
 infoAltHelp:"ركن للقهوة بتفاصيل دافئة",infoAltPrivacy:"تفاصيل منزلية طبيعية وهادئة",infoAltTerms:"ركن منزلي منظم",infoAltShipping:"اختيارات أزياء وإكسسوارات",
 linkHelp:"مركز المساعدة",linkShipping:"الدفع والتوصيل",linkPrivacy:"الخصوصية",linkTerms:"الشروط",
 metaDescription:"يومياتي: متجر للبيت والمطبخ والجمال والعناية، والدفع نقداً عند الاستلام.",
 browseAllLabel:"تصفحي جميع المنتجات",filterBySection:"تصفية حسب القسم",searchBox:"بحث المنتجات",sortLabel:"ترتيب المنتجات",sortRelevance:"الأكثر صلة",sortLow:"السعر: الأقل أولاً",sortHigh:"السعر: الأعلى أولاً",sortName:"الاسم",
 clearFilters:"مسح التصفية",priceRangeCheck:"تحققي من نطاق السعر وإدخاله بشكل صحيح.",priceRangeError:"أدخلي سعراً صحيحاً، وتأكدي أن الحد الأدنى لا يتجاوز الحد الأعلى.",showAll:"عرض كل المنتجات",noPicture:"الصورة غير متاحة",
 pagesLabel:"صفحات المنتجات",previousPage:"السابق",nextPage:"التالي",pageOf:(page:number,pages:number)=>"صفحة "+page+" من "+pages,productCount:(n:number)=>n+" منتج",resultCount:(n:number)=>n+" نتيجة",detailsOf:(title:string)=>"تفاصيل "+title,
 productPrice:"سعر المنتج",shippingFee:"الشحن",totalWithShipping:"الإجمالي مع الشحن",
 // Privacy and terms: plain formal Arabic, the same in every market.
 privacyTitle:"الخصوصية والبيانات",privacyIntro:"ما الذي نعرفه عنك، ولماذا، وما الذي لا نجمعه أبداً.",privacyEyebrow:"خصوصيتك تهمنا",
 privacyNote:"لا تشاركي أي معلومات حساسة في البحث أو محادثة المساعد.",
 privacyGroups:[
  ["بيانات الطلب","عند تسجيل طلب نحتاج إلى اسم المستلمة ورقم الهاتف والعنوان. نستخدمها لتأكيد الطلب وتوصيله وخدمته فقط، وتصل إلى شركة التوصيل لهذا الغرض وحده."],
  ["لا حساب ولا بريد إلكتروني","لا نطلب إنشاء حساب ولا بريداً إلكترونياً ولا بيانات بطاقة. الدفع نقداً عند الاستلام."],
  ["لا ملف شخصي ولا أسعار خاصة","لا ننشئ ملفاً شخصياً عنك، والأسعار والعروض واحدة لكل العميلات."],
  ["قياس التصفح","نستخدم أدوات قياس مجهولة الهوية لتحسين المتجر. تسجيل الجلسة ومشاركة أحداث التسوق مع منصات الإعلان لا يعملان إلا بعد موافقتك، ويمكنك الرفض."],
  ["البحث والمساعد","تُستخدم أسئلتك للرد عليها، وقد تُعالَج لدى مزوّد خدمة ذكاء اصطناعي. لا تكتبي فيها كلمات مرور أو أرقام هوية أو بيانات بطاقات."],
  ["روابط الجهات الأخرى","بعض الروابط تنقلك إلى خدمات خارجية لها سياسات خصوصية مستقلة."],
 ] as readonly Pair[],
 termsTitle:"شروط استخدام الموقع",termsIntro:"ما تحتاجين معرفته عن المنتجات والأسعار والطلبات في يومياتي.",termsEyebrow:"تفاصيل الاستخدام",
 termsNote:"راجعي وصف كل منتج ومعلوماته قبل تقديم الطلب، مع الاحتفاظ بحقوقك كمستهلكة.",
 termsGroups:(market:MarketCode):readonly Pair[]=>[
  ["المنتجات","صور الأقسام للتعريف بها. المرجع لكل منتج هو صوره ومواصفاته وسعره في صفحته، وقد يتغير توافره."],
  ["الأسعار والدفع",customerServiceCopy[market].payment+" الأسعار بعملة المتجر، ويظهر إجمالي الطلب مع رسوم التوصيل قبل التأكيد. "+customerServiceCopy[market].shipping],
  ["تأكيد الطلب",assistantCopy(market).callAnswer],
  ["التوصيل",chromeCopy(market).formCountryFixed(MARKET_NAME[market])+". "+customerServiceCopy[market].delivery],
  ["الاسترجاع",customerServiceCopy[market].returns+" لا تنتقص هذه الشروط من حقوقك المقررة كمستهلكة."],
  ["المساعد","المساعد يقدم معلومات عن الأقسام والمنتجات، ولا يؤكد طلباً ولا يعطي سعراً خارج ما يعرضه المتجر."],
 ],
};
const MARKET_NAME:Record<MarketCode,string>={sa:"السعودية",ae:"الإمارات",om:"عُمان",eg:"مصر",iq:"العراق"};
type Local={
 // Section pages
 sectionEyebrow:string;sectionSearch:string;moreEyebrow:string;moreTitle:string;moreText:string;
 /** One line under each section's products: what the shopper finds there. */
 sectionIntro:Record<Section,string>;
 questionsTitle:string;
 /** Questions shoppers ask before ordering; the answers are the store's published facts. */
 questionTitles:{pay:string;fee:string;time:string;call:string;returns:string};
 seeOffers:string;seePolicies:string;
 // Story page
 journey:string;storyTitle:string;storyIntro:string;difference:string;question:string;
 // Empty cart, checkout and order pages
 cartTitle:string;checkoutTitle:string;orderTitle:string;browseSections:string;searchStore:string;browseHint:string;
 // Search panel
 searchPlaceholder:string;searchHint:string;searchUnreachable:string;searchFailed:string;searching:string;searchNone:string;sectionsMayLike:string;sectionsByInterest:string;noSections:string;
 // Home page
 searchByName:string;refreshFailed:string;emptyTitle:string;emptyText:string;loadFailed:string;moreChoices:string;notInStoreTitle:string;notInStoreText:string;loadMore:string;
 noMatchTitle:string;startTitle:string;tryOtherWord:string;browseIdea:string;beautyEyebrow:string;homeEyebrow:string;
 // Help page
 helpTitle:string;helpIntro:string;helpEyebrow:string;shippingEyebrow:string;answersEyebrow:string;answersTitle:string;
 asideTitle:string;asideText:string;assistantTitle:string;assistantText:string;assistantWhere:string;searchLabel:string;
 helpFind:Pair;helpFamily:Pair;helpTrack:string;
};
const local:Record<MarketCode,Local>={
 sa:{
  sectionEyebrow:"اكتشفي عالم يومياتي",sectionSearch:"ابحثي بين المنتجات",moreEyebrow:"تفاصيل تلهمك",moreTitle:"اكتشفي ما يناسب يومك",moreText:"تصفّحي باقي أقسام يومياتي. لو في بالك منتج معيّن، ابحثي عنه وشوفي تفاصيله.",
  sectionIntro:{home:"لمسات ديكور وإضاءة ومفارش تغيّر جو الغرفة من غير تعب.",kitchen:"أدوات القهوة والتحضير والتقديم اللي تسهّل عليك وتحلّي ركنك.",kids:"أغراض تساعدك في يومك مع صغارك: نوم، أكل، لعب وترتيب.",beauty:"أدوات عناية وتجميل لروتينك اليومي في البيت.",fashion:"شنط وإكسسوارات تكمّل إطلالتك.",wellness:"أشياء للراحة والاسترخاء بعد يوم طويل.",organize:"منظمات وحلول تخزين ترتّب الأدراج والدواليب والمطبخ."},
  questionsTitle:"قبل ما تطلبين",questionTitles:{pay:"كيف أدفع؟",fee:"كم رسوم التوصيل؟",time:"متى يوصل الطلب؟",call:"تتصلون قبل الشحن؟",returns:"أقدر أرجّع المنتج؟"},
  seeOffers:"شوفي العروض والأطقم",seePolicies:"كل تفاصيل الدفع والتوصيل والاسترجاع",
  journey:"من يومياتنا",storyTitle:"كيف بدأت حكايتنا؟",storyIntro:"من أفكار تلهم يومك إلى تفاصيل تختارينها بنفسك.",difference:"وش يميّز يومياتي؟",question:"عندك سؤال؟",
  cartTitle:"سلتك فاضية… خلّينا نملأها بذوقك",checkoutTitle:"لا توجد منتجات جاهزة لإتمام الطلب",orderTitle:"ما لقينا بيانات لهذا الطلب",browseSections:"اكتشفي الأقسام",searchStore:"ابحثي في يومياتي",browseHint:"تصفّحي الأقسام واختاري ما يناسب ذوقك.",
  searchPlaceholder:"جرّبي: قهوة، دلة، شنطة، عناية…",searchHint:"يفهم اختلاف كتابة الكلمات ويقترح عليك أقسام تناسب بحثك.",searchUnreachable:"ما قدرنا نوصل للمنتجات الحين. تصفّحي الأقسام تحت.",searchFailed:"ما قدرنا نحمّل المنتجات الحين. جرّبي بعد شوي.",searching:"نبحث لك في المنتجات…",searchNone:"ما لقينا منتج يطابق بحثك. جرّبي كلمة ثانية أو تصفّحي الأقسام تحت.",sectionsMayLike:"أقسام ممكن تعجبك",sectionsByInterest:"اكتشفي حسب اهتماماتك",noSections:"ما فيه قسم يطابق بحثك. جرّبي كلمة أبسط أو اختاري من الأقسام.",
  searchByName:"ابحثي باسم المنتج أو القسم",refreshFailed:"ما قدرنا نحدّث المنتجات الحين. تقدرين تتصفحين الأقسام أو تجربين مرة ثانية.",emptyTitle:"تعرّفي على أقسام يومياتي",emptyText:"منتجات هذا المتجر تظهر هنا. اكتشفي أقسام البيت والجمال والعناية.",loadFailed:"ما قدرنا نحمّل المنتجات الحين",moreChoices:"اختيارات ثانية من يومياتي",notInStoreTitle:"هذا المنتج ما عاد متوفر",notInStoreText:"يمكن خلصت كميته أو انشال من المتجر. شوفي اختيارات ثانية تعجبك.",loadMore:"عرض المزيد من المنتجات",
  noMatchTitle:"ما لقينا منتجات مطابقة",startTitle:"من هنا تبدأ اختياراتك",tryOtherWord:"جرّبي البحث بكلمة مختلفة.",browseIdea:"تصفّحي الأقسام واستكشفي الأفكار اللي تعجبك.",beautyEyebrow:"العناية تبدأ من التفاصيل",homeEyebrow:"بيت يعكس ذوقك",
  helpTitle:"كيف نقدر نساعدك؟",helpIntro:"إجابات واضحة عن الدفع والتوصيل والاسترجاع وطريقة الطلب.",helpEyebrow:"مركز مساعدة يومياتي",shippingEyebrow:"معلومات قبل الطلب",answersEyebrow:"إجابات واضحة",answersTitle:"كل ما تحتاجين معرفته",
  asideTitle:"خلّينا نسهّل عليك الاختيار",asideText:"ابدئي باستكشاف الأقسام، أو استخدمي البحث للوصول إلى المنتج اللي يناسبك.",assistantTitle:"مساعدة تناسب سؤالك",assistantText:"اسألي مساعدة يومياتي عن الأقسام والمنتجات المعروضة. الإجابات من بيانات المتجر نفسها.",assistantWhere:"زر المساعدة أسفل الشاشة",searchLabel:"البحث في يومياتي",
  helpFind:["كيف ألقى منتج يناسبني؟","اضغطي علامة البحث فوق واكتبي اللي في بالك، أو تصفّحي الأقسام، أو اسألي مساعدة يومياتي من الزر تحت وهي تقترح عليك من المنتجات المتوفرة."],
  helpFamily:["أقدر أطلب لأهلي في بلد ثاني؟","أكيد. كل متجر يوصّل داخل بلده: اختاري متجر البلد اللي فيه أهلك واكتبي اسم ورقم اللي بيستلم هناك. اللي يستلم هو اللي يدفع عند الاستلام."],
  helpTrack:"كيف أتابع طلبي؟",
 },
 ae:{
  sectionEyebrow:"اكتشفي عالمج",sectionSearch:"دوّري بين المنتجات",moreEyebrow:"تفاصيل على ذوقج",moreTitle:"اختيارات تكمل يومج",moreText:"لفّي على باجي أقسام يومياتي. إذا في بالج منتج، دوّري عليه وشوفي تفاصيله.",
  sectionIntro:{home:"لمسات ديكور وإضاءة ومفارش تغيّر جو الغرفة بدون تعب.",kitchen:"أدوات القهوة والتحضير والتقديم اللي تسهّل عليج وتحلّي ركنج.",kids:"أغراض تساعدج في يومج ويا صغارج: نوم، أكل، لعب وترتيب.",beauty:"أدوات عناية وتجميل لروتينج اليومي في البيت.",fashion:"شنط وإكسسوارات تكمّل طلّتج.",wellness:"أشياء للراحة والاسترخاء عقب يوم طويل.",organize:"منظمات وحلول تخزين ترتّب الأدراج والكبتات والمطبخ."},
  questionsTitle:"قبل لا تطلبين",questionTitles:{pay:"كيف أدفع؟",fee:"كم رسوم التوصيل؟",time:"متى يوصل الطلب؟",call:"تتصلون قبل الشحن؟",returns:"أقدر أرجّع المنتج؟"},
  seeOffers:"شوفي العروض والأطقم",seePolicies:"كل تفاصيل الدفع والتوصيل والاسترجاع",
  journey:"حكاية يومياتي الإمارات",storyTitle:"كيف بدأت حكايتنا؟",storyIntro:"أفكار وتفاصيل تجمع الذوق والبساطة، من البيت لستايلج.",difference:"شو يميّز يومياتي؟",question:"عندج سؤال؟",
  cartTitle:"سلتج بانتظار اختياراتج",checkoutTitle:"ما في منتجات جاهزة لإتمام الطلب",orderTitle:"ما لقينا بيانات الطلب",browseSections:"تصفّحي الأقسام",searchStore:"دوّري في يومياتي",browseHint:"لفّي على الأقسام واختاري اللي يناسب ذوقج.",
  searchPlaceholder:"جرّبي: ديكور، عناية، إكسسوارات…",searchHint:"يفهم اختلاف كتابة الكلمات ويقترح عليج أقسام تناسب بحثج.",searchUnreachable:"ما قدرنا نوصل للمنتجات الحين. لفّي على الأقسام تحت.",searchFailed:"ما قدرنا نحمّل المنتجات الحين. جرّبي عقب شوي.",searching:"ندوّر لج في المنتجات…",searchNone:"ما لقينا منتج يطابق بحثج. جرّبي كلمة ثانية أو لفّي على الأقسام تحت.",sectionsMayLike:"أقسام يمكن تعجبج",sectionsByInterest:"اكتشفي حسب اهتماماتج",noSections:"ما في قسم يطابق بحثج. جرّبي كلمة أبسط أو اختاري من الأقسام.",
  searchByName:"دوّري باسم المنتج أو القسم",refreshFailed:"ما قدرنا نحدّث المنتجات الحين. تقدرين تلفّين على الأقسام أو تجرّبين مرة ثانية.",emptyTitle:"تعرّفي على أقسام يومياتي",emptyText:"منتجات هالمتجر تظهر هني. اكتشفي أقسام البيت والجمال والعناية.",loadFailed:"ما قدرنا نحمّل المنتجات الحين",moreChoices:"اختيارات ثانية من يومياتي",notInStoreTitle:"هالمنتج ما عاد متوفر",notInStoreText:"يمكن خلصت كميته أو انشال من المتجر. شوفي اختيارات ثانية تعجبج.",loadMore:"عرض منتجات أكثر",
  noMatchTitle:"ما لقينا منتجات مطابقة",startTitle:"من هني تبدأ اختياراتج",tryOtherWord:"جرّبي كلمة ثانية.",browseIdea:"لفّي على الأقسام وشوفي الأفكار اللي تعجبج.",beautyEyebrow:"العناية تبدأ من التفاصيل",homeEyebrow:"بيت يعكس ذوقج",
  helpTitle:"كيف نقدر نساعدج؟",helpIntro:"إجابات واضحة عن الدفع والتوصيل والاسترجاع وطريقة الطلب.",helpEyebrow:"مركز مساعدة يومياتي",shippingEyebrow:"معلومات قبل الطلب",answersEyebrow:"إجابات واضحة",answersTitle:"كل اللي تحتاجين تعرفينه",
  asideTitle:"اختياراتج أسهل ويا يومياتي",asideText:"تصفّحي الأقسام أو دوّري على المنتج اللي يناسب ذوقج.",assistantTitle:"عندج سؤال؟",assistantText:"اسألي مساعدة يومياتي عن الأقسام والمنتجات المعروضة. الإجابات من بيانات المتجر نفسه.",assistantWhere:"زر المساعدة تحت الشاشة",searchLabel:"البحث في يومياتي",
  helpFind:["كيف ألقى منتج يناسبني؟","اضغطي علامة البحث فوق واكتبي اللي في بالج، أو لفّي على الأقسام، أو اسألي مساعدة يومياتي من الزر تحت وهي تقترح عليج من المنتجات المتوفرة."],
  helpFamily:["أقدر أطلب لأهلي في بلد ثاني؟","هيه. كل متجر يوصّل داخل بلده: اختاري متجر البلد اللي فيه أهلج واكتبي اسم ورقم اللي بيستلم هناك. اللي يستلم هو اللي يدفع عند الاستلام."],
  helpTrack:"كيف أتابع طلبي؟",
 },
 om:{
  sectionEyebrow:"تفاصيل تناسب يومك",sectionSearch:"ابحثي بين المنتجات",moreEyebrow:"أفكار قريبة منك",moreTitle:"اختيارات تناسب أسلوبك",moreText:"استكشفي بقية أقسام يومياتي. وإذا تبحثين عن منتج محدد، استخدمي البحث وشوفي تفاصيله.",
  sectionIntro:{home:"لمسات ديكور وإضاءة ومفارش تغيّر جو الغرفة بدون تعب.",kitchen:"أدوات القهوة والتحضير والتقديم اللي تسهّل عليك وتحلّي ركنك.",kids:"أغراض تساعدك في يومك مع صغارك: نوم، أكل، لعب وترتيب.",beauty:"أدوات عناية وتجميل لروتينك اليومي في البيت.",fashion:"شنط وإكسسوارات تكمّل إطلالتك.",wellness:"أشياء للراحة والاسترخاء بعد يوم طويل.",organize:"منظمات وحلول تخزين ترتّب الأدراج والكبتات والمطبخ."},
  questionsTitle:"قبل ما تطلبين",questionTitles:{pay:"كيف أدفع؟",fee:"كم رسوم التوصيل؟",time:"متى يوصل الطلب؟",call:"تتصلون قبل الشحن؟",returns:"أقدر أرجّع المنتج؟"},
  seeOffers:"شوفي العروض والأطقم",seePolicies:"كل تفاصيل الدفع والتوصيل والإرجاع",
  journey:"من حكايتنا",storyTitle:"كيف بدأت يومياتي؟",storyIntro:"أفكار قريبة من تفاصيل البيت واللحظات الصغيرة اللي نحبها.",difference:"ما الذي يميّز يومياتي؟",question:"عندك سؤال؟",
  cartTitle:"سلتك بانتظار اختياراتك",checkoutTitle:"لا توجد منتجات جاهزة للطلب",orderTitle:"لا توجد بيانات لهذا الطلب",browseSections:"استكشفي الأقسام",searchStore:"ابحثي في يومياتي",browseHint:"تصفّحي الأقسام واختاري ما يناسب ذوقك.",
  searchPlaceholder:"جرّبي: قهوة، ترتيب، عناية…",searchHint:"يفهم اختلاف كتابة الكلمات ويقترح عليك أقسام تناسب بحثك.",searchUnreachable:"ما قدرنا نوصل للمنتجات الحين. تصفّحي الأقسام تحت.",searchFailed:"ما قدرنا نحمّل المنتجات الحين. جرّبي بعد شوي.",searching:"نبحث لك في المنتجات…",searchNone:"ما حصلنا منتج يطابق بحثك. جرّبي كلمة ثانية أو تصفّحي الأقسام تحت.",sectionsMayLike:"أقسام يمكن تعجبك",sectionsByInterest:"اكتشفي حسب اهتماماتك",noSections:"ما في قسم يطابق بحثك. جرّبي كلمة أبسط أو اختاري من الأقسام.",
  searchByName:"ابحثي باسم المنتج أو القسم",refreshFailed:"ما قدرنا نحدّث المنتجات الحين. تقدرين تتصفحين الأقسام أو تجربين مرة ثانية.",emptyTitle:"تعرّفي على أقسام يومياتي",emptyText:"منتجات هذا المتجر تظهر هنا. اكتشفي أقسام البيت والجمال والعناية.",loadFailed:"ما قدرنا نحمّل المنتجات الحين",moreChoices:"اختيارات ثانية من يومياتي",notInStoreTitle:"هذا المنتج ما عاد متوفر",notInStoreText:"يمكن خلصت كميته أو انشال من المتجر. شوفي اختيارات ثانية تعجبك.",loadMore:"عرض المزيد من المنتجات",
  noMatchTitle:"ما حصلنا منتجات مطابقة",startTitle:"من هنا تبدأ اختياراتك",tryOtherWord:"جرّبي البحث بكلمة ثانية.",browseIdea:"تصفّحي الأقسام واستكشفي الأفكار اللي تعجبك.",beautyEyebrow:"العناية تبدأ من التفاصيل",homeEyebrow:"بيت يعكس ذوقك",
  helpTitle:"كيف نقدر نساعدك؟",helpIntro:"إجابات واضحة عن الدفع والتوصيل والإرجاع وطريقة الطلب.",helpEyebrow:"مركز مساعدة يومياتي",shippingEyebrow:"معلومات قبل الطلب",answersEyebrow:"إجابات واضحة",answersTitle:"كل ما تحتاجين معرفته",
  asideTitle:"اختاري براحة",asideText:"استكشفي الأقسام أو استخدمي البحث للوصول إلى المنتج المناسب لك.",assistantTitle:"مساعدة تناسب سؤالك",assistantText:"اسألي مساعدة يومياتي عن الأقسام والمنتجات المعروضة. الإجابات من بيانات المتجر نفسه.",assistantWhere:"زر المساعدة أسفل الشاشة",searchLabel:"البحث في يومياتي",
  helpFind:["كيف أحصل منتج يناسبني؟","اضغطي علامة البحث فوق واكتبي اللي في بالك، أو تصفّحي الأقسام، أو اسألي مساعدة يومياتي من الزر تحت وهي تقترح عليك من المنتجات المتوفرة."],
  helpFamily:["أقدر أطلب لأهلي في بلد ثاني؟","نعم. كل متجر يوصّل داخل بلده: اختاري متجر البلد اللي فيه أهلك واكتبي اسم ورقم اللي بيستلم هناك. اللي يستلم هو اللي يدفع عند الاستلام."],
  helpTrack:"كيف أتابع طلبي؟",
 },
 eg:{
  sectionEyebrow:"اتفرّجي على يومياتي",sectionSearch:"دوّري في المنتجات",moreEyebrow:"حاجات ممكن تعجبك",moreTitle:"شوفي اللي يناسب يومك",moreText:"اتفرّجي على باقي أقسام يومياتي. لو بتدوّري على حاجة معينة، استخدمي البحث وشوفي تفاصيلها.",
  sectionIntro:{home:"لمسات ديكور وإضاءة ومفارش تغيّر شكل الأوضة من غير تعب.",kitchen:"أدوات القهوة والتحضير والتقديم اللي بتسهّل عليكي وتحلّي ركنك.",kids:"حاجات تساعدك في يومك مع ولادك: نوم، أكل، لعب وترتيب.",beauty:"أدوات عناية وتجميل لروتينك اليومي في البيت.",fashion:"شنط وإكسسوارات تكمّل لبسك.",wellness:"حاجات للراحة والاسترخاء بعد يوم طويل.",organize:"منظمات وحلول تخزين ترتّب الأدراج والدواليب والمطبخ."},
  questionsTitle:"قبل ما تطلبي",questionTitles:{pay:"أدفع إزاي؟",fee:"الشحن بكام؟",time:"الطلب بيوصل إمتى؟",call:"بتكلموني قبل الشحن؟",returns:"أقدر أرجّع المنتج؟"},
  seeOffers:"شوفي العروض والأطقم",seePolicies:"كل تفاصيل الدفع والشحن والاسترجاع",
  journey:"من حكايتنا",storyTitle:"حكاية يومياتي بدأت إزاي؟",storyIntro:"من حاجات بتلهم يومك لاختيارات تقدري تكتشفيها بنفسك.",difference:"إيه اللي بيميّز يومياتي؟",question:"عندك سؤال؟",
  cartTitle:"سلتك مستنية اختياراتك",checkoutTitle:"السلة مافيهاش منتجات جاهزة للطلب",orderTitle:"مش لاقيين بيانات الطلب",browseSections:"اتفرّجي على الأقسام",searchStore:"دوّري في يومياتي",browseHint:"اتفرّجي على الأقسام واختاري اللي يناسب ذوقك.",
  searchPlaceholder:"جرّبي: مطبخ، شنطة، عناية…",searchHint:"بيفهم اختلاف كتابة الكلمات وبيقترح عليكي أقسام تناسب بحثك.",searchUnreachable:"مش قادرين نوصل للمنتجات دلوقتي. اتفرّجي على الأقسام تحت.",searchFailed:"مش قادرين نحمّل المنتجات دلوقتي. جرّبي كمان شوية.",searching:"بندوّرلك في المنتجات…",searchNone:"ملقيناش منتج يطابق بحثك. جرّبي كلمة تانية أو اتفرّجي على الأقسام تحت.",sectionsMayLike:"أقسام ممكن تعجبك",sectionsByInterest:"اكتشفي حسب اهتماماتك",noSections:"مفيش قسم يطابق بحثك. جرّبي كلمة أبسط أو اختاري من الأقسام.",
  searchByName:"دوّري باسم المنتج أو القسم",refreshFailed:"مش قادرين نحدّث المنتجات دلوقتي. تقدري تتفرّجي على الأقسام أو تجرّبي تاني.",emptyTitle:"اتعرّفي على أقسام يومياتي",emptyText:"منتجات المتجر ده بتظهر هنا. اكتشفي أقسام البيت والجمال والعناية.",loadFailed:"مش قادرين نحمّل المنتجات دلوقتي",moreChoices:"اختيارات تانية من يومياتي",notInStoreTitle:"المنتج ده مبقاش متوفر",notInStoreText:"ممكن تكون الكمية خلصت أو اتشال من المتجر. شوفي اختيارات تانية تعجبك.",loadMore:"اعرضي منتجات أكتر",
  noMatchTitle:"ملقيناش منتجات مطابقة",startTitle:"من هنا تبدأ اختياراتك",tryOtherWord:"جرّبي كلمة تانية.",browseIdea:"اتفرّجي على الأقسام وشوفي الأفكار اللي تعجبك.",beautyEyebrow:"العناية بتبدأ من التفاصيل",homeEyebrow:"بيت على ذوقك",
  helpTitle:"نساعدك إزاي؟",helpIntro:"إجابات واضحة عن الدفع والشحن والاسترجاع وطريقة الطلب.",helpEyebrow:"مركز مساعدة يومياتي",shippingEyebrow:"معلومات قبل الطلب",answersEyebrow:"إجابات واضحة",answersTitle:"كل اللي محتاجة تعرفيه",
  asideTitle:"هتلاقي اللي على ذوقك",asideText:"لفّي على الأقسام أو دوّري على الحاجة اللي عايزاها من البحث.",assistantTitle:"عندك سؤال؟",assistantText:"اسألي مساعدة يومياتي عن الأقسام والمنتجات المعروضة. الإجابات من بيانات المتجر نفسه.",assistantWhere:"زرار المساعدة تحت في الشاشة",searchLabel:"البحث في يومياتي",
  helpFind:["ألاقي منتج يناسبني إزاي؟","دوسي على علامة البحث فوق واكتبي اللي في بالك، أو اتفرّجي على الأقسام، أو اسألي مساعدة يومياتي من الزرار اللي تحت وهي هتقترح عليكي من المنتجات المتوفرة."],
  helpFamily:["أقدر أطلب لأهلي في بلد تانية؟","أيوه. كل متجر بيوصّل جوه بلده: اختاري متجر البلد اللي فيها أهلك واكتبي اسم ورقم اللي هيستلم هناك. اللي هيستلم هو اللي هيدفع عند الاستلام."],
  helpTrack:"أتابع طلبي إزاي؟",
 },
 iq:{
  sectionEyebrow:"اكتشفي يومياتچ",sectionSearch:"دوّري على المنتجات",moreEyebrow:"تفاصيل على ذوقچ",moreTitle:"شوفي اللي يناسب يومچ",moreText:"لفّي على بقية أقسام يومياتي. وإذا ببالچ منتج معيّن، دوّري عليه وشوفي تفاصيله.",
  sectionIntro:{home:"لمسات ديكور وإضاءة ومفارش تغيّر جو الغرفة بدون تعب.",kitchen:"أدوات القهوة والتحضير والتقديم اللي تسهّل عليچ وتحلّي ركنچ.",kids:"أغراض تساعدچ بيومچ ويه أطفالچ: نوم، أكل، لعب وترتيب.",beauty:"أدوات عناية وتجميل لروتينچ اليومي بالبيت.",fashion:"جنط وإكسسوارات تكمّل طلّتچ.",wellness:"أشياء للراحة والاسترخاء بعد يوم طويل.",organize:"منظمات وحلول تخزين ترتّب الجرارات والكناتير والمطبخ."},
  questionsTitle:"قبل ما تطلبين",questionTitles:{pay:"شلون أدفع؟",fee:"شكد أجرة التوصيل؟",time:"يمته يوصل الطلب؟",call:"تتصلون قبل الشحن؟",returns:"أگدر أرجّع المنتج؟"},
  seeOffers:"شوفي العروض والأطقم",seePolicies:"كل تفاصيل الدفع والتوصيل والإرجاع",
  journey:"من حكايتنا",storyTitle:"شلون بدأت يومياتي؟",storyIntro:"من أفكار تلهم يومچ لاختيارات قريبة من تفاصيل حياتچ.",difference:"شنو يميّز يومياتي؟",question:"عندچ سؤال؟",
  cartTitle:"سلتچ تنتظر اختياراتچ",checkoutTitle:"السلة ما بيها منتجات جاهزة للطلب",orderTitle:"ما لگينا بيانات الطلب",browseSections:"لفّي على الأقسام",searchStore:"دوّري بيومياتي",browseHint:"لفّي على الأقسام واختاري اللي يناسب ذوقچ.",
  searchPlaceholder:"جرّبي: بيت، قهوة، عناية…",searchHint:"يفهم اختلاف كتابة الكلمات ويقترح عليچ أقسام تناسب بحثچ.",searchUnreachable:"ما گدرنا نوصل للمنتجات هسه. لفّي على الأقسام جوه.",searchFailed:"ما گدرنا نحمّل المنتجات هسه. جرّبي بعد شوية.",searching:"ندوّرلچ بالمنتجات…",searchNone:"ما لگينا منتج يطابق بحثچ. جرّبي كلمة ثانية أو لفّي على الأقسام جوه.",sectionsMayLike:"أقسام يمكن تعجبچ",sectionsByInterest:"اكتشفي حسب اهتماماتچ",noSections:"ماكو قسم يطابق بحثچ. جرّبي كلمة أبسط أو اختاري من الأقسام.",
  searchByName:"دوّري باسم المنتج أو القسم",refreshFailed:"ما گدرنا نحدّث المنتجات هسه. تگدرين تلفّين على الأقسام أو تجرّبين مرة ثانية.",emptyTitle:"تعرّفي على أقسام يومياتي",emptyText:"منتجات هذا المتجر تظهر هنا. اكتشفي أقسام البيت والجمال والعناية.",loadFailed:"ما گدرنا نحمّل المنتجات هسه",moreChoices:"اختيارات ثانية من يومياتي",notInStoreTitle:"هذا المنتج بعد ما متوفر",notInStoreText:"يمكن خلصت كميته أو انشال من المتجر. شوفي اختيارات ثانية تعجبچ.",loadMore:"عرض منتجات أكثر",
  noMatchTitle:"ما لگينا منتجات مطابقة",startTitle:"من هنا تبدأ اختياراتچ",tryOtherWord:"جرّبي كلمة ثانية.",browseIdea:"لفّي على الأقسام وشوفي الأفكار اللي تعجبچ.",beautyEyebrow:"العناية تبدأ من التفاصيل",homeEyebrow:"بيت على ذوقچ",
  helpTitle:"شلون نگدر نساعدچ؟",helpIntro:"أجوبة واضحة عن الدفع والتوصيل والإرجاع وطريقة الطلب.",helpEyebrow:"مركز مساعدة يومياتي",shippingEyebrow:"معلومات قبل الطلب",answersEyebrow:"أجوبة واضحة",answersTitle:"كل اللي تحتاجين تعرفيه",
  asideTitle:"اختيارچ صار أسهل",asideText:"لفّي على الأقسام أو دوّري على الشي اللي يناسب ذوقچ.",assistantTitle:"عندچ سؤال؟",assistantText:"اسألي مساعدة يومياتي عن الأقسام والمنتجات المعروضة. الأجوبة من بيانات المتجر نفسه.",assistantWhere:"زر المساعدة جوه الشاشة",searchLabel:"البحث بيومياتي",
  helpFind:["شلون ألگى منتج يناسبني؟","اضغطي علامة البحث فوگ واكتبي اللي ببالچ، أو لفّي على الأقسام، أو اسألي مساعدة يومياتي من الزر جوه وهي تقترح عليچ من المنتجات المتوفرة."],
  helpFamily:["أگدر أطلب لأهلي ببلد ثاني؟","إي. كل متجر يوصّل داخل بلده: اختاري متجر البلد اللي بيه أهلچ واكتبي اسم ورقم اللي راح يستلم هناك. اللي يستلم هو اللي يدفع عند الاستلام."],
  helpTrack:"شلون أتابع طلبي؟",
 },
};
export type PageCopy=typeof shared&Local&{
 /** Buyer questions shown on section pages and the help page, answered from the store's published facts. */
 buyerQuestions:readonly Pair[];helpGroups:readonly Pair[];terms:readonly Pair[];
};
export function pageCopy(market:MarketCode):PageCopy{
 const l=local[market],service=customerServiceCopy[market],q=l.questionTitles;
 const buyerQuestions:Pair[]=[[q.pay,service.payment],[q.fee,service.shipping],[q.time,service.delivery],[q.call,assistantCopy(market).callAnswer],[q.returns,service.returns]];
 return {...shared,...l,buyerQuestions,helpGroups:[...buyerQuestions,l.helpFind,l.helpFamily,[l.helpTrack,service.tracking]],terms:shared.termsGroups(market)};
}
