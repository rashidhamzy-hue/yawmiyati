import {createFileRoute,notFound} from "@tanstack/react-router";
import {StoreInfoPage,type InfoTopic} from "@/components/store/StoreInfoPage";
const topics:readonly string[]=["help","privacy","terms","shipping-returns"];
export const Route=createFileRoute("/sa/info/$topic")({
 head:()=>({meta:[{title:"معلومات يومياتي | SA"},{name:"robots",content:"noindex,nofollow"}]}),
 component:Info
});
function Info(){const {topic}=Route.useParams();if(!topics.includes(topic))throw notFound();return <StoreInfoPage market="sa" topic={topic as InfoTopic}/>;}
