import {sharedPageLinks} from "@/lib/seo/site";
import {createFileRoute} from "@tanstack/react-router";
import {StoreStoryPage} from "@/components/store/StoreStoryPage";
import {storyPageMetadata} from "@/lib/store/store-page-metadata";
export const Route=createFileRoute("/iq/story")({
 head:()=>{const m=storyPageMetadata("iq");return {links:sharedPageLinks("iq","/story"),meta:[{title:m.title},{name:"description",content:m.description},{name:"robots",content:m.robots}]};},
 component:()=> <StoreStoryPage market="iq"/>
});
