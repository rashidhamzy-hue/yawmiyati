import {editorialSchema,serializeEditorialSchema} from "@/lib/store/editorial-schema";
import {createFileRoute} from "@tanstack/react-router";
import {StoreCategoryPage} from "@/components/store/StoreCategoryPage";
import {categoryPageMetadata} from "@/lib/store/store-page-metadata";
export const Route=createFileRoute("/sa/c/$slug")({
 head:({params})=>{const m=categoryPageMetadata("sa",params.slug);const schema=editorialSchema("sa",params.slug);return {scripts:schema?[{type:"application/ld+json",children:serializeEditorialSchema(schema)}]:[],meta:[{title:m.title},{name:"description",content:m.description},{name:"robots",content:m.robots}]};},
 component:()=>{const {slug}=Route.useParams();return <StoreCategoryPage market="sa" slug={slug}/>;}
});
