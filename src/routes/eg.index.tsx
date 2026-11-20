import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
export const Route=createFileRoute("/eg/")({head:()=>({meta:[{title:"يومياتي مصر — معاينة المتجر"},{name:"robots",content:"noindex,nofollow"}]}),component:()=> <MarketPreview market="eg"/>});
