import {createFileRoute} from "@tanstack/react-router";
import {StoreOffersPage} from "@/components/store/StoreOffersPage";
import {marketIdentity} from "@/lib/store/market-identity";
import {canonicalLink} from "@/lib/seo/site";
export const Route=createFileRoute("/iq/offers")({
 head:()=>({links:canonicalLink("iq","/offers"),meta:[{title:"العروض والأطقم | يومياتي "+marketIdentity.iq.name},{name:"description",content:"أطقم جاهزة وأسعار أوفر عند شراء أكثر من قطعة من يومياتي "+marketIdentity.iq.name+"."},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=> <StoreOffersPage market="iq"/>
});
