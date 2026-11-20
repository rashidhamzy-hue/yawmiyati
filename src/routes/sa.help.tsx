import {createFileRoute} from "@tanstack/react-router";
import {StoreInfoPage} from "@/components/store/StoreInfoPage";
export const Route=createFileRoute("/sa/help")({
 head:()=>({meta:[{title:"المساعدة | يومياتي السعودية"},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=> <StoreInfoPage market="sa" topic="help"/>
});
