import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
export const Route=createFileRoute("/iq/p/$slug")({head:()=>({meta:[{title:"منتج يومياتي العراق — معاينة"},{name:"robots",content:"noindex,nofollow"}]}),component:()=>{const {slug}=Route.useParams();return <MarketPreview market="iq" slug={slug}/>;}});
