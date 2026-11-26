import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {loadProductSeo,productHead} from "@/lib/seo/route-head";
export const Route=createFileRoute("/om/p/$slug")({
 loader:({params})=>loadProductSeo("om",params.slug),
 head:({loaderData})=>productHead("om",loaderData),
 component:()=>{const {slug}=Route.useParams();return <MarketPreview market="om" slug={slug}/>;}
});
