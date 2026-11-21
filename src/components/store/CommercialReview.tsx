import {useEffect,useState,type FormEvent} from "react";
import {dashboardClient,type CandidateRow,type CatalogReadiness,type ReviewDecision} from "@/lib/store/dashboard-client";
import {markets,parseMinorUnits,type MarketCode} from "@/lib/store/markets";
import {evaluateCodEvidence} from "@/lib/store/pricing";
import {CandidateDraft} from "./CandidateDraft";
import {formatObservedSupplierPrice} from "@/lib/store/owner-dashboard-presentation";
type Client=ReturnType<typeof dashboardClient>;
function amount(value:string,market:MarketCode){return value.trim()===""?null:parseMinorUnits(market,value.trim());}
function format(value:number|null,market:MarketCode){return value===null?"":(value/10**markets[market].minorDigits).toFixed(markets[market].minorDigits);}
export function CommercialReview({client,token,market}:{client:Client;token:string;market:MarketCode}){
 const [rows,setRows]=useState<CandidateRow[]|null>(null),[readiness,setReadiness]=useState<CatalogReadiness[]>([]),[error,setError]=useState(""),[attempt,setAttempt]=useState(0),[query,setQuery]=useState("");
 useEffect(()=>{let active=true;setRows(null);setError("");Promise.all([client.candidates(token,market),client.readiness(token,market)]).then(([r,gates])=>{if(active){setRows(r);setReadiness(gates);}}).catch(()=>{if(active)setError("Cannot load candidates. Verify access and reload.");});return()=>{active=false}},[client,token,market,attempt]);
 return <section className="space-y-4 rounded-xl border p-5"><h2 className="text-xl font-bold">Supplier candidate review</h2><p className="text-sm text-muted-foreground">Supplier prices are observations, not acquisition costs. A shortlist is not publication approval.</p>
 <div className="flex flex-wrap gap-2"><input className="rounded border p-2" aria-label="Search candidates" placeholder="Search name or SKU" value={query} onChange={e=>setQuery(e.target.value)}/><button className="rounded border px-3" onClick={()=>setAttempt(a=>a+1)}>Reload (discards unsaved edits)</button></div>
 {error?<p role="alert">{error}</p>:rows===null?<p role="status">Loading candidates…</p>:<p>{rows.length} imported candidates</p>}
 <div className="grid gap-4 lg:grid-cols-2">{rows?.map(row=><div key={market+":"+row.woo_product_id} hidden={!(row.title+" "+row.supplier_sku).toLowerCase().includes(query.toLowerCase())}><ReviewCard row={row} market={market} save={x=>client.saveCandidate(token,market,row.woo_product_id,x)}/><ReadinessView value={readiness.find(g=>g.woo_product_id===row.woo_product_id)}/><CandidateDraft client={client} token={token} market={market} row={row}/></div>)}</div>
 </section>
}
type SaveInput=Parameters<Client["saveCandidate"]>[3];
function ReviewCard({row,market,save}:{row:CandidateRow;market:MarketCode;save:(x:SaveInput)=>Promise<string>}){
 const [supplier,S]=useState(format(row.review?.supplier_cost_minor??null,market)),[delivery,D]=useState(format(row.review?.delivery_cost_minor??null,market)),[other,O]=useState(format(row.review?.other_cost_minor??null,market)),[price,P]=useState(format(row.review?.proposed_price_minor??null,market)),[decision,Q]=useState<ReviewDecision>(row.review?.decision??"pending");
 const [returns,R]=useState(""),[ads,A]=useState(""),[rate,T]=useState("");
 const [busy,B]=useState(false),[message,M]=useState("");
 const [version,V]=useState<string|null>(row.review?.updated_at??null);
 let economics:ReturnType<typeof evaluateCodEvidence>|null=null;
 try{economics=evaluateCodEvidence({price:amount(price,market),supplierCost:amount(supplier,market),outboundDelivery:amount(delivery,market),deliveredFees:amount(other,market),returnCost:amount(returns,market),adCost:amount(ads,market),deliveryBps:rate.trim()===""?null:Math.round(Number(rate)*100)});}catch{/* invalid draft input remains incomplete */}
 async function submit(e:FormEvent){e.preventDefault();B(true);M("");try{const revision=await save({supplier:amount(supplier,market),delivery:amount(delivery,market),other:amount(other,market),price:amount(price,market),decision,expectedAt:version});V(revision);M("Commercial review saved. Scenario assumptions are not saved.");}catch{M("Review could not be saved. It may have changed on another device; reload before retrying.");}finally{B(false)}}
 const fields=[["Supplier cost",supplier,S],["Delivery cost",delivery,D],["Delivered fees",other,O],["Proposed price",price,P]] as const;
 return <article className="space-y-3 rounded-xl border p-4"><h3 dir="auto" className="font-bold">{row.title}</h3><p className="break-all text-xs">{row.supplier_sku} · {row.source_stock_status??"unknown"} · {row.observed_at}</p><p>Observed supplier price: {formatObservedSupplierPrice(market,row.observed_price_minor)}</p>
 <form onSubmit={submit} className="space-y-3"><fieldset disabled={busy} className="grid grid-cols-2 gap-3">{fields.map(([label,value,set])=><label key={label} className="text-sm">{label}<input inputMode="decimal" className="block w-full rounded border p-2" value={value} onChange={e=>set(e.target.value)} placeholder="Unknown"/></label>)}<label className="text-sm">Decision<select className="block w-full rounded border p-2" value={decision} onChange={e=>Q(e.target.value as ReviewDecision)}><option value="pending">Pending</option><option value="shortlisted">Shortlisted</option><option value="rejected">Rejected</option></select></label></fieldset>
 <fieldset className="space-y-2 rounded border p-3"><legend className="text-sm font-bold">Unsaved COD scenario</legend>{([["Failed-order extra cost",returns,R],["Advertising per submitted order",ads,A],["Successful delivery %",rate,T]] as const).map(([label,value,set])=><label key={label} className="block text-sm">{label}<input inputMode="decimal" className="block w-full rounded border p-2" value={value} onChange={e=>set(e.target.value)} placeholder="Unknown"/></label>)}{economics?.state==="evaluated"?<div className="text-sm">{economics.scenarios.map((s,i)=><p key={i}>{s.deliveryBps/100}% delivered: {format(Number(s.expectedContributionMinor),market)} {markets[market].currency}</p>)}<p>Break-even: {economics.breakEvenDeliveryBps===null?"Unreachable":economics.breakEvenDeliveryBps/100+"%"}</p></div>:<p className="text-sm">Enter all valid amounts to calculate expected contribution.</p>}</fieldset>
 <button disabled={busy} className="rounded bg-primary px-4 py-2 text-primary-foreground">Save review</button><p role="status" className="text-sm">{message}</p></form></article>
}

function ReadinessView({value}:{value?:CatalogReadiness}){
 if(!value)return <p className="mt-2 text-sm text-muted-foreground">Readiness not available yet.</p>;
 return <details className="mt-2 rounded border p-3 text-sm"><summary className="cursor-pointer font-semibold">Catalog readiness · {value.blockers.length} blocker(s)</summary>
 {value.listing_id&&<p className="mt-2 break-all">Listing: {value.listing_id} · {value.listing_status??"unknown"}</p>}
 {value.blockers.length===0?<p className="mt-2">No advisory blockers reported. Release still requires a server transaction.</p>:<ul className="mt-2 list-inside list-disc">{value.blockers.map(reason=><li key={reason}>{reason.replaceAll("_"," ")}</li>)}</ul>}</details>;
}
