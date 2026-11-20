import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
export const Route=createFileRoute("/ae/search")({
 validateSearch:(s:Record<string,unknown>)=>({q:typeof s.q==="string"?s.q.slice(0,120):""}),
 head:()=>({meta:[{title:"البحث في يومياتي الإمارات"},{name:"robots",content:"noindex,nofollow"},{name:"description",content:"ابحثي في اختيارات ومنتجات يومياتي الإمارات."}]}),
 component:SearchPage
});
function SearchPage(){const {q}=Route.useSearch();return <MarketPreview market="ae" searchOnly initialSearch={q}/>;}
