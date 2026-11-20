import {createFileRoute,redirect} from "@tanstack/react-router";
export const Route=createFileRoute("/sa/c/$slug")({beforeLoad:()=>{throw redirect({to:"/sa",hash:"discover"});}});
