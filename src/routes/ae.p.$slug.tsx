import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
export const Route=createFileRoute("/ae/p/$slug")({head:()=>({meta:[{title:"منتج يومياتي الإمارات | تفاصيل المنتج"},{name:"robots",content:"noindex,nofollow"}]}),component:()=>{const {slug}=Route.useParams();return <MarketPreview market="ae" slug={slug}/>;}});
