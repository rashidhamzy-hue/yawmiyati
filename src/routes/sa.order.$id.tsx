import {createFileRoute,Link} from "@tanstack/react-router";
export const Route=createFileRoute("/sa/order/$id")({head:()=>({meta:[{title:"حالة الطلب | يومياتي"},{name:"robots",content:"noindex,nofollow"}]}),component:OrderStatus});
function OrderStatus(){return <main className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center"><h1 className="text-2xl font-bold">لا يوجد تأكيد طلب</h1><p>هذه نسخة اختبارية ولا يمكن التحقق من طلب حقيقي هنا.</p><Link to="/sa" className="btn-outline">العودة للمتجر</Link></main>;}
