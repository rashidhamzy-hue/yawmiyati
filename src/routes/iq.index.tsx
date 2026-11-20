import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
export const Route=createFileRoute("/iq/")({head:()=>({meta:[{title:"يومياتي العراق — معاينة المتجر"},{name:"robots",content:"noindex,nofollow"}]}),component:()=> <MarketPreview market="iq"/>});
