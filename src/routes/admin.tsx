import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, type FormEvent } from "react";
import { dashboardClient, type DashboardSummary, type CatalogRow, type Recommendation, type AiPolicy } from "../lib/store/dashboard-client";
import { markets, type MarketCode } from "../lib/store/markets";
export const Route = createFileRoute("/admin")({
 head:()=>({meta:[{title:"Yawmiyati OS | Owner"},{name:"robots",content:"noindex,nofollow"}]}),
 component:OwnerDashboard,
});
const names:Record<MarketCode,string>={sa:"Saudi Arabia",ae:"UAE",om:"Oman",eg:"Egypt",iq:"Iraq"};
function OwnerDashboard(){
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [token,setToken]=useState("");
 const [market,setMarket]=useState<MarketCode>("sa");
 const [data,setData]=useState<DashboardSummary|null>(null);
 const [recommendations,setRecommendations]=useState<Recommendation[]>([]);
 const [policy,setPolicy]=useState<AiPolicy|null>(null);
 const [catalog,setCatalog]=useState<CatalogRow[]>([]);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const generation=useRef(0);
 const origin=import.meta.env.VITE_YAWMIYATI_SUPABASE_URL;
 const key=import.meta.env.VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY;
 async function load(next:MarketCode,access:string){
  const id=++generation.current;setBusy(true);setError("");setData(null);setCatalog([]);setRecommendations([]);setPolicy(null);
  try{const client=dashboardClient(origin,key);const [result,rows,recs,ai]=await Promise.all([client.summary(access,next),client.catalog(access,next),client.recommendations(access,next),client.policy(access,next)]);if(id===generation.current){setData(result);setCatalog(rows);setRecommendations(recs);setPolicy(ai);}}
  catch{if(id===generation.current)setError("Unable to load this market. Verify access or sign in again.");}
  finally{if(id===generation.current)setBusy(false);}
 }
 async function signIn(e:FormEvent){
  e.preventDefault();setBusy(true);setError("");
  try{const access=await dashboardClient(origin,key).signIn(email,password);setToken(access);await load(market,access);}
  catch{setError("Sign-in failed. Check your credentials and staging configuration.");setBusy(false);}
  finally{setPassword("");}
 }
 async function review(id:string,decision:"approved"|"rejected"){
  setBusy(true);setError("");
  try{await dashboardClient(origin,key).review(token,market,id,decision);await load(market,token);}
  catch{setError("Decision could not be recorded. Reload before retrying.");setBusy(false);}
 }
 async function pauseAi(){
  const id=generation.current;setBusy(true);
  try{await dashboardClient(origin,key).pauseAi(token,market);if(id===generation.current)await load(market,token);}
  catch{if(id===generation.current){setError("Pause request failed");setBusy(false);}}
 }
 function signOut(){generation.current++;setToken("");setData(null);setCatalog([]);setRecommendations([]);setPolicy(null);setError("");setBusy(false);}
 return <main dir="ltr" className="min-h-screen bg-background text-foreground p-4 md:p-8">
 <div className="mx-auto max-w-5xl space-y-6">
 <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-muted-foreground">Private staging workspace</p><h1 className="text-3xl font-bold">Yawmiyati OS</h1></div>{token&&<button className="rounded-lg border px-4 py-3" onClick={signOut}>End local session</button>}</header>
 {!origin||!key?<p role="status">Staging connection has not been configured.</p>:!token?
 <form onSubmit={signIn} className="mx-auto max-w-md space-y-4 rounded-xl border p-6">
 <h2 className="text-xl font-bold">Owner sign in</h2>
 <label className="block">Email<input className="block w-full rounded border p-3" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label className="block">Password<input className="block w-full rounded border p-3" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <button disabled={busy} className="w-full rounded-lg bg-primary p-3 text-primary-foreground">{busy?"Signing in…":"Sign in"}</button>
 </form>:<>
 <label className="block">Market<select disabled={busy} className="ml-3 rounded border p-3" value={market} onChange={e=>{const next=e.target.value as MarketCode;setMarket(next);void load(next,token);}}>{Object.keys(markets).map(m=><option key={m} value={m}>{names[m as MarketCode]}</option>)}</select></label>
 {busy&&<p role="status">Loading verified database totals…</p>}
 {data&&<><div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[["Recorded orders",String(data.orders)],["Customers",String(data.customers)],["Recorded net (minor units)",data.recorded_net_minor+" "+data.currency]].map(([label,value])=><section key={label} className="rounded-xl border p-5"><h2 className="text-sm text-muted-foreground">{label}</h2><p className="mt-2 break-all text-2xl font-bold">{value}</p></section>)}</div><section className="rounded-xl border p-5"><h2 className="font-bold">Order status</h2>{Object.entries(data.order_statuses).map(([status,count])=><p key={status}>{status}: {count}</p>)}{!Object.keys(data.order_statuses).length&&<p>No orders yet.</p>}</section></>}
 {data&&<section className="rounded-xl border p-5"><h2 className="text-xl font-bold">Product catalog</h2><p className="text-sm text-muted-foreground">First 50 listings · Read only</p>{catalog.length===0?<p className="mt-4">No supplier listings imported yet.</p>:<div className="overflow-x-auto"><table className="mt-4 w-full text-left text-sm"><thead><tr><th>Product</th><th>Status</th><th>Variants</th><th>Recently available</th></tr></thead><tbody>{catalog.map(row=><tr key={row.listing_id} className="border-t"><td className="py-3">{row.title}</td><td>{row.listing_status}</td><td>{row.variant_count}</td><td>{row.available_count}</td></tr>)}</tbody></table></div>}</section>}
 {data&&<section className="rounded-xl border p-5 space-y-3"><h2 className="text-xl font-bold">Owner approvals</h2><p className="text-sm text-muted-foreground">Decisions are recorded only; nothing is published automatically.</p>{recommendations.length===0&&<p>No recommendations yet.</p>}{recommendations.map(r=><article key={r.id} className="rounded border p-4 space-y-2"><h3 className="font-bold">{r.kind} · {r.state}</h3><p>{r.rationale}</p><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(r.proposal,null,2)}</pre>{r.state==="pending"&&<div className="flex gap-2"><button disabled={busy} className="rounded border p-3" onClick={()=>void review(r.id,"approved")}>Approve proposal</button><button disabled={busy} className="rounded border p-3" onClick={()=>void review(r.id,"rejected")}>Reject</button></div>}</article>)}</section>}
 {policy&&<section className="rounded-xl border p-5 space-y-2"><h2 className="font-bold">Automation safety</h2><p>AI: {policy.enabled?"Enabled":"Disabled"} · Daily limit: ${(policy.daily_budget_microusd/1000000).toFixed(2)} USD</p><p>Automatic pricing: {policy.auto_pricing_enabled?"On":"Off"} · Publishing: {policy.auto_publish_enabled?"On":"Off"}</p><button disabled={busy} onClick={()=>void pauseAi()} className="rounded border p-3">Pause market automation</button></section>}
 <p className="text-sm text-muted-foreground">Recorded net is not verified settlement profit. Real fulfillment is disabled in staging.</p>
 </>}
 {error&&<p role="alert" className="rounded border p-3">{error}</p>}
 </div></main>;
}
