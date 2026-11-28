import {createFileRoute} from "@tanstack/react-router";
import {StoreOffersPage} from "@/components/store/StoreOffersPage";
import {marketIdentity} from "@/lib/store/market-identity";
import {canonicalLink} from "@/lib/seo/site";
export const Route=createFileRoute("/eg/offers")({
 head:()=>({links:canonicalLink("eg","/offers"),meta:[{title:"العروض والأطقم | يومياتي "+marketIdentity.eg.name},{name:"description",content:"أطقم جاهزة وأسعار أوفر عند شراء أكثر من قطعة من يومياتي "+marketIdentity.eg.name+"."},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=> <StoreOffersPage market="eg"/>
});
