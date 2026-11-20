import {createFileRoute} from "@tanstack/react-router";
import {StoreCommerceGuard} from "@/components/store/StoreCommerceGuard";
export const Route=createFileRoute("/sa/cart")({
 head:()=>({meta:[{title:"سلة يومياتي | السعودية"},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=> <StoreCommerceGuard market="sa" type="cart"/>
});
