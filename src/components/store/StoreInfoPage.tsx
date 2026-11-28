import {customerServiceCopy} from "@/lib/store/customer-service-copy";
import {paymentAnswer} from "../../../supabase/functions/_shared/payment-policy";
import {ShoppingAssistant} from "./ShoppingAssistantDeferred";
import {StoreFrame} from "./StoreChrome";
import type {MarketCode} from "@/lib/store/markets";
import {ChevronDown,HelpCircle,ShieldCheck,Truck,FileText,ArrowLeft,Search,LockKeyhole,MessageCircle} from "lucide-react";
import {img} from "@/lib/store/images";
import {editorialSrcSet} from "@/lib/store/editorial-srcset";
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
 help:{title:"كيف نقدر نساعدك؟",intro:"إجابات تساعدك تختارين وتتعرفين على تفاصيل التسوق في يومياتي.",groups:[
  ["كيف أدفع؟",paymentAnswer],
  ["كيف أبحث عن منتج؟","استخدمي زر البحث أعلى الصفحة أو تصفّحي الأقسام. كل منتج معروض له صفحة تحتوي على تفاصيله المتاحة."],
  ["هل تختلف المنتجات بين الدول؟","نعم. كل متجر يعرض المنتجات والأسعار بعملة بلده، ومعلومات منتج في بلد لا تعني توافره في بلد آخر."],
  ["هل المساعد يستطيع إتمام طلبي؟","المساعد يساعد في اختيار الأقسام والاطلاع على المعلومات المتاحة؛ لا ينشئ طلبات ولا يجمع بيانات الدفع."],
  ["أين أجد تفاصيل التوصيل والاسترجاع؟","اختاري بلد التسوق، ثم افتحي صفحة الدفع والتوصيل والاسترجاع من قائمة معلومات المتجر."]
 ]},
 privacy:{title:"الخصوصية والبيانات",intro:"معلومات واضحة تساعدك تحافظين على خصوصيتك أثناء استخدام يومياتي.",groups:[
  ["المعلومات التي تشاركينها","استخدمي البحث والمساعد للاستفسارات عن المنتجات. لا تشاركي كلمات المرور أو أرقام الهوية أو معلومات بطاقات الدفع في المحادثة."],
  ["البحث والمساعد","تُستخدم الأسئلة للرد على استفساراتك. قد تختلف معالجة المحادثة حسب طريقة تشغيل المساعد، ويجب توضيح أي استخدام لطرف خارجي في إشعار الخصوصية الخاص بالخدمة."],
  ["بيانات الطلب","ترتبط بيانات المستلم والعنوان بمعالجة الطلبات المقبولة واحتياجات التوصيل. لا يطلب مساعد التسوق هذه البيانات."],
  ["روابط الجهات الأخرى","بعض الروابط تنقلك إلى خدمات خارجية ذات سياسات مستقلة."]
 ]},
 terms:{title:"شروط استخدام الموقع",intro:"معلومات مهمة عن التصفح والمنتجات وطرق الطلب في يومياتي.",groups:[
  ["معلومات المنتجات","صور المحتوى التحريري للتعريف بالأقسام. راجعي صور المنتج ومواصفاته وسعره في صفحته قبل تقديم طلب."],
  ["خدمة المساعد","المساعد يقدم معلومات عن الأقسام والمنتجات؛ ولا يقدّم تأكيداً لطلب أو سعراً خاصاً خارج بيانات المتجر."],
  ["الأسعار وطرق الدفع",paymentAnswer+" راجعي إجمالي الطلب ورسوم التوصيل قبل التأكيد."],
  ["دقة المعلومات","قد تتغير تفاصيل المنتجات. المرجع هو وصف المنتج وبيانات الطلب المعروضة عند المراجعة."]
 ]},
 "shipping-returns":{title:"الدفع والتوصيل والاسترجاع",intro:"تفاصيل الدفع والتوصيل وحقوق الاسترجاع حسب بلد التسوق.",groups:[
  ["رسوم التوصيل","راجعي رسوم التوصيل في صفحة الشحن الخاصة ببلدك."],
  ["طريقة الدفع",paymentAnswer],
  ["الاسترجاع والاستبدال","يخضع طلب الإرجاع أو الاستبدال لحالة المنتج وحقوق المستهلك والأنظمة ذات الصلة."],
  ["متابعة الطلب","تستند حالة الطلب إلى رقم طلب مسجّل وصحيح، ولا يُنشئ المساعد طلباً من المحادثة."]
 ]},
} as const;
const saudiInfo={
 help:{title:"كيف نقدر نساعدك؟",intro:"كل ما تحتاجينه لاختيار المنتج والتعرّف على تفاصيل التسوق.",groups:[
  ["كيف أدفع؟",paymentAnswer],
  ["كيف أبحث عن منتج؟","اضغطي علامة البحث أو تصفّحي الأقسام. تظهر مواصفات وأسعار المنتجات التي لها بيانات معتمدة."],
  ["أين أجد تفاصيل رسوم التوصيل؟",customerServiceCopy.sa.shipping],
  ["كيف أعرف وقت التوصيل؟",customerServiceCopy.sa.delivery],
  ["كيف أتابع أو أرجع الطلب؟","راجعي رقم الطلب وبياناته للتتبّع، واطلعي على حقوق الإرجاع والاستبدال المرتبطة بالمنتج."]
 ]},
 terms:{title:"شروط استخدام الموقع",intro:"تفاصيل التصفح والمنتجات والطلبات في يومياتي.",groups:[
  ["معلومات المنتجات","الصور التحريرية للتعريف بالأقسام. معلومات المنتجات المعتمدة تظهر في صفحاتها، مع المواصفات والأسعار."],
  ["الأسعار والدفع",paymentAnswer+" "+customerServiceCopy.sa.shipping],
  ["الطلبات والتأكيد","راجعي الكميات والعنوان ورقم التواصل وإجمالي الطلب عند إرسال بياناته."],
  ["الاسترجاع","يخضع الإرجاع والاستبدال لشروط المنتج وحقوقك النظامية. لا تستثني معلومات الموقع الحقوق المقررة للمستهلك."]
 ]},
 privacy:{title:"الخصوصية والبيانات",intro:"معلومات عن حماية بياناتك أثناء البحث وطلب المساعدة.",groups:[
  ["البحث والمساعد","استخدمي البحث والمساعد للأسئلة المتعلقة بالمنتجات، وتجنّبي مشاركة بيانات الدفع أو كلمات المرور."],
  ["معلومات التوصيل","تُستخدم بيانات المستلم والعنوان عند معالجة الطلبات المقبولة والتوصيل. لا يجمع المساعد هذه التفاصيل."],
  ["حماية بياناتك","لا تشاركي بيانات البطاقات أو أرقام الهوية في البحث أو محادثات المساعد."],
  ["روابط الخدمات","تخضع المواقع الخارجية لسياسات الخصوصية الخاصة بها."]
 ]},
} as const;
const localHelpText:Record<MarketCode,{asideTitle:string;asideDescription:string;assistantTitle:string;assistantDescription:string;searchLabel:string;answerHeading:string}>={
 sa:{asideTitle:"خلّينا نسهّل عليك الاختيار",asideDescription:"ابدئي باستكشاف الأقسام، أو استخدمي البحث للوصول إلى المنتج اللي يناسبك.",assistantTitle:"مساعدة تناسب سؤالك",assistantDescription:"اسألي مساعد يومياتي عن الأقسام والمنتجات المعروضة. الإجابات تعتمد على البيانات المتاحة.",searchLabel:"البحث في يومياتي",answerHeading:"كل ما تحتاجين معرفته"},
 ae:{asideTitle:"اختياراتك أسهل مع يومياتي",asideDescription:"تصفّحي الأقسام أو دوّري على المنتج اللي يناسب ذوقج.",assistantTitle:"عندج سؤال؟",assistantDescription:"اسألي مساعد يومياتي عن الأقسام والمنتجات المعروضة. الإجابات من المعلومات المتاحة.",searchLabel:"ابحثي في يومياتي",answerHeading:"إجابات تفيدج"},
 om:{asideTitle:"اختاري براحة",asideDescription:"استكشفي الأقسام أو استخدمي البحث للوصول إلى المنتج المناسب لك.",assistantTitle:"مساعدة تناسب سؤالك",assistantDescription:"اسألي مساعد يومياتي عن الأقسام والمنتجات المعروضة، بحسب المعلومات المتاحة.",searchLabel:"البحث في يومياتي",answerHeading:"إجابات تهمّك"},
 eg:{asideTitle:"هتلاقي اللي على ذوقك",asideDescription:"لفّي على الأقسام أو دوري على الحاجة اللي بتدوري عليها من البحث.",assistantTitle:"عندك سؤال؟",assistantDescription:"اسألي مساعد يومياتي عن الأقسام والحاجات المعروضة. الردود حسب المعلومات المتاحة.",searchLabel:"دوري في يومياتي",answerHeading:"كل اللي محتاجة تعرفيه"},
 iq:{asideTitle:"اختيارچ صار أسهل",asideDescription:"لفّي على الأقسام أو دوّري على الشي اللي يناسب ذوقچ.",assistantTitle:"عندچ سؤال؟",assistantDescription:"اسألي مساعد يومياتي عن الأقسام والمنتجات المعروضة. الأجوبة حسب المعلومات المتاحة.",searchLabel:"دوّري بيومياتي",answerHeading:"أجوبة تهمچ"},
};
export function StoreInfoPage({market,topic}:{market:MarketCode;topic:InfoTopic}){
 const page=market==="sa"?(topic==="shipping-returns"?saudiShippingPage:saudiInfo[topic]):(topic==="shipping-returns"?marketPolicyPages[market]:chapters[topic]);
 const v=visuals[topic],helpCopy=localHelpText[market];
 const heroPhoto=topic==="shipping-returns"&&market!=="sa"?img[marketExperience[market].heroImage]:v.hero;
 return <StoreFrame market={market}>
  <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
   <nav aria-label="مسار الصفحة" className="mb-5 text-sm text-muted-foreground"><a className="hover:text-primary" href={"/"+market}>يومياتي</a><span aria-hidden="true"> / </span>{page.title}</nav>
   <section className="relative isolate flex min-h-[285px] items-center overflow-hidden rounded-[2rem] bg-foreground sm:min-h-[350px]">
    <img src={heroPhoto} srcSet={editorialSrcSet(heroPhoto)} sizes="100vw" alt={v.alt} className="absolute inset-0 h-full w-full object-cover" fetchPriority="high"/>
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
      <img src={v.accent} srcSet={editorialSrcSet(v.accent)} sizes="(max-width: 1024px) 100vw, 30vw" alt="" loading="lazy" className="aspect-[16/9] w-full object-cover"/>
      <div className="space-y-3 p-5">
       <h2 className="font-display text-xl font-extrabold">{helpCopy.asideTitle}</h2>
       <p className="text-sm leading-7 text-muted-foreground">{helpCopy.asideDescription}</p>
       <button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={()=>document.dispatchEvent(new CustomEvent("yawmiyati:open-search"))}><Search className="h-4 w-4"/> {helpCopy.searchLabel} <ArrowLeft className="h-4 w-4"/></button>
      </div>
     </div>
     <div className="relative overflow-hidden rounded-[1.5rem] bg-primary-soft p-5">
      <img src={v.secondary} srcSet={editorialSrcSet(v.secondary)} sizes="(max-width: 1024px) 100vw, 30vw" alt="" loading="lazy" className="mb-4 aspect-[2.5/1] w-full rounded-xl object-cover"/>
      <h2 className="font-display text-lg font-extrabold">{helpCopy.assistantTitle}</h2>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{helpCopy.assistantDescription}</p>
      <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-primary"><MessageCircle className="h-4 w-4"/> زر المساعد أسفل الشاشة</p>
     </div>
    </aside>
    <div>
     <div className="rounded-[1.75rem] border bg-card p-5 shadow-soft sm:p-8">
      <div className="mb-7 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary"><HelpCircle className="h-6 w-6"/></div><div><p className="text-xs font-bold text-primary">إجابات واضحة</p><h2 className="font-display text-xl font-extrabold">{helpCopy.answerHeading}</h2></div></div>
      <div className="space-y-3">{page.groups.map(([title,description],i)=><details key={title} className="group rounded-[1.25rem] border border-border bg-background px-5 py-4" open={i===0}>
       <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 text-sm font-extrabold marker:hidden sm:text-base">{title}<ChevronDown className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180"/></summary>
       <p className="pb-2 pt-3 text-sm leading-8 text-muted-foreground">{description}</p>
      </details>)}</div>
     </div>
     <div className="mt-5 rounded-[1.5rem] border bg-muted/40 p-5 text-sm leading-7 text-muted-foreground">
      <ShieldCheck className="mb-2 h-5 w-5 text-primary"/>
      {topic==="privacy"?"لا تشاركي أي معلومات حساسة في البحث أو محادثة المساعد.":topic==="terms"?"راجعي وصف كل منتج ومعلوماته قبل تقديم الطلب، مع الاحتفاظ بحقوقك كمستهلكة.":customerServiceCopy[market].shipping}
     </div>
     <div className="mt-8 flex flex-wrap gap-3 text-sm">{([{label:"مركز المساعدة",id:"help"},{label:"الدفع والتوصيل",id:"shipping-returns"},{label:"الخصوصية",id:"privacy"},{label:"الشروط",id:"terms"}] as const).filter(x=>x.id!==topic).map(x=><a key={x.id} href={"/"+market+"/info/"+x.id} className="inline-flex min-h-11 items-center rounded-full border bg-card px-4 font-bold text-primary hover:bg-primary-soft">{x.label}</a>)}</div>
    </div>
   </div>
  </div>
  <ShoppingAssistant market={market} products={[]}/>
 </StoreFrame>;
}
