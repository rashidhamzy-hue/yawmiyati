import {createFileRoute} from "@tanstack/react-router";
import {StoreCategoryPage} from "@/components/store/StoreCategoryPage";
import {categoryPageMetadata} from "@/lib/store/store-page-metadata";
export const Route=createFileRoute("/om/c/$slug")({
 head:({params})=>{const m=categoryPageMetadata("om",params.slug);return {meta:[{title:m.title},{name:"description",content:m.description},{name:"robots",content:m.robots}]};},
 component:()=>{const {slug}=Route.useParams();return <StoreCategoryPage market="om" slug={slug}/>;}
});
