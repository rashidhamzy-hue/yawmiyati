import {createFileRoute} from "@tanstack/react-router";
import {StoreSetPage} from "@/components/store/StoreOffersPage";
import {marketIdentity} from "@/lib/store/market-identity";
export const Route=createFileRoute("/iq/set/$slug")({
 head:()=>({meta:[{title:"طقم يومياتي | يومياتي "+marketIdentity.iq.name},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=>{const {slug}=Route.useParams();return <StoreSetPage market="iq" slug={slug}/>;}
});
