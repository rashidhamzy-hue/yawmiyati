import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {productPageMetadata} from "@/lib/store/store-page-metadata";
export const Route=createFileRoute("/ae/p/$slug")({head:()=>{const m=productPageMetadata("ae");return {meta:[{title:m.title},{name:"description",content:m.description},{name:"robots",content:m.robots}]};},
 component:()=>{const {slug}=Route.useParams();return <MarketPreview market="ae" slug={slug}/>;}});
