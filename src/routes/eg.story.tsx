import {createFileRoute} from "@tanstack/react-router";
import {StoreStoryPage} from "@/components/store/StoreStoryPage";
export const Route=createFileRoute("/eg/story")({
 head:()=>({meta:[
  {title:"قصتنا | يومياتي EG"},
  {name:"description",content:"اكتشفي كيف بدأت يومياتي كمكان للمحتوى والأفكار اليومية، وكيف تطورت لتقرب الإلهام من اختيارات البيت والجمال."},
  {name:"robots",content:"noindex,nofollow"}
 ]}),
 component:()=> <StoreStoryPage market="eg"/>
});
