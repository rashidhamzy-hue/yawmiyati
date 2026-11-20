import {createFileRoute} from "@tanstack/react-router";
import {StoreStoryPage} from "@/components/store/StoreStoryPage";
export const Route=createFileRoute("/sa/story")({
 head:()=>({meta:[
  {title:"قصتنا | يومياتي SA"},
  {name:"description",content:"اكتشفي كيف بدأت يومياتي كمكان للمحتوى والأفكار اليومية، وكيف تطورت لتقرب الإلهام من اختيارات البيت والجمال."},
  {name:"robots",content:"noindex,nofollow"}
 ]}),
 component:()=> <StoreStoryPage market="sa"/>
});
