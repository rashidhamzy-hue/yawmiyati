import {createFileRoute,Link} from "@tanstack/react-router";
export const Route=createFileRoute("/sa/order/$id")({head:()=>({meta:[{title:"حالة الطلب | يومياتي"},{name:"robots",content:"noindex,nofollow"}]}),component:OrderStatus});
function OrderStatus(){return <main dir="rtl" className="mx-auto max-w-lg space-y-5 px-4 py-16 text-center"><h1 className="font-display text-3xl font-extrabold">تعذّر العثور على معلومات هذا الطلب</h1><p className="leading-8 text-muted-foreground">لا تتوافر بيانات طلب مؤكدة لهذا الرابط.</p><Link to="/sa" className="btn-outline">العودة إلى يومياتي</Link></main>;}
