import type {OrderState} from "./supplier-status";
import type {MarketCode} from "./markets";
const allowed:Record<OrderState,readonly OrderState[]>={
 pending:["accepted","cancelled"],accepted:["confirmed","cancelled","failed"],confirmed:["shipped","cancelled","failed"],shipped:["delivered","failed","returned"],delivered:["returned"],failed:["returned"],cancelled:[],returned:[],unknown:[]
};
export type OrderObservation={market:MarketCode;orderId:string;eventId:string;state:OrderState;occurredAt:string;source:"woo"|"taager"|"reconciliation";verified:boolean};
export function assessOrderObservation(current:{market:MarketCode;orderId:string;state:OrderState;lastEventAt:string|null},event:OrderObservation){
 const result=(decision:"apply"|"ignore"|"review",reason:string)=>({decision,reason});
 if(current.market!==event.market||current.orderId!==event.orderId)return result("review","identity_mismatch");
 if(!event.verified||!event.eventId.trim()||!Number.isFinite(Date.parse(event.occurredAt)))return result("review","unverified_event");
 if(event.state==="unknown")return result("review","unknown_supplier_state");
 if(event.source==="woo"&&!["pending","accepted","cancelled"].includes(event.state))return result("review","woo_not_delivery_proof");
 if(current.lastEventAt&&(!Number.isFinite(Date.parse(current.lastEventAt))||Date.parse(event.occurredAt)<Date.parse(current.lastEventAt)))return result("review","out_of_order");
 if(current.state===event.state)return result("ignore","same_state");
 if(current.lastEventAt&&Date.parse(event.occurredAt)===Date.parse(current.lastEventAt))return result("review","conflicting_timestamp");
 if(!allowed[current.state].includes(event.state))return result("review","transition_not_verified");
 return result("apply","verified_transition");
}
// Advisory contract only. Server must apply under row lock with unique receipt, source mapping and audit event.
// Never dispatch an order or write a ledger entry from this helper.
