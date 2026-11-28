import {createFileRoute} from "@tanstack/react-router";
import {StoreOffersPage} from "@/components/store/StoreOffersPage";
import {marketIdentity} from "@/lib/store/market-identity";
export const Route=createFileRoute("/om/offers")({
 head:()=>({meta:[{title:"العروض والأطقم | يومياتي "+marketIdentity.om.name},{name:"description",content:"أطقم جاهزة وأسعار أوفر عند شراء أكثر من قطعة من يومياتي "+marketIdentity.om.name+"."},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=> <StoreOffersPage market="om"/>
});
