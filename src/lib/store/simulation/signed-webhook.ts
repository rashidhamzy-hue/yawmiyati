/**
 * Offline signed webhook fixture harness. Validates the existing Woo HMAC
 * checker; payloads remain artificial and NEVER update production orders.
 */
import {createHmac} from "node:crypto";
import {verifyWooWebhook,webhookDigest} from "../webhook.server";
import {markets,type MarketCode} from "../markets";
import {SIMULATION_MODE} from "./fixtures";
import {createSimulatedOutbox} from "./outbox";

export type SignedSimEvent={mode:typeof SIMULATION_MODE;market:MarketCode;eventId:string;body:Uint8Array;signature:string};
export function createSignedSyntheticEvent(input:{mode:typeof SIMULATION_MODE;market:MarketCode;eventId:string;orderId:string;status:"pending"|"accepted"|"confirmed"|"shipped"|"delivered"|"cancelled";secret:string}):SignedSimEvent{
 if(input.mode!==SIMULATION_MODE||!Object.hasOwn(markets,input.market)||!input.orderId.startsWith("SIM-")||!/^[A-Za-z0-9_-]{5,80}$/.test(input.eventId)||input.secret.length<12)throw Error("invalid_synthetic_webhook");
 const body=new TextEncoder().encode(JSON.stringify({synthetic:true,mode:SIMULATION_MODE,market:input.market,eventId:input.eventId,orderId:input.orderId,status:input.status}));
 const signature=createHmac("sha256",input.secret).update(body).digest("base64");
 return {mode:SIMULATION_MODE,market:input.market,eventId:input.eventId,body,signature};
}
export function acceptSignedSyntheticEvent(input:{mode:typeof SIMULATION_MODE;expectedMarket:MarketCode;event:SignedSimEvent;secret:string;outbox:ReturnType<typeof createSimulatedOutbox>;nowMs:number}){
 if(input.mode!==SIMULATION_MODE||input.event.mode!==SIMULATION_MODE||input.event.market!==input.expectedMarket||!Object.hasOwn(markets,input.expectedMarket))throw Error("simulation_market_mismatch");
 if(!verifyWooWebhook(input.event.body,input.event.signature,input.secret))throw Error("invalid_signature");
 let parsed:unknown;
 try{parsed=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(input.event.body))}catch{throw Error("invalid_event_json")}
 if(!parsed||typeof parsed!=="object")throw Error("invalid_event_payload");
 const p=parsed as Record<string,unknown>;
 if(p.synthetic!==true||p.mode!==SIMULATION_MODE||p.market!==input.expectedMarket||p.eventId!==input.event.eventId||typeof p.orderId!=="string"||!p.orderId.startsWith("SIM-")||typeof p.status!=="string"||!["pending","accepted","confirmed","shipped","delivered","cancelled"].includes(p.status))throw Error("invalid_event_payload");
 const digest=webhookDigest(input.event.body);
 return input.outbox.enqueue({mode:SIMULATION_MODE,market:input.expectedMarket,jobType:"status_poll",dedupeKey:"webhook-"+input.event.eventId,dueAtMs:input.nowMs,payload:{orderId:p.orderId,status:p.status,digest}});
}
