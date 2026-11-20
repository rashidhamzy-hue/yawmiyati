import {createFileRoute} from "@tanstack/react-router";
import {StoreCommerceGuard} from "@/components/store/StoreCommerceGuard";
export const Route=createFileRoute("/sa/order/$id")({
 head:()=>({meta:[{title:"متابعة الطلب | يومياتي السعودية"},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=> <StoreCommerceGuard market="sa" type="order"/>
});
