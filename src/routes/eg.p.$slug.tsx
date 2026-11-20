import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
export const Route=createFileRoute("/eg/p/$slug")({head:()=>({meta:[{title:"منتج يومياتي مصر | تفاصيل المنتج"},{name:"robots",content:"noindex,nofollow"}]}),component:()=>{const {slug}=Route.useParams();return <MarketPreview market="eg" slug={slug}/>;}});
