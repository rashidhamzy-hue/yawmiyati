import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {loadProductSeo,productHead} from "@/lib/seo/route-head";
export const Route=createFileRoute("/ae/p/$slug")({
 loader:({params})=>loadProductSeo("ae",params.slug),
 head:({loaderData})=>productHead("ae",loaderData),
 component:()=>{const {slug}=Route.useParams();return <MarketPreview market="ae" slug={slug}/>;}
});
