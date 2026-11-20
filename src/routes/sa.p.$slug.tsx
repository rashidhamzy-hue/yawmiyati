import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
export const Route=createFileRoute("/sa/p/$slug")({
 head:()=>({meta:[{title:"تفاصيل المنتج | يومياتي السعودية"},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=>{const {slug}=Route.useParams();return <MarketPreview market="sa" slug={slug}/>;}
});
