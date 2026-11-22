const el=id=>document.getElementById(id);
const served=typeof localServer!=="undefined";
const dbKey="yawmiyati-offer-studio-v1";
let state=JSON.parse((!served&&localStorage.getItem(dbKey))||'{"orders":[],"trace":[]}');
let zone,offer,cart,key,review=false;
const session=crypto.randomUUID();
const variant=parseInt(session[0],16)%2?"unit-price":"total-only";
const context=()=>({session,variant,placement:el("placement").value,campaign:el("campaign").value});
const consent=()=>({behavior:el("behavior").checked,ads:el("ads").checked});
const save=()=>!served&&localStorage.setItem(dbKey,JSON.stringify(state));
const money=n=>new Intl.NumberFormat("en",{style:"currency",currency:zone.currency}).format(n/10**zone.minorDigits);
function log(event,o=offer,permissions=consent()){
  if(served && !["submitted","confirmed","delivered","refused","returned","payout_credited"].includes(event.action) && (permissions.behavior||permissions.ads)) fetch("/demo/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:event.action,offer:o.id,id:event.id,placement:event.placement,campaign:event.campaign,session:event.session,variant:event.variant,...permissions})}).catch(()=>{el("status").textContent="Local analytics unavailable"});
  state.trace.push(...destinations(event,permissions,o));state.trace=state.trace.slice(-120);save();
  el("trace").textContent=JSON.stringify(state.trace.slice(-12),null,2);
  const behaviorEvents=state.trace.filter(e=>e.sink==="PostHog local"&&e.properties.country===o.market);
  el("funnel").textContent="Recent local behavior events · "+["impression","product_view","cart_add","checkout_start","submitted"].map(a=>a+" "+behaviorEvents.filter(e=>e.event===a).length).join(" / ");

}
function track(action){log(envelope(action,offer,context(),crypto.randomUUID()));}
function cell(row,text){row.insertCell().textContent=text}
function resetCart(){el("bump").hidden=true;cart=null;key=null;review=false;el("confirm").hidden=true;el("status").textContent="";}
function renderShop(){
  el("packs").replaceChildren();
  const visible=zone.rows.filter(r=>r.reason==="Eligible"&&r.label.includes(el("query").value.trim()));
  if(!visible.some(r=>r.id===offer?.id))offer=visible[0];
  for(const row of visible){const b=document.createElement("button");b.textContent=row.label+" · "+money(row.door);if(variant==="unit-price"&&row.parts.length===1&&row.parts[0][1]>1)b.textContent+=" ("+money(Math.round(row.price/row.parts[0][1]))+" للقطعة قبل التوصيل)";b.setAttribute("aria-pressed",String(row===offer));
    b.onclick=()=>{offer=row;track("product_view");track("bundle_select");renderShop()};el("packs").append(b)}
  el("title").textContent=offer?.label||"لا توجد نتائج";el("cost").textContent=offer?"السعر "+money(offer.price)+" + التوصيل "+money(offer.shipping)+" = "+money(offer.door)+" عند الاستلام":"";
  el("add").disabled=!offer;
}
function loadZone(){
  const zones=catalog.filter(z=>z.market===el("market").value);
  zone=zones[Number(el("zone").value)||0];offer=zone.rows.find(r=>r.id===zone.winner);
  resetCart();el("query").value="";renderShop();impressions();
  const best=offer;el("decision").textContent=best.kind+" leads on projected contribution per submitted order. Target "+money(best.target)+" after acquisition cost "+money(best.ad)+".";
  el("comparison").replaceChildren();
  for(const r of zone.rows){const tr=el("comparison").insertRow();for(const v of [r.kind,money(r.door),money(r.expected),money(r.maxCpa),r.stock+" / "+money(r.floor)+" / "+money(r.cost),r.reason!=="Eligible"?r.reason:r===best?"Recommended":"Lower projected contribution"])cell(tr,v);tr.title="Floor "+money(r.floor)+" · supplier cost "+money(r.cost)+" · available packs "+r.stock+" · matched demo door price "+money(r.comparableDoor)}
  el("assumptions").textContent="Demo assumptions per 100 submissions: 80 retained, 15 refused, 5 returned. Shipping "+money(best.freight)+". Refusal / return fees "+money(best.refusalFee)+" / "+money(best.returnFee)+". Stock and resale prices are fixtures. Recorded return terms: "+zone.terms;
  dashboard();
}
function impressions(){for(const row of zone.rows.filter(r=>r.reason==="Eligible"&&r.label.includes(el("query").value.trim())))log(envelope("impression",row,context(),crypto.randomUUID()),row)}
function market(){el("zone").replaceChildren();catalog.filter(z=>z.market===el("market").value).forEach((z,i)=>el("zone").add(new Option(z.label,String(i))));loadZone()}
async function sync(input){
  const response=await fetch("/demo/orders",input?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...input,...consent()})}:{});
  const data=await response.json();if(!response.ok)throw Error(data.error||"Demo server unavailable");
  state.orders=data.orders;el("trace").textContent=JSON.stringify([...state.trace.slice(-5),...data.serverEvents],null,2);dashboard();
}
async function record(o,ctx,k){
  if(served){await sync({action:"submitted",offer:o.id,key:k,...ctx});return state.orders.find(r=>r.key===k)}
  let order=state.orders.find(r=>r.key===k);
  if(!order){order=submit(o,ctx,k);order.consent=consent();state.orders.push(order);log(order.events[0],o);save()}return order;
}
async function transition(order,action){
  if(served){await sync({action,key:order.key});return}
  if(advance(order,action))log(order.events.at(-1),order.offer,{behavior:order.consent.behavior&&consent().behavior,ads:order.consent.ads&&consent().ads});save();dashboard();
}
function dashboard(){
  const local=state.orders.filter(r=>r.offer.market===zone.market);el("orders").replaceChildren();
  let sales=0,net=0,retained=0;const groups=new Map();
  for(const order of local){const r=result(order),o=order.offer;net+=r.contribution??0;sales+=r.retainedSales;if(r.state==="delivered")retained++;
    const tr=el("orders").insertRow();cell(tr,o.kind+" · "+o.sku+" · "+o.id+" · "+order.context.placement+" · "+order.context.campaign);cell(tr,r.state+(r.payoutCredited?" · payout credited":""));cell(tr,money(r.retainedSales));cell(tr,r.contribution===null?"Pending":money(r.contribution));
    const buttons=tr.insertCell();const options={submitted:["confirmed"],confirmed:["delivered","refused"],delivered:r.payoutCredited?["returned"]:["payout_credited","returned"]}[r.state]||[];
    for(const action of options){const b=document.createElement("button");b.textContent=action;b.onclick=()=>transition(order,action);buttons.append(b)}
    if(r.contribution!==null){const g=groups.get(o.id)||{o,total:0,count:0};g.count++;g.total+=r.contribution;groups.set(o.id,g)}
  }
  el("woo").textContent=local.length?JSON.stringify(local.at(-1).woo,null,2):"No order submitted";
  el("metrics").textContent=local.length+" submitted · "+retained+" retained deliveries · "+money(sales)+" retained door sales · "+money(net)+" resolved-order contribution after assumed ads.";
  const ranked=[...groups.values()].sort((a,b)=>b.total/b.count-a.total/a.count),lead=ranked[0];
  el("recommend").textContent=(lead&&lead.total>0?"Demo homepage candidate: "+lead.o.label+" ("+money(Math.round(lead.total/lead.count))+" mean contribution across "+lead.count+" resolved examples). Ad-test ceiling: "+money(lead.o.maxCpa)+".":"Homepage and ad tests await positive resolved outcomes.")+" All demo shoppers excluded from retargeting. Submitted orders suppressed from cart recovery. Observed commercial sales: 0.";
}
el("market").onchange=market;el("zone").onchange=loadZone;
el("placement").onchange=el("campaign").onchange=()=>{resetCart();impressions()};
el("query").onchange=()=>{el("placement").value="search";const subject=offer||zone.rows[0];log(envelope("search",subject,context(),crypto.randomUUID()),subject);renderShop();impressions()};
el("add").onclick=()=>{resetCart();cart={offer,context:context()};key="demo-"+crypto.randomUUID();track("cart_add");showBump();el("status").textContent="أُضيف إلى السلة"};
function addOn(){
  const kit=zone.rows.find(r=>r.sku==="DEMO-KIT"&&r.reason==="Eligible");
  if(cart?.offer.kind==="Single"&&kit&&kit.expected>=cart.offer.expected)return kit;
}
function showBump(){
  const kit=addOn();el("bump").hidden=!kit;
  if(kit)el("bump").textContent="أضيفي خطّاف تنظيم مقابل "+money(kit.door-cart.offer.door);
}
el("bump").onclick=()=>{const kit=addOn();if(!kit)return;
  const ctx=cart.context;log(envelope("cart_remove",cart.offer,ctx,crypto.randomUUID()),cart.offer);
  cart={offer:kit,context:ctx};key="demo-"+crypto.randomUUID();review=false;el("confirm").hidden=true;
  offer=kit;renderShop();track("bundle_select");track("cart_add");showBump();el("status").textContent="تم تحديث السلة";
};
el("remove").onclick=()=>{if(cart)log(envelope("cart_remove",cart.offer,cart.context,crypto.randomUUID()),cart.offer);resetCart()};
el("checkout").onclick=()=>{if(!cart){const o=offer||zone.rows[0];log(envelope("checkout_error",o,context(),crypto.randomUUID()),o);el("status").textContent="السلة فارغة";return}
  for(const a of ["checkout_start","checkout_review"])log(envelope(a,cart.offer,cart.context,crypto.randomUUID()),cart.offer);
  review=true;el("confirm").hidden=false;el("summary").textContent=cart.offer.label+" · الإجمالي عند الاستلام "+money(cart.offer.door)};
el("submitOrder").onclick=async()=>{if(!review||!cart)return;await record(cart.offer,cart.context,key);resetCart();el("status").textContent="تم تسجيل طلب الاختبار";dashboard()};
el("examples").onclick=async()=>{const rows=zone.rows.filter(r=>r.reason==="Eligible");for(const [i,outcome] of ["delivered","refused","returned"].entries()){
  const o=rows[i%rows.length],order=await record(o,{placement:placements[i],campaign:campaigns[i%2]},"demo-example-"+o.id+"-"+outcome);
  for(const a of ["confirmed",outcome==="refused"?"refused":"delivered",...(outcome==="returned"?["returned"]:outcome==="delivered"?["payout_credited"]:[])])await transition(order,a);
}dashboard()};
el("behavior").onchange=el("ads").onchange=impressions;
const requestedMarket=location.hash.slice(1);if(catalog.some(z=>z.market===requestedMarket))el("market").value=requestedMarket;market();if(served)sync();
