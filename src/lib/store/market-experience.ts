import type {MarketCode} from "./markets";
import type {ImgKey} from "./images";

/**
 * Market-specific editorial voice and visual direction.
 * This is not a supplier inventory feed or an authorization to sell.
 * Human language and asset-rights review required before public launch.
 */
export type MarketExperience={
  regionName:string;
  announcement:string;
  eyebrow:string;
  heroStart:string;
  heroAccent:string;
  heroDescription:string;
  heroImage:ImgKey;
  heroAlt:string;
  discoverCta:string;
  searchCta:string;
  discoverTitle:string;
  discoverDescription:string;
  collectionTitle:string;
  storyEyebrow:string;
  storyTitle:string;
  storyDescription:string;
  faqTitle:string;
  faqDescription:string;
  beautyTitle:string;
  homeTitle:string;
  footerDescription:string;
  categoryOrder:readonly string[];
  categoryCaptions:Readonly<Record<string,string>>;
  questions:readonly {question:string;answer:string}[];
};
const baseOrder=["home","kitchen","beauty","fashion","wellness","organize"] as const;
export const marketExperience:Record<MarketCode,MarketExperience>={
 sa:{
  regionName:"السعودية",
  announcement:"تفاصيل صغيرة… تجعل يومك أجمل",
  eyebrow:"تفاصيل صغيرة، حياة أجمل",
  heroStart:"كل يوم يستحق",heroAccent:"لمسة أجمل",
  heroDescription:"من ركن القهوة ودفء البيت، إلى العناية والجمال… اكتشفي تفاصيل تضيف لمسة حلوة ليومك.",
  heroImage:"hero",heroAlt:"ركن منزلي بألوان هادئة وإضاءة دافئة",
  discoverCta:"خذي لفة في يومياتي",searchCta:"دوّري على اللي يعجبك",
  discoverTitle:"تسوّقي على ذوقك… وبكل سهولة",
  discoverDescription:"من البيت والقهوة إلى الجمال والعناية، تصفّحي أقسام تجمع تفاصيل يومك.",
  collectionTitle:"اختيارات تناسب يومك",
  storyEyebrow:"من يومياتنا",storyTitle:"أجمل الأشياء تبدأ من التفاصيل",
  storyDescription:"قد تكون في فنجان قهوة على مهل، أو زاوية مرتبة تحبينها، أو لحظة خاصة بنفسك.",
  faqTitle:"أسئلة تتكرر كثيراً",faqDescription:"كل ما يهمك عن المنتجات والأقسام وتجربة يومياتي.",
  beautyTitle:"لحظة عناية تستاهلينها",homeTitle:"تفاصيل تعطي البيت روح",
  footerDescription:"تفاصيل البيت، الجمال والعناية… اختيارات تلهم يومك وتعبّر عن ذوقك.",
  categoryOrder:baseOrder,
  categoryCaptions:{home:"لأجواء تشبهك",kitchen:"لحظات تستحق التذوّق",beauty:"تفاصيل يومية ناعمة",fashion:"إطلالة تعبر عنك",wellness:"مساحة لنفسك",organize:"أقل فوضى، راحة أكثر"},
  questions:[
   {question:"كيف ألقى اختيارات تناسبني؟",answer:"استخدمي البحث أو تصفّحي الأقسام، وشوفي تفاصيل كل منتج في صفحته."},
   {question:"وين تفاصيل الشحن؟",answer:"تلقين رسوم ومواعيد التوصيل والاسترجاع في صفحة الشحن والدفع."},
  ],
 },
 ae:{
  regionName:"الإمارات",
  announcement:"تفاصيل أنيقة… على ذوقج",
  eyebrow:"يومياتي الإمارات | على ذوقج",
  heroStart:"تفاصيل تليق بذوقج",heroAccent:"وتحلّي يومج",
  heroDescription:"من لمسات البيت المرتّبة إلى الجمال والإكسسوارات… اكتشفي أفكار تخلّي كل زاوية وكل طلعة ألطف.",
  heroImage:"cat-home",heroAlt:"تفاصيل ديكور منزلي عصرية دافئة",
  discoverCta:"تصفّحي الأقسام",searchCta:"شو ودّج تلاقين؟",
  discoverTitle:"اختيارات تناسب ستايلج",
  discoverDescription:"بيت، عناية، أزياء وقهوة… لفة سريعة بين الأقسام اللي تهمّج.",
  collectionTitle:"تفاصيل على ذوقج",
  storyEyebrow:"في يومياتي الإمارات",storyTitle:"الأناقة في التفاصيل الصغيرة",
  storyDescription:"بيت مرتب، عناية تحبينها، ولمسات تكمل طلتج اليومية.",
  faqTitle:"أسئلة على بالج",faqDescription:"إجابات مختصرة عن التصفّح والطلبات في الإمارات.",
  beautyTitle:"روتين عناية على كيفج",homeTitle:"لمسة تغيّر جوّ البيت",
  footerDescription:"من البيت إلى الجمال… أفكار وتفاصيل تلهم يومج في الإمارات.",
  categoryOrder:["fashion","beauty","home","kitchen","organize","wellness"],
  categoryCaptions:{home:"لمسات تكمّل بيتج",kitchen:"وقت القهوة غير",beauty:"عناية تستاهلينها",fashion:"ستايل يعكس شخصيتج",wellness:"لحظة راحة لج",organize:"ترتيب على أصوله"},
  questions:[
   {question:"شلون ألاقي اللي على ذوقي؟",answer:"اكتبي اسم المنتج في البحث أو تصفّحي الأقسام الإماراتية والاختيارات المعروضة."},
   {question:"هل نفس المنتجات موجودة في كل بلد؟",answer:"لكل متجر منتجات وأسعار بعملته المحلية، والاختيارات تختلف من بلد للثاني."},
   {question:"كيف أعرف تفاصيل المنتج؟",answer:"افتحي صفحة المنتج عشان تشوفين المواصفات والصور والسعر المعتمد."},
   {question:"وين ألقى تفاصيل الطلب؟",answer:"راجعي صفحة الدفع والتوصيل والاسترجاع لمعرفة الشحن وخيارات المتابعة."},
  ],
 },
 om:{
  regionName:"عُمان",
  announcement:"لمسات بسيطة… لأيام أجمل",
  eyebrow:"يومياتي عُمان | تفاصيل قريبة من يومك",
  heroStart:"للبيت تفاصيله",heroAccent:"ولليوم نكهته",
  heroDescription:"من فنجان القهوة وجمعة الأهل إلى تفاصيل البيت والعناية… اكتشفي أفكار هادئة تضيف جمالاً ليومك.",
  heroImage:"cat-kitchen",heroAlt:"ركن قهوة ومطبخ منزلي دافئ",
  discoverCta:"استكشفي الأقسام",searchCta:"وش في بالك اليوم؟",
  discoverTitle:"من القهوة إلى تفاصيل البيت",
  discoverDescription:"أقسام مختارة للإلهام والاكتشاف، بمعلومات معتمدة لما تتوفر المنتجات.",
  collectionTitle:"أفكار لليوم الجميل",
  storyEyebrow:"من يوميات عُمان",storyTitle:"دفء التفاصيل يجمعنا",
  storyDescription:"جلسة قهوة هادئة، بيت مرتّب، ومساحة من الراحة وسط اليوم.",
  faqTitle:"إجابات تهمّك",faqDescription:"عن تجربة يومياتي في سلطنة عُمان.",
  beautyTitle:"عناية ببساطة",homeTitle:"بيتك بروح مختلفة",
  footerDescription:"القهوة والبيت والعناية… تفاصيل لطيفة قريبة من أسلوب حياتك في عُمان.",
  categoryOrder:["kitchen","home","wellness","organize","beauty","fashion"],
  categoryCaptions:{home:"دفء البيت",kitchen:"وقت القهوة والجلسة",beauty:"لحظات عناية",fashion:"بساطة وأسلوب",wellness:"وقت لك",organize:"مساحات مرتبة"},
  questions:[
   {question:"كيف أختار القسم المناسب؟",answer:"تصفّحي الأقسام أو استخدمي البحث داخل الصفحة للعثور على ما يناسبك."},
   {question:"كيف أعرف مواصفات المنتج؟",answer:"تظهر التفاصيل والأسعار المعتمدة في صفحة المنتج."},
   {question:"هل الأسعار بالريال العُماني؟",answer:"نعم، المتجر العُماني يعرض الأسعار بعملته المحلية."},
   {question:"وين تفاصيل التوصيل؟",answer:"راجعي صفحة الدفع والتوصيل والاسترجاع لمعرفة رسوم الشحن وشروط الخدمة."},
  ],
 },
 eg:{
  regionName:"مصر",
  announcement:"حاجات بسيطة… تفرّح يومك",
  eyebrow:"يومياتي مصر | خدي لفة على ذوقك",
  heroStart:"كل يوم فيه حاجة",heroAccent:"تفرّح قلبك",
  heroDescription:"من ركن البيت اللي بتحبيه للعناية والجمال والحاجات العملية… دوري على أفكار تخلّي يومك أريح وأحلى.",
  heroImage:"cat-fashion",heroAlt:"أزياء وإكسسوارات في مشهد تحريري أنيق",
  discoverCta:"اتفرّجي على الأقسام",searchCta:"بتدوّري على إيه؟",
  discoverTitle:"حاجات حلوة على مزاجك",
  discoverDescription:"لفّة واحدة بين البيت والمطبخ والجمال والتنظيم… اختاري اللي يناسب يومك.",
  collectionTitle:"حاجات ممكن تعجبك",
  storyEyebrow:"من يومياتنا في مصر",storyTitle:"التفاصيل الصغيرة بتعمل فرق",
  storyDescription:"حاجة لذيذة في المطبخ، زاوية بيت أشيك، ووقت لنفسك وسط الزحمة.",
  faqTitle:"أسئلة بتتكرر",faqDescription:"الإجابات اللي تحتاجيها قبل ما تختاري.",
  beautyTitle:"دلّعي نفسك شوية",homeTitle:"خلي بيتك أريح وأحلى",
  footerDescription:"أفكار للبيت والجمال والحياة اليومية… اختيارات على ذوقك في مصر.",
  categoryOrder:["home","organize","beauty","kitchen","fashion","wellness"],
  categoryCaptions:{home:"خلّي البيت أشيك",kitchen:"حاجات للمطبخ والقهوة",beauty:"دلّعي نفسك",fashion:"لمسة تكمل اللوك",wellness:"شوية راحة",organize:"ترتيب أسهل"},
  questions:[
   {question:"ألاقي الحاجة اللي بدور عليها إزاي؟",answer:"اكتبي اسم المنتج في البحث أو لفي على الأقسام وشوفي اختيارات كل قسم."},
   {question:"السعر بالجنيه المصري؟",answer:"أيوه، الأسعار المعروضة في متجر مصر بالجنيه المصري."},
   {question:"هل كل المنتجات موجودة في كل بلد؟",answer:"كل بلد ليه اختياراته وأسعاره الخاصة."},
   {question:"أتابع تفاصيل الشحن فين؟",answer:"هتلاقي المعلومات في صفحة الدفع والشحن والاسترجاع، والمصاريف بتتحدد حسب المحافظة."},
  ],
 },
 iq:{
  regionName:"العراق",
  announcement:"تفاصيل تحلّي يومچ",
  eyebrow:"يومياتي العراق | كلشي على ذوقچ",
  heroStart:"كل يوم يصير أحلى",heroAccent:"بتفاصيل على ذوقچ",
  heroDescription:"للبيت، للمطبخ، ولحظات العناية… لفي على أقسام يومياتي واختاري الأفكار اللي تناسب حياتچ.",
  heroImage:"cat-organize",heroAlt:"تفاصيل تنظيم وديكور منزلي أنيق",
  discoverCta:"تصفّحي الأقسام",searchCta:"شنو ببالچ اليوم؟",
  discoverTitle:"أفكار وأشياء على ذوقچ",
  discoverDescription:"من البيت والقهوة للتنظيم والعناية، شوفي الأقسام واختاري اللي يعجبچ.",
  collectionTitle:"اختيارات تلائم يومچ",
  storyEyebrow:"من يومياتنا بالعراق",storyTitle:"البيت الحلو بتفاصيله",
  storyDescription:"لمسة جديدة للبيت، وقت للقهوة، وشوية عناية بنفسچ.",
  faqTitle:"أسئلة ممكن تخطر ببالچ",faqDescription:"معلومات عن التصفّح والدفع والتوصيل بالعراق.",
  beautyTitle:"عناية تستاهليها",homeTitle:"خلي البيت أدفى",
  footerDescription:"البيت والمطبخ والجمال… أفكار يومية تلائم ذوقچ بالعراق.",
  categoryOrder:["home","kitchen","organize","beauty","wellness","fashion"],
  categoryCaptions:{home:"لمسة بيت حلوة",kitchen:"للقهوة واللمة",beauty:"وقت عناية إلچ",fashion:"تفاصيل تكمل الطلة",wellness:"وقت ترتاحين بيه",organize:"بيت مرتب أكثر"},
  questions:[
   {question:"شلون أدوّر على اللي أريده؟",answer:"اكتبي اسم المنتج بالبحث أو تصفّحي الأقسام اللي تعجبچ."},
   {question:"الأسعار بالدينار العراقي؟",answer:"إي، متجر العراق يعرض الأسعار بالدينار العراقي."},
   {question:"هل المنتجات تختلف حسب البلد؟",answer:"إي، كل متجر إله منتجات وأسعار خاصة بيه."},
   {question:"وين أشوف تفاصيل التوصيل؟",answer:"شوفي صفحة الدفع والتوصيل والاسترجاع حتى تعرفين الرسوم وخطوات المتابعة."},
  ],
 },
};
