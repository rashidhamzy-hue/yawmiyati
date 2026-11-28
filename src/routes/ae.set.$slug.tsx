import {createFileRoute} from "@tanstack/react-router";
import {StoreSetPage} from "@/components/store/StoreOffersPage";
import {marketIdentity} from "@/lib/store/market-identity";
import {canonicalLink} from "@/lib/seo/site";
export const Route=createFileRoute("/ae/set/$slug")({
 head:({params})=>({links:/^[a-z0-9][a-z0-9_-]{0,139}$/.test(params.slug)?canonicalLink("ae","/set/"+params.slug):[],meta:[{title:"طقم يومياتي | يومياتي "+marketIdentity.ae.name},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=>{const {slug}=Route.useParams();return <StoreSetPage market="ae" slug={slug}/>;}
});
