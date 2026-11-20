import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
export const Route=createFileRoute("/om/")({head:()=>({meta:[{title:"يومياتي عُمان — معاينة المتجر"},{name:"robots",content:"noindex,nofollow"}]}),component:()=> <MarketPreview market="om"/>});
