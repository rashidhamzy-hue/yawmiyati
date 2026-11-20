import {createFileRoute,redirect} from "@tanstack/react-router";
export const Route=createFileRoute("/sa/cart")({beforeLoad:()=>{throw redirect({to:"/sa"});}});
