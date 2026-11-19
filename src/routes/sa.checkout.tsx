import { createFileRoute, Link } from "@tanstack/react-router";
export const Route=createFileRoute("/sa/checkout")({head:()=>({meta:[{title:"الطلب غير متاح | يومياتي"},{name:"robots",content:"noindex,nofollow"}]}),component:Checkout});
function Checkout(){return <main className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center"><h1 className="text-2xl font-bold">الطلب غير متاح حالياً</h1><p>المتجر في مرحلة الاختبار. لا نطلب بياناتك الشخصية ولا نقبل طلبات حقيقية الآن.</p><Link to="/sa" className="btn-primary">العودة للمتجر</Link></main>;}
