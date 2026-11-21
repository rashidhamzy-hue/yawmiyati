import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
export const Route=createFileRoute("/sa/search")({
 validateSearch:(s:Record<string,unknown>)=>({q:typeof s.q==="string"?s.q.slice(0,120):""}),
 head:()=>({meta:[{title:"البحث في يومياتي السعودية"},{name:"description",content:"ابحثي في معلومات المنتجات المعتمدة. الطلبات غير مفعّلة حالياً."},{name:"robots",content:"noindex,nofollow"}]}),
 component:SearchPage
});
function SearchPage(){const {q}=Route.useSearch();return <MarketPreview market="sa" searchOnly initialSearch={q}/>;}
