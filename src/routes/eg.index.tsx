import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
export const Route=createFileRoute("/eg/")({head:()=>({meta:[{title:"يومياتي مصر | أسلوب حياة أجمل"},{name:"robots",content:"noindex,nofollow"}]}),component:()=> <MarketPreview market="eg"/>});
