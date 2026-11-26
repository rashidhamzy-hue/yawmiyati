import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {loadProductSeo,productHead} from "@/lib/seo/route-head";
export const Route=createFileRoute("/eg/p/$slug")({
 loader:({params})=>loadProductSeo("eg",params.slug),
 head:({loaderData})=>productHead("eg",loaderData),
 component:()=>{const {slug}=Route.useParams();return <MarketPreview market="eg" slug={slug}/>;}
});
