import {infoLinks} from "@/lib/seo/route-head";
import {createFileRoute,notFound} from "@tanstack/react-router";
import {StoreInfoPage,type InfoTopic} from "@/components/store/StoreInfoPage";
const topics:readonly string[]=["help","privacy","terms","shipping-returns"];
import {infoPageMetadata} from "@/lib/store/store-page-metadata";
export const Route=createFileRoute("/iq/info/$topic")({
 head:({params})=>{const m=infoPageMetadata("iq",params.topic);return {links:infoLinks("iq",params.topic),meta:[{title:m.title},{name:"description",content:m.description},{name:"robots",content:m.robots}]};},
 component:Info
});
function Info(){const {topic}=Route.useParams();if(!topics.includes(topic))throw notFound();return <StoreInfoPage market="iq" topic={topic as InfoTopic}/>;}
