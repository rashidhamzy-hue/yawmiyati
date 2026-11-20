import {createFileRoute} from "@tanstack/react-router";
import {StoreStoryPage} from "@/components/store/StoreStoryPage";
export const Route=createFileRoute("/iq/story")({
 head:()=>({meta:[
  {title:"قصتنا | يومياتي IQ"},
  {name:"description",content:"اكتشفي كيف بدأت يومياتي كمكان للمحتوى والأفكار اليومية، وكيف تطورت لتقرب الإلهام من اختيارات البيت والجمال."},
  {name:"robots",content:"noindex,nofollow"}
 ]}),
 component:()=> <StoreStoryPage market="iq"/>
});
