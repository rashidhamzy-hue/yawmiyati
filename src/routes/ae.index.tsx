import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
export const Route=createFileRoute("/ae/")({head:()=>({meta:[{title:"يومياتي الإمارات — معاينة المتجر"},{name:"robots",content:"noindex,nofollow"}]}),component:()=> <MarketPreview market="ae"/>});
