import {createFileRoute} from "@tanstack/react-router";
import {StoreOffersPage} from "@/components/store/StoreOffersPage";
import {marketIdentity} from "@/lib/store/market-identity";
import {canonicalLink} from "@/lib/seo/site";
export const Route=createFileRoute("/ae/offers")({
 head:()=>({links:canonicalLink("ae","/offers"),meta:[{title:"العروض والأطقم | يومياتي "+marketIdentity.ae.name},{name:"description",content:"أطقم جاهزة وأسعار أوفر عند شراء أكثر من قطعة من يومياتي "+marketIdentity.ae.name+"."},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=> <StoreOffersPage market="ae"/>
});
