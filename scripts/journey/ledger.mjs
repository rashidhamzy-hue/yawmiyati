// Both the offline browser and the local server consume the same allowlisted envelope.
export const placements=["homepage","search","collection"];
export const campaigns=["organic","demo-meta-kitchen"];
const actions=["impression","search","product_view","bundle_select","cart_add","cart_remove","checkout_start","checkout_review","checkout_error","submitted","confirmed","delivered","refused","returned","payout_credited"];
const advertising={product_view:"ViewContent",cart_add:"AddToCart",checkout_start:"InitiateCheckout",delivered:"Purchase"};
export function envelope(action, offer, context, id) {
  if (!actions.includes(action)||!placements.includes(context.placement)||!campaigns.includes(context.campaign)||!offer.id.startsWith("demo-"+offer.market+"-")) throw Error("Invalid demo event");
  const session=/^[0-9a-f-]{36}$/.test(context.session)?context.session:"fixture";
  const variant=context.variant==="unit-price"?"unit-price":"total-only";
  return {id,action,session,variant,offer_id:offer.id,product:offer.sku,country:offer.market,currency:offer.currency,placement:context.placement,campaign:context.campaign,experiment:"pack-selector-v1",demo:true};
}
export function destinations(event, consent, offer) {
  const rows=[];
  if(consent.behavior===true) rows.push({sink:"PostHog local",event:event.action,properties:{distinct_id:event.session,...event,$insert_id:event.id}});
  const name=advertising[event.action];
  if(consent.ads===true && name){
    const data={currency:offer.currency,value:offer.door/10**offer.minorDigits,content_ids:[offer.id]};
    if(name!=="Purchase") rows.push({sink:"Pixel local",event:name,eventID:event.id,data});
    rows.push({sink:"CAPI local",event_name:name,event_id:event.id,custom_data:data,action_source:"website"});
  }
  return rows;
}
export function submit(offer,context,key) {
  if(offer.reason!=="Eligible"|| !/^demo-[a-zA-Z0-9-]{1,100}$/.test(key)) throw Error("Invalid checkout");
  const event=envelope("submitted",offer,context,key+"/submitted");
  const meta_data=Object.entries({offer_id:offer.id,country:offer.market,currency:offer.currency,placement:event.placement,campaign:event.campaign,environment:"demo",checkout_id:key}).map(([key,value])=>({key,value}));
  // Numeric Woo IDs refer only to the isolated fixture catalog.
  const productIds={rack:101,hook:102,clip:103,brush:104};
  const decimal=n=>(n/10**offer.minorDigits).toFixed(offer.minorDigits);
  const lines=offer.sku==="DEMO-R2"?[{product_id:201,quantity:1}]:
    offer.parts.map(([part,quantity])=>({product_id:productIds[part],quantity}));
  const woo={currency:offer.currency,payment_method:"cod",set_paid:false,line_items:lines,
    shipping_lines:[{method_id:"flat_rate",method_title:"Demo zone",total:decimal(offer.shipping)}],
    meta_data:[...meta_data,{key:"demo_item_total",value:decimal(offer.price)},{key:"demo_door_total",value:decimal(offer.door)}]};
  return {key,offer,context:{placement:event.placement,campaign:event.campaign,session:event.session,variant:event.variant},events:[event],woo,paid:false};
}
export function advance(order,action) {
  if(order.events.some(e=>e.action===action)) return false;
  const seen=a=>order.events.some(e=>e.action===a);
  const ok={confirmed:seen("submitted"),delivered:seen("confirmed")&&!seen("refused"),refused:seen("confirmed")&&!seen("delivered"),returned:seen("delivered"),payout_credited:seen("delivered")&&!seen("returned")};
  if(ok[action]!==true) throw Error("Invalid order transition");
  order.events.push(envelope(action,order.offer,order.context,order.key+"/"+action));
  if(action==="payout_credited") order.paid=true;
  return true;
}
export function result(order){
  const seen=a=>order.events.some(e=>e.action===a);
  const state=seen("returned")?"returned":seen("refused")?"refused":seen("delivered")?"delivered":seen("confirmed")?"confirmed":"submitted";
  const o=order.offer;
  const outcome={delivered:o.kept,refused:o.refused,returned:o.returned}[state];
  return {state,retainedSales:state==="delivered"?o.door:0,contribution:outcome===undefined?null:outcome-o.ad,payoutCredited:order.paid};
}
