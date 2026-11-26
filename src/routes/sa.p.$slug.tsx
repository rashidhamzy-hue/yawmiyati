import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {loadProductSeo,productHead} from "@/lib/seo/route-head";
export const Route=createFileRoute("/sa/p/$slug")({
 loader:({params})=>loadProductSeo("sa",params.slug),
 head:({loaderData})=>productHead("sa",loaderData),
 component:()=>{const {slug}=Route.useParams();return <MarketPreview market="sa" slug={slug}/>;}
});
