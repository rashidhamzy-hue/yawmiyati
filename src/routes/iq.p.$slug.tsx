import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {loadProductSeo,productHead} from "@/lib/seo/route-head";
export const Route=createFileRoute("/iq/p/$slug")({
 loader:({params})=>loadProductSeo("iq",params.slug),
 head:({loaderData})=>productHead("iq",loaderData),
 component:()=>{const {slug}=Route.useParams();return <MarketPreview market="iq" slug={slug}/>;}
});
