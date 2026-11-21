import {createFileRoute} from "@tanstack/react-router";
import {StoreCommerceGuard} from "@/components/store/StoreCommerceGuard";
/** Source-only guarded route. Never activates customer orders or payment. */
export const Route=createFileRoute("/iq/cart")({
 head:()=>({meta:[{title:"سلة يومياتي | يومياتي العراق"},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=> <StoreCommerceGuard market="iq" type="cart"/>
});
