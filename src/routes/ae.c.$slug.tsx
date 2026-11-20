import {createFileRoute} from "@tanstack/react-router";
import {StoreCategoryPage} from "@/components/store/StoreCategoryPage";
export const Route=createFileRoute("/ae/c/$slug")({
 head:()=>({meta:[{title:"تسوقي حسب القسم | يومياتي"},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=>{const {slug}=Route.useParams();return <StoreCategoryPage market="ae" slug={slug}/>;}
});
