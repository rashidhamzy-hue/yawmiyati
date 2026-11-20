import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
export const Route=createFileRoute("/om/p/$slug")({head:()=>({meta:[{title:"منتج يومياتي عُمان | تفاصيل المنتج"},{name:"robots",content:"noindex,nofollow"}]}),component:()=>{const {slug}=Route.useParams();return <MarketPreview market="om" slug={slug}/>;}});
