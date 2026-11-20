import {createFileRoute} from "@tanstack/react-router";
import {ShoppingAssistant} from "@/components/store/ShoppingAssistant";
export const Route=createFileRoute("/sa/help")({
 head:()=>({meta:[{title:"المساعدة | يومياتي السعودية"},{name:"description",content:"إجابات عن تصفح المنتجات، الأسعار المعتمدة، وسياسات الطلب والتوصيل في يومياتي."}]}),
 component:Help
});
function Help(){return <div dir="rtl" className="min-h-screen bg-background px-4 py-14 text-foreground"><main className="mx-auto max-w-3xl space-y-6"><a href="/sa" className="font-bold text-primary">يومياتي السعودية</a><h1 className="font-display text-4xl font-extrabold">كيف نقدر نساعدك؟</h1><p className="leading-8 text-muted-foreground">يمكنك اكتشاف الأقسام والبحث بين المنتجات التي لها معلومات معتمدة. تختلف تفاصيل التوصيل والدفع والاسترجاع حسب البلد والمنتج، وتُعرض عند توفر بيانات مؤكدة.</p><a className="btn-primary w-fit" href="/sa#questions">الأسئلة الشائعة</a></main><ShoppingAssistant market="sa" products={[]}/></div>;}
