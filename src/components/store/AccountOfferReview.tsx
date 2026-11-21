import { useState } from "react";
import { markets, type MarketCode } from "../../lib/store/markets";
import type { dashboardClient } from "../../lib/store/dashboard-client";

type Proposal={schema:string;demo:boolean;market:MarketCode;sku:string;title:string;revision:string;priceMinor:number;expectedContributionMinor:string;components:{id:string;quantity:number}[]};
type Saved={sequence:string;approved:boolean;proposal:Proposal};
function parseProposal(text:string,market:MarketCode):Proposal{
  if(text.length>30000)throw Error();
  const p=JSON.parse(text);
  if(p?.schema!=="yawmiyati-offer-1"||p.demo!==false||p.market!==market||typeof p.sku!=="string"||!p.sku.trim()||
    typeof p.title!=="string"||!p.title.trim()||!/^[a-f0-9]{64}$/.test(p.revision)||
    !Number.isSafeInteger(p.priceMinor)||p.priceMinor<1||!/^\d{1,16}$/.test(p.expectedContributionMinor)||BigInt(p.expectedContributionMinor)<1n||
    !Array.isArray(p.components)||!p.components.length||p.components.some((c:Proposal["components"][number])=>!c||typeof c.id!=="string"||!c.id.trim()||!Number.isSafeInteger(c.quantity)||c.quantity<1))throw Error();
  return p;
}
export function AccountOfferReview({client,token,market}:{client:ReturnType<typeof dashboardClient>;token:string;market:MarketCode}){
  const [text,setText]=useState(""),[sku,setSku]=useState(""),[preview,setPreview]=useState<Proposal|null>(null);
  const [saved,setSaved]=useState<Saved|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function load(fromFile:boolean){
    setBusy(true);setPreview(null);setSaved(null);setMessage("");
    try{
      const p=fromFile?parseProposal(text,market):null;
      const latest=await client.offerDecision(token,market,p?.sku??sku.trim()) as Saved|null;
      const checked=latest?parseProposal(JSON.stringify(latest.proposal),market):null;
      setSaved(latest);setPreview(p??checked);if(!p&&!checked)setMessage("No saved decision for this SKU.");
    }catch{setMessage("Could not load this proposal. Check the market, SKU and account configuration.");}
    finally{setBusy(false);}
  }
  async function decide(approved:boolean){
    if(!preview)return;
    setBusy(true);
    try{const result=await client.saveOfferDecision(token,market,preview,approved,saved?.sequence??"0");setSaved(result);setMessage("Decision saved to your account.");}
    catch{setPreview(null);setMessage("Save failed. Reload the latest decision before retrying.");}
    finally{setBusy(false);}
  }
  const amount=(value:number|string)=>{const digits=markets[market].minorDigits;const units=BigInt(value),scale=10n**BigInt(digits);
    return (units/scale)+"."+(units%scale).toString().padStart(digits,"0")+" "+markets[market].currency;};
  const same=saved?.proposal.revision===preview?.revision;
  return <details className="rounded-xl border p-4"><summary>Account offer decisions</summary>
    <div className="mt-3 grid gap-3"><label>Find a saved SKU<input className="block w-full rounded border p-2" value={sku} disabled={busy} onChange={e=>setSku(e.target.value)}/></label>
    <button disabled={!sku.trim()||busy} onClick={()=>void load(false)}>Find decision</button>
    <label>Paste an account proposal from catalog review<textarea className="block w-full rounded border p-2" maxLength={30000} value={text} disabled={busy} onChange={e=>setText(e.target.value)}/></label>
    <button disabled={!text.trim()||busy} onClick={()=>void load(true)}>Review offer</button>
    {preview&&<article><h3 dir="auto">{preview.title}</h3><p>{preview.sku} · {preview.components.map(p=>p.quantity+" × "+p.id).join(" + ")}</p>
    <p>Price {amount(preview.priceMinor)} · Expected contribution {amount(preview.expectedContributionMinor)}</p>
    <p>{same?(saved?.approved?"Approved":"Revoked"):"Awaiting decision"}</p>
    <button disabled={busy||(same&&saved?.approved)} onClick={()=>void decide(true)}>Approve this offer</button>
    {same&&saved?.approved&&<button disabled={busy} onClick={()=>void decide(false)}>Revoke approval</button>}</article>}
    <p role="status">{message}</p></div></details>;
}
