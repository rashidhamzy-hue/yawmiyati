import {createFileRoute} from "@tanstack/react-router";
import {StoreCommerceGuard} from "@/components/store/StoreCommerceGuard";
/** Source-only guarded route. Never activates customer orders or payment. */
export const Route=createFileRoute("/eg/checkout")({
 head:()=>({meta:[{title:"إتمام الطلب | يومياتي مصر"},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=> <StoreCommerceGuard market="eg" type="checkout"/>
});
