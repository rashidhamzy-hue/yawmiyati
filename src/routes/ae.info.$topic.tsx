import {createFileRoute,notFound} from "@tanstack/react-router";
import {StoreInfoPage,type InfoTopic} from "@/components/store/StoreInfoPage";
const topics:readonly string[]=["help","privacy","terms","shipping-returns"];
import {infoPageMetadata} from "@/lib/store/store-page-metadata";
export const Route=createFileRoute("/ae/info/$topic")({
 head:({params})=>{const m=infoPageMetadata("ae",params.topic);return {meta:[{title:m.title},{name:"description",content:m.description},{name:"robots",content:m.robots}]};},
 component:Info
});
function Info(){const {topic}=Route.useParams();if(!topics.includes(topic))throw notFound();return <StoreInfoPage market="ae" topic={topic as InfoTopic}/>;}
