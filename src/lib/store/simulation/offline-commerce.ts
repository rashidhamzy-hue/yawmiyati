/**
 * Completely offline, in-memory COD commerce simulator.
 * NO network calls, NO environment reads, NO database writes, NO supplier
 * acknowledgement and NO live customer orders. Safe for tests and owner demo.
 */
import {calculateSubtotal,markets,type MarketCode} from "../markets";
import {createFiveMarketFixtures,syntheticShippingMinor,SIMULATION_MODE,type SimProduct} from "./fixtures";

export type SimulationLine={sku:string;variantSku:string;quantity:number};
export type SimulationOrderStatus="pending"|"accepted"|"confirmed"|"shipped"|"delivered"|"cancelled"|"failed"|"returned";
export type SimulatedOrder={
 readonly synthetic:true;readonly mode:typeof SIMULATION_MODE;
 readonly id:string;readonly market:MarketCode;readonly currency:string;
 readonly clientRequestId:string;readonly lines:readonly SimulationLine[];
 readonly subtotalMinor:number;readonly shippingMinor:number;readonly totalMinor:number;
 readonly status:SimulationOrderStatus;readonly events:readonly {status:SimulationOrderStatus;eventId:string}[];
 readonly supplierAcknowledged:false;readonly paymentCollected:false;
};
export type SimulatedQuote={
 readonly synthetic:true;readonly market:MarketCode;readonly currency:string;
 readonly lines:readonly SimulationLine[];readonly subtotalMinor:number;
 readonly shippingMinor:number;readonly totalMinor:number;
 readonly evidence:"synthetic_fixture";readonly maySubmitToSupplier:false;
};

const transitions:Record<SimulationOrderStatus,readonly SimulationOrderStatus[]>={
 pending:["accepted","cancelled"],accepted:["confirmed","cancelled","failed"],
 confirmed:["shipped","cancelled","failed"],shipped:["delivered","failed","returned"],
 delivered:["returned"],cancelled:[],failed:["returned"],returned:[],
};

export function createOfflineCommerceSandbox(){
 const data=createFiveMarketFixtures();
 const orders=new Map<string,SimulatedOrder>();
 const dedup=new Map<string,string>();
 let serial=0;
 const copy=(o:SimulatedOrder):SimulatedOrder=>({
  ...o,lines:o.lines.map(x=>({...x})),events:o.events.map(x=>({...x})),
 });
 function catalog(market:MarketCode):readonly SimProduct[]{
  if(!Object.hasOwn(markets,market))throw Error("invalid_market");
  return data.products[market].slice();
 }
 function quote(market:MarketCode,requested:readonly SimulationLine[]):SimulatedQuote{
  if(!Object.hasOwn(markets,market))throw Error("invalid_market");
  if(!requested.length||requested.length>20)throw Error("invalid_cart");
  const products=new Map(catalog(market).map(x=>[x.sku,x]));
  const seen=new Set<string>();
  const lines=requested.map(line=>{
   if(!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>20)throw Error("invalid_quantity");
   const item=products.get(line.sku);
   if(!item||item.market!==market||!item.synthetic||item.mayPublish!==false)throw Error("unknown_or_cross_market_sku");
   const variant=item.variants.find(v=>v.sku===line.variantSku);
   if(!variant)throw Error("unknown_variant");
   if(seen.has(variant.sku))throw Error("duplicate_variant");
   seen.add(variant.sku);
   if(variant.stock!=="available"||variant.availableUnits<line.quantity)throw Error("stock_not_verified_in_fixture");
   return {line:{...line},unitMinor:item.priceMinor};
  });
  const subtotalMinor=calculateSubtotal(lines.map(x=>({unitMinor:x.unitMinor,quantity:x.line.quantity})));
  const shippingMinor=syntheticShippingMinor(market);
  const totalMinor=subtotalMinor+shippingMinor;
  if(!Number.isSafeInteger(totalMinor))throw Error("total_overflow");
  return {synthetic:true,market,currency:markets[market].currency,lines:lines.map(x=>x.line),
   subtotalMinor,shippingMinor,totalMinor,evidence:"synthetic_fixture",maySubmitToSupplier:false};
 }
 function place(input:{
   mode:typeof SIMULATION_MODE;market:MarketCode;
   clientRequestId:string;lines:readonly SimulationLine[];
 }):SimulatedOrder{
  if(input.mode!==SIMULATION_MODE)throw Error("simulation_mode_required");
  if(!/^[a-zA-Z0-9_-]{5,80}$/.test(input.clientRequestId))throw Error("invalid_idempotency_key");
  const key=input.market+":"+input.clientRequestId;
  const existingId=dedup.get(key);
  if(existingId){
   const existing=orders.get(existingId)!;
   // Replays with changed contents are an error, not a second order.
   const candidate=quote(input.market,input.lines);
   if(JSON.stringify(candidate.lines)!==JSON.stringify(existing.lines))throw Error("idempotency_payload_conflict");
   return copy(existing);
  }
  const priced=quote(input.market,input.lines);
  const id="SIM-"+input.market.toUpperCase()+"-ORDER-"+String(++serial).padStart(5,"0");
  const order:SimulatedOrder={
   synthetic:true,mode:SIMULATION_MODE,id,market:input.market,currency:priced.currency,
   clientRequestId:input.clientRequestId,lines:priced.lines,
   subtotalMinor:priced.subtotalMinor,shippingMinor:priced.shippingMinor,totalMinor:priced.totalMinor,
   status:"pending",events:[{status:"pending",eventId:id+":0"}],
   supplierAcknowledged:false,paymentCollected:false,
  };
  orders.set(id,order);dedup.set(key,id);
  return copy(order);
 }
 function transition(input:{mode:typeof SIMULATION_MODE;market:MarketCode;orderId:string;to:SimulationOrderStatus;eventId:string}):SimulatedOrder{
  if(input.mode!==SIMULATION_MODE)throw Error("simulation_mode_required");
  const current=orders.get(input.orderId);
  if(!current||current.market!==input.market)throw Error("order_not_found_or_cross_market");
  if(!/^[a-zA-Z0-9:_-]{3,100}$/.test(input.eventId))throw Error("invalid_event_id");
  if(current.events.some(x=>x.eventId===input.eventId)){
   const record=current.events.find(x=>x.eventId===input.eventId)!;
   if(record.status!==input.to)throw Error("event_payload_conflict");
   return copy(current);
  }
  if(!transitions[current.status].includes(input.to))throw Error("invalid_transition");
  const next:SimulatedOrder={...current,status:input.to,events:[...current.events,{eventId:input.eventId,status:input.to}]};
  orders.set(next.id,next);
  return copy(next);
 }
 function get(market:MarketCode,id:string):SimulatedOrder|null{
  if(!Object.hasOwn(markets,market))throw Error("invalid_market");
  const order=orders.get(id);
  return order?.market===market?copy(order):null;
 }
 function snapshot(market:MarketCode):readonly SimulatedOrder[]{
  if(!Object.hasOwn(markets,market))throw Error("invalid_market");
  return [...orders.values()].filter(x=>x.market===market).map(copy);
 }
 return Object.freeze({mode:SIMULATION_MODE,catalog,quote,place,transition,get,snapshot});
}
