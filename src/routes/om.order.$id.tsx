import {createFileRoute} from "@tanstack/react-router";
import {StoreCommerceGuard} from "@/components/store/StoreCommerceGuard";
/** Source-only guarded route. Never activates customer orders or payment. */
export const Route=createFileRoute("/om/order/$id")({
 head:()=>({meta:[{title:"متابعة الطلب | يومياتي عُمان"},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=> <StoreCommerceGuard market="om" type="order"/>
});
