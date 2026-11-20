import {ShoppingAssistant} from "./ShoppingAssistant";
import {StoreFrame} from "./StoreChrome";
import type {MarketCode} from "@/lib/store/markets";
import {ChevronDown,HelpCircle,ShieldCheck,Truck,FileText,ArrowLeft,Search,LockKeyhole,MessageCircle} from "lucide-react";
import {img} from "@/lib/store/images";
import {saudiShippingPage} from "@/lib/store/saudi-commerce-content";
import {marketPolicyPages} from "@/lib/store/market-policy-pages";
import {marketExperience} from "@/lib/store/market-experience";
export type InfoTopic="help"|"privacy"|"terms"|"shipping-returns";
const visuals:Record<InfoTopic,{hero:string;alt:string;accent:string;secondary:string;eyebrow:string}>={
 help:{hero:img["cat-kitchen"],alt:"ركن للقهوة بتفاصيل دافئة",accent:img["cat-home"],secondary:img["cat-beauty"],eyebrow:"مركز مساعدة يومياتي"},
 privacy:{hero:img["cat-home"],alt:"تفاصيل منزلية طبيعية وهادئة",accent:img["cat-wellness"],secondary:img["cat-organize"],eyebrow:"معلوماتك تهمنا"},
 terms:{hero:img["cat-organize"],alt:"ركن منزلي منظم",accent:img["cat-home"],secondary:img["cat-fashion"],eyebrow:"تفاصيل الاستخدام"},
 "shipping-returns":{hero:img["cat-fashion"],alt:"اختيارات أزياء وإكسسوارات",accent:img["cat-kitchen"],secondary:img["cat-organize"],eyebrow:"معلومات قبل الطلب"},
};
const chapters={
 help:{title:"كيف نقدر نساعدك؟",intro:"إجابات واضحة تساعدك على استكشاف يومياتي والبحث عن المنتجات المناسبة.",groups:[
  ["كيف أبحث عن منتج؟","استخدمي زر البحث في أعلى الصفحة أو تصفّحي الأقسام. تظهر المنتجات الفعلية فقط عندما تتوافر بياناتها المعتمدة."],
  ["هل تختلف المنتجات بين الدول؟","نعم. يعرض كل متجر بيانات البلد والعملة الخاصة به. لا تنقلي سعر منتج من بلد إلى بلد باعتباره عرضاً مؤكداً."],
  ["هل المساعد يستطيع إتمام طلبي؟","المساعد مخصص للإرشاد واستكشاف المعلومات المعروضة. لا يستقبل طلبات أو بيانات دفع، ولا يؤكد توافر منتج غير ظاهر في الكتالوج."],
  ["كيف أعرف سياسة الطلب؟","تحققي من معلومات المنتج والدفع والتوصيل المعتمدة لبلدك قبل أي طلب. لا نعرض رسوماً أو مواعيد توصيل تخمينية."],
 ]},
 privacy:{title:"الخصوصية والبيانات",intro:"نوضح هنا طريقة عمل واجهة يومياتي والحدود الحالية لتبادل المعلومات.",groups:[
  ["البيانات التي تدخلينها","لا تطلبي أو ترسلي معلومات دفع أو أرقام هوية أو عناوين خاصة عبر مساعد التسوق. حقول البحث والأسئلة تُستخدم لتقديم الإجابة."],
  ["مساعد التسوق","يمكن للمساعد المحلي الرد على أسئلة عامة دون حساب. إذا فُعّل مزود الذكاء الاصطناعي لاحقاً، فقد تُرسل أسئلتك إلى الخادم والمزود لمعالجتها. يجب إعلان إشعار خصوصية كامل قبل تفعيل ذلك."],
  ["الحسابات والطلبات","أي معالجة مستقبلية لحسابات العملاء والطلبات تتطلب سياسة خصوصية نهائية معتمدة تصف الأساس القانوني، الاحتفاظ والحقوق ووسائل التواصل."],
  ["الروابط الخارجية","قد تؤدي بعض الروابط إلى خدمات منفصلة تخضع لسياسات الجهة المشغلة لها."],
 ]},
 terms:{title:"شروط استخدام الموقع",intro:"معلومات أساسية حول تصفح يومياتي واستخدام محتوى المتجر.",groups:[
  ["المحتوى والمعلومات","المحتوى التعريفي والصور التحريرية للإلهام؛ لا تشكل وصفاً معتمداً لمنتج معروض للبيع. الأسعار والتوافر لا يعتد بهما إلا في صفحات المنتجات المعتمدة."],
  ["خدمة المساعد","المساعد يقدم معلومات إرشادية فقط، ولا ينشئ عقد شراء، ولا يضمن نتيجة أو سعرًا أو توافراً."],
  ["الطلبات والمدفوعات","لا يمكن إتمام عملية شراء من واجهة الموقع حالياً. أي شروط بيع مُلزمة يجب أن تُعرض وتُقبل أثناء عملية شراء مفعلة رسمياً."],
  ["حدود المعلومات","قد تتغير بيانات المنتجات ومواصفات الموردين؛ ينبغي تأكيد تفاصيل الطلب قبل اعتماده."],
 ]},
 "shipping-returns":{title:"الدفع والتوصيل والاسترجاع",intro:"كل بلد له متطلبات تشغيل مختلفة. نتجنب تقديم وعود لا تدعمها اتفاقيات فعلية.",groups:[
  ["رسوم ومدد التوصيل","لا توجد حالياً رسوم أو مدد شحن مؤكدة معروضة للطلبات. لا ينبغي اعتبار أي تقدير أو نص تعريفي وعداً بالتوصيل."],
  ["طرق الدفع","يُعرض خيار الدفع فقط بعد تفعيل وسيلة مؤكدة للبلد والمنتج. لا يطلب المساعد أي معلومات مالية."],
  ["الإرجاع والاستبدال","تعتمد أهلية الاسترجاع والمدة وتكاليفه على نوع المنتج والبلد والحقوق النظامية ذات الصلة؛ يجب إظهار الشروط النهائية قبل قبول طلب فعلي."],
  ["حالة الطلب","لا يعرض الموقع تأكيداً لطلب لم يُسجّل أو لم يتم التحقق منه. لا يُنشأ طلب من محادثة المساعد."],
 ]},
} as const;
const saudiInfo={
 help:{title:"كيف نقدر نساعدك؟",intro:"كل اللي تحتاجينه لتسوّق أوضح وأسهل، من اختيار المنتج إلى الشحن والدفع عند الاستلام.",groups:[
  ["كيف أبحث عن منتج؟","اضغطي علامة البحث أو تصفّحي الأقسام. تظهر الأسعار وتفاصيل المنتجات اللي لها بيانات معتمدة في المتجر السعودي."],
  ["كيف أدفع؟","الدفع نقداً عند الاستلام فقط، بدون بطاقات أو دفع مسبق. رسوم الشحن ٢٨ ر.س لجميع مناطق المملكة."],
  ["متى يوصل طلبي؟","الرياض وجدة والدمام ٢–٣ أيام، وبقية المناطق ٤–٥ أيام بعد تأكيد الطلب، وهي مدد تقديرية."],
  ["كيف أتابع أو أرجع الطلب؟","احتفظي برقم طلبك للمتابعة. صفحة الشحن والاسترجاع توضّح الخطوات ومدد التوصيل وحقوقك النظامية."],
 ]},
 terms:{title:"شروط استخدام الموقع",intro:"تعرّفي على طريقة التسوق واستخدام المحتوى والمعلومات في يومياتي.",groups:[
  ["معلومات المنتجات","الصور التحريرية للإلهام، ومعلومات كل منتج تُعرض في صفحته بعد التحقق من بياناته. يرجى مراجعة المواصفات قبل تأكيد الطلب."],
  ["الأسعار والدفع","السعر النهائي يشمل رسوم الشحن المعروضة قبل تأكيد الطلب. الدفع نقداً عند الاستلام فقط."],
  ["الطلبات والتأكيد","إرسال بيانات الطلب لا يعني قبوله تلقائياً؛ يعتمد تأكيد الطلب على التحقق من البيانات وتوافر المنتج."],
  ["الشحن والاسترجاع","تُطبّق تفاصيل الشحن والاسترجاع المنشورة لبلد الطلب، مع الحفاظ على الحقوق النظامية للمستهلك."],
 ]},
 privacy:{title:"الخصوصية والبيانات",intro:"خصوصيتك تهمنا. هذه معلومات عن البيانات المستخدمة أثناء التصفح والمساعدة.",groups:[
  ["البحث والمساعدة","استخدمي البحث والمساعد للأسئلة المتعلقة بالمنتجات. لا تشاركي كلمات المرور أو بيانات البطاقات في المحادثة."],
  ["معلومات الطلب","البيانات المطلوبة لمعالجة طلب الشراء، مثل الاسم ورقم التواصل والعنوان، يجب أن تُستخدم لخدمة الطلب والتوصيل وفق إشعار الخصوصية المعتمد."],
  ["حماية بياناتك","لا نطلب معلومات بطاقات الدفع لأن طريقة الدفع لدينا هي النقد عند الاستلام."],
  ["روابط الخدمات","قد تؤدي بعض الروابط إلى خدمات خارجية لها شروط خصوصية مستقلة."],
 ]},
} as const;
export function StoreInfoPage({market,topic}:{market:MarketCode;topic:InfoTopic}){
 const page=market==="sa"?(topic==="shipping-returns"?saudiShippingPage:saudiInfo[topic]):(topic==="shipping-returns"?marketPolicyPages[market]:chapters[topic]);
 const v=visuals[topic];
 const heroPhoto=topic==="shipping-returns"&&market!=="sa"?img[marketExperience[market].heroImage]:v.hero;
 return <StoreFrame market={market}>
  <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
   <nav aria-label="مسار الصفحة" className="mb-5 text-sm text-muted-foreground"><a className="hover:text-primary" href={"/"+market}>يومياتي</a><span aria-hidden="true"> / </span>{page.title}</nav>
   <section className="relative isolate flex min-h-[285px] items-center overflow-hidden rounded-[2rem] bg-foreground sm:min-h-[350px]">
    <img src={heroPhoto} alt={v.alt} className="absolute inset-0 h-full w-full object-cover" fetchPriority="high"/>
    <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/50 to-black/20"/>
    <div className="relative max-w-2xl px-7 py-12 text-white sm:px-12">
     <p className="text-sm font-bold text-[#f5dab1]">{v.eyebrow}</p>
     <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight sm:text-5xl">{page.title}</h1>
     <p className="mt-4 text-sm leading-8 text-white/90 sm:text-base">{page.intro}</p>
    </div>
   </section>
   <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_1.65fr] lg:gap-9">
    <aside className="self-start space-y-5">
     <div className="overflow-hidden rounded-[1.5rem] border bg-card">
      <img src={v.accent} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover"/>
      <div className="space-y-3 p-5">
       <h2 className="font-display text-xl font-extrabold">خلّينا نسهّل عليك الاختيار</h2>
       <p className="text-sm leading-7 text-muted-foreground">ابدئي باستكشاف الأقسام، أو استخدمي البحث للوصول إلى المنتج اللي يناسبك.</p>
       <button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={()=>document.dispatchEvent(new CustomEvent("yawmiyati:open-search"))}><Search className="h-4 w-4"/> البحث في يومياتي <ArrowLeft className="h-4 w-4"/></button>
      </div>
     </div>
     <div className="relative overflow-hidden rounded-[1.5rem] bg-primary-soft p-5">
      <img src={v.secondary} alt="" loading="lazy" className="mb-4 aspect-[2.5/1] w-full rounded-xl object-cover"/>
      <h2 className="font-display text-lg font-extrabold">مساعدة تناسب سؤالك</h2>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">اسألي مساعد يومياتي عن الأقسام والمنتجات المعروضة. الإجابات تعتمد على البيانات المتاحة.</p>
      <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-primary"><MessageCircle className="h-4 w-4"/> زر المساعد أسفل الشاشة</p>
     </div>
    </aside>
    <div>
     <div className="rounded-[1.75rem] border bg-card p-5 shadow-soft sm:p-8">
      <div className="mb-7 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary"><HelpCircle className="h-6 w-6"/></div><div><p className="text-xs font-bold text-primary">إجابات واضحة</p><h2 className="font-display text-xl font-extrabold">كل ما تحتاجين معرفته</h2></div></div>
      <div className="space-y-3">{page.groups.map(([title,description],i)=><details key={title} className="group rounded-[1.25rem] border border-border bg-background px-5 py-4" open={i===0}>
       <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 text-sm font-extrabold marker:hidden sm:text-base">{title}<ChevronDown className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180"/></summary>
       <p className="pb-2 pt-3 text-sm leading-8 text-muted-foreground">{description}</p>
      </details>)}</div>
     </div>
     <div className="mt-5 rounded-[1.5rem] border bg-muted/40 p-5 text-sm leading-7 text-muted-foreground">
      <ShieldCheck className="mb-2 h-5 w-5 text-primary"/>
      {market==="sa"?"للشحن والاسترجاع شروط خاصة بكل حالة ومنتج، ولا يؤثر أي بند على الحقوق النظامية للمستهلك. يُرجى مراجعة تفاصيل الطلب قبل تأكيده.":topic==="privacy"||topic==="terms"?"هذه معلومات توضيحية عن النسخة الحالية. تعتمد سياسة البيع والخصوصية النهائية على المتطلبات القانونية لبلدك ويجب اعتمادها قبل تفعيل المعاملات.":"تختلف شروط التوصيل والاسترجاع باختلاف البلد والمنتج. حقوق المستهلك النظامية محفوظة، ويمكن مراجعة تفاصيل الخدمة في هذه الصفحة."}
     </div>
     <div className="mt-8 flex flex-wrap gap-3 text-sm">{([{label:"مركز المساعدة",id:"help"},{label:"الدفع والتوصيل",id:"shipping-returns"},{label:"الخصوصية",id:"privacy"},{label:"الشروط",id:"terms"}] as const).filter(x=>x.id!==topic).map(x=><a key={x.id} href={"/"+market+"/info/"+x.id} className="inline-flex min-h-11 items-center rounded-full border bg-card px-4 font-bold text-primary hover:bg-primary-soft">{x.label}</a>)}</div>
    </div>
   </div>
  </div>
  <ShoppingAssistant market={market} products={[]}/>
 </StoreFrame>;
}
