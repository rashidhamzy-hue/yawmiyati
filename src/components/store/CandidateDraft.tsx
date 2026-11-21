import {useEffect,useState} from "react";
import {dashboardClient,type CandidateRow,type CandidateContentState} from "@/lib/store/dashboard-client";
import type {MarketCode} from "@/lib/store/markets";
type Client=ReturnType<typeof dashboardClient>;
export function CandidateDraft({client,token,market,row,pageOffset}:{client:Client;token:string;market:MarketCode;row:CandidateRow;pageOffset:number}){
 const [open,setOpen]=useState(false);
 return <div className="mt-3 border-t pt-3"><button type="button" className="rounded border px-3 py-2" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>{open?"Close content workspace":"Content and catalog draft"}</button>{open&&<Workspace client={client} token={token} market={market} row={row} pageOffset={pageOffset}/>}</div>;
}
function Workspace({client,token,market,row,pageOffset}:{client:Client;token:string;market:MarketCode;row:CandidateRow;pageOffset:number}){
 const [state,S]=useState<CandidateContentState|null>(null),[title,T]=useState(row.title),[description,D]=useState("");
 const [reviewAt,R]=useState<string|null>(null),[eligible,E]=useState(false),[blockers,G]=useState<string[]|null>(null);
 const [busy,B]=useState(false),[message,M]=useState(""),[ack,A]=useState(false),[publishAck,PA]=useState(false);
 async function load(){
  const [content,rows,gates]=await Promise.all([client.candidateContent(token,market,row.woo_product_id),client.candidates(token,market,pageOffset),client.readiness(token,market)]);
  S(content);T(content.approval?.title??row.title);D(content.approval?.description??"");
  const review=rows.find(x=>x.woo_product_id===row.woo_product_id)?.review;
  R(review?.updated_at??null);
  E(review?.decision==="shortlisted"&&review.supplier_cost_minor!==null&&review.delivery_cost_minor!==null&&review.other_cost_minor!==null&&review.proposed_price_minor!==null);
  G(gates.find(x=>x.woo_product_id===row.woo_product_id)?.blockers??null);
 }
 useEffect(()=>{let alive=true;B(true);Promise.all([client.candidateContent(token,market,row.woo_product_id),client.candidates(token,market,pageOffset),client.readiness(token,market)]).then(([content,rows,gates])=>{
  if(!alive)return;S(content);T(content.approval?.title??row.title);D(content.approval?.description??"");
  const review=rows.find(x=>x.woo_product_id===row.woo_product_id)?.review;R(review?.updated_at??null);
  E(review?.decision==="shortlisted"&&review.supplier_cost_minor!==null&&review.delivery_cost_minor!==null&&review.other_cost_minor!==null&&review.proposed_price_minor!==null);
  G(gates.find(x=>x.woo_product_id===row.woo_product_id)?.blockers??null);
 }).catch(()=>{if(alive)M("Workspace unavailable. Check current staging migrations.");}).finally(()=>{if(alive)B(false)});return()=>{alive=false};},[client,token,market,row.woo_product_id,row.title,pageOffset]);
 async function approve(){B(true);M("");try{await client.approveContent(token,market,row.woo_product_id,row.observed_at,title,description);await load();A(false);PA(false);M("Approved content revision. Nothing published.");}catch{M("Approval failed. Supplier observation may have changed.");}finally{B(false)}}
 async function draft(){if(!state?.approval||!reviewAt)return;B(true);M("");try{await client.createDraft(token,market,row.woo_product_id,reviewAt,state.approval.revision_id);await load();M("Private draft created. Publication remains gated.");}catch{M("Draft creation failed. Reload source data and commercial review.");}finally{B(false)}}
 async function publish(){if(!state?.draft||!publishAck||!blockers||blockers.length)return;B(true);M("");try{await client.publishDraft(token,market,row.woo_product_id,state.draft.listing_id);PA(false);await load();M("Publication recorded by the server. Verify public visibility separately.");}catch{M("Release refused by the server. Stock, approvals, or market authorization may have changed.");}finally{B(false)}}
 const unchanged=state?.approval?.title===title.trim()&&state.approval.description===description.trim()&&Date.parse(state.approval.source_observed_at)===Date.parse(row.observed_at);
 return <section className="mt-3 space-y-3 rounded border p-3">
  <h4 className="font-bold">Owner-approved content and release</h4>
  <p className="text-sm">Verify factual claims against evidence. AI drafts and shortlists do not publish automatically.</p>
  {state?.draft?<p className="text-sm break-all">Private listing: {state.draft.listing_id}. Editing this draft requires a separate reviewed workflow.</p>:<>
   <label className="block text-sm">Product title<input maxLength={500} className="block w-full rounded border p-2" dir="auto" value={title} onChange={e=>{T(e.target.value);A(false)}} disabled={busy}/></label>
   <label className="block text-sm">Product description<textarea maxLength={10000} rows={5} className="block w-full rounded border p-2" dir="auto" value={description} onChange={e=>{D(e.target.value);A(false)}} disabled={busy}/></label>
   <label className="flex gap-2 text-sm"><input type="checkbox" checked={ack} onChange={e=>A(e.target.checked)} disabled={busy}/> I verified the claims and approve this exact content revision.</label>
   <div className="flex flex-wrap gap-2"><button type="button" disabled={busy||!state||!ack||!title.trim()||!description.trim()} onClick={()=>void approve()} className="rounded border px-3 py-2">Approve content</button><button type="button" disabled={busy||!unchanged||!eligible||!reviewAt} onClick={()=>void draft()} className="rounded bg-primary px-3 py-2 text-primary-foreground">Create private draft</button></div>
   {!eligible&&<p className="text-xs">Save a complete shortlisted commercial review and reopen this workspace.</p>}
   {state?.approval&&<p className="text-xs">{unchanged?"Current approved revision":"Approved revision differs from edited or source content."}</p>}
  </>}
  <div className="rounded border p-3 text-sm"><p className="font-semibold">Server release readiness</p>
   {blockers===null?<p>Not loaded — publication unavailable.</p>:blockers.length?<ul className="mt-2 list-inside list-disc">{blockers.map(reason=><li key={reason}>{reason.replaceAll("_"," ")}</li>)}</ul>:<p>Advisory readiness complete; server checks again in the publishing transaction.</p>}
   {state?.draft&&<><label className="mt-3 flex items-center gap-2"><input type="checkbox" disabled={busy||blockers===null||blockers.length>0} checked={publishAck} onChange={e=>PA(e.target.checked)}/> I explicitly authorize publishing this product in {market.toUpperCase()}.</label>
   <button type="button" className="mt-2 rounded border px-3 py-2" disabled={busy||!publishAck||blockers===null||blockers.length>0} onClick={()=>void publish()}>Publish approved listing</button></>}
  </div>
  <p role="status" className="text-sm">{busy?"Working…":message}</p>
 </section>;
}
