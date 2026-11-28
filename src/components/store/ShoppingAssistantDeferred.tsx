import {lazy,Suspense,useEffect,useState,type ComponentProps} from "react";
import type {ShoppingAssistant as Eager} from "./ShoppingAssistant";

const Loaded=lazy(()=>import("./ShoppingAssistant").then(m=>({default:m.ShoppingAssistant})));
/**
 * The shopping assistant is not needed for the first paint: its code is fetched once the browser is idle,
 * so the hero picture and the first products never wait for it.
 */
export function ShoppingAssistant(props:ComponentProps<typeof Eager>){
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  const idle=(window as unknown as {requestIdleCallback?:(cb:()=>void,o?:{timeout:number})=>number}).requestIdleCallback;
  if(idle){idle(()=>setReady(true),{timeout:4000});return;}
  const t=window.setTimeout(()=>setReady(true),1500);return()=>window.clearTimeout(t);
 },[]);
 return ready?<Suspense fallback={null}><Loaded {...props}/></Suspense>:null;
}
