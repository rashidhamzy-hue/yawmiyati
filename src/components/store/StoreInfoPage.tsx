import {ShoppingAssistant} from "./ShoppingAssistant";
import {StoreFrame} from "./StoreChrome";
import type {MarketCode} from "@/lib/store/markets";
import {ChevronDown,HelpCircle,Mail,ShieldCheck,Truck,FileText,ArrowLeft} from "lucide-react";
export type InfoTopic="help"|"privacy"|"terms"|"shipping-returns";
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
export function StoreInfoPage({market,topic}:{market:MarketCode;topic:InfoTopic}){
 const page=chapters[topic];
 return <StoreFrame market={market}>
  <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12 lg:px-8">
   <nav aria-label="مسار الصفحة" className="mb-8 text-sm text-muted-foreground"><a className="hover:text-primary" href={"/"+market}>يومياتي</a><span aria-hidden="true"> / </span>{page.title}</nav>
   <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
    <aside className="self-start rounded-[2rem] bg-primary-soft p-7 sm:p-10"><span className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-primary"><HelpCircle className="h-7 w-7"/></span>
     <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">{page.title}</h1>
     <p className="mt-5 text-base leading-8 text-muted-foreground">{page.intro}</p>
     <a className="mt-8 inline-flex items-center gap-2 rounded-full border border-primary px-5 py-3 text-sm font-bold text-primary hover:bg-primary hover:text-white" href={"/"+market+"#collection"}>استكشفي المنتجات <ArrowLeft className="h-4 w-4"/></a>
    </aside>
    <section aria-label={page.title} className="space-y-3">{page.groups.map(([title,description],i)=><details key={title} className="group rounded-[1.4rem] border border-border bg-card p-5 shadow-sm" open={i===0}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-extrabold marker:hidden">{title}<ChevronDown className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180"/></summary>
      <p className="pt-4 text-sm leading-8 text-muted-foreground">{description}</p>
     </details>)}
     <div className="mt-6 rounded-[1.4rem] border bg-muted/50 p-5 text-sm leading-7 text-muted-foreground"><ShieldCheck className="mb-3 h-5 w-5 text-primary"/>هذه المعلومات تخص تجربة التصفح الحالية، ولا تحل محل سياسة بيع أو إشعار خصوصية معتمد قانونياً عند بدء التعاملات الفعلية.</div>
    </section>
   </div>
  </div>
  <ShoppingAssistant market={market} products={[]}/>
 </StoreFrame>;
}
