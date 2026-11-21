import {createFileRoute} from "@tanstack/react-router";
import {StoreStoryPage} from "@/components/store/StoreStoryPage";
import {storyPageMetadata} from "@/lib/store/store-page-metadata";
export const Route=createFileRoute("/om/story")({
 head:()=>{const m=storyPageMetadata("om");return {meta:[{title:m.title},{name:"description",content:m.description},{name:"robots",content:m.robots}]};},
 component:()=> <StoreStoryPage market="om"/>
});
