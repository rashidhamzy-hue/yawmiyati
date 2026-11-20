import { createFileRoute } from "@tanstack/react-router";
import {BarChart3,Boxes,ClipboardCheck,ShieldCheck,Settings2,ChartNoAxesCombined,Store,LockKeyhole,ExternalLink,Sparkles,PackageSearch,Wallet,MapPin} from "lucide-react";
import { useState, useRef, useMemo, type FormEvent } from "react";
import { dashboardClient, type DashboardSummary, type MarketPerformance, type CatalogRow, type Recommendation, type AiPolicy } from "../lib/store/dashboard-client";
import { CommercialReview } from "@/components/store/CommercialReview";
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
 const [performance,setPerformance]=useState<MarketPerformance|null>(null);
 const [recommendations,setRecommendations]=useState<Recommendation[]>([]);
 const [policy,setPolicy]=useState<AiPolicy|null>(null);
 const [catalog,setCatalog]=useState<CatalogRow[]>([]);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const generation=useRef(0);
 const origin=import.meta.env.VITE_YAWMIYATI_SUPABASE_URL;
 const key=import.meta.env.VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY;
 const reviewClient=useMemo(()=>{try{return dashboardClient(origin,key)}catch{return null}},[origin,key]);
 async function load(next:MarketCode,access:string){
  const id=++generation.current;setBusy(true);setError("");setData(null);setPerformance(null);setCatalog([]);setRecommendations([]);setPolicy(null);
  try{const client=dashboardClient(origin,key);const [result,rows,recs,ai,perf]=await Promise.all([client.summary(access,next),client.catalog(access,next),client.recommendations(access,next),client.policy(access,next),client.performance(access,next)]);if(id===generation.current){setPerformance(perf);setData(result);setCatalog(rows);setRecommendations(recs);setPolicy(ai);}}
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
 return <main dir="ltr" className="min-h-screen bg-background text-foreground pb-16">
 <div className="border-b border-border bg-card"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 md:px-8"><a href="/sa" className="text-2xl font-extrabold tracking-tight text-primary">yawmiyati<span className="text-gold">.</span><span className="ml-3 rounded-full bg-primary-soft px-3 py-1 align-middle text-[11px] font-bold uppercase tracking-wider text-primary">OS</span></a><span className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold text-muted-foreground"><LockKeyhole className="h-4 w-4 text-primary"/> Private owner workspace</span></div></div><div className="mx-auto max-w-7xl space-y-7 px-4 pt-7 md:px-8">
 <header className="rounded-[2rem] bg-gradient-to-r from-primary via-primary to-[#073c3f] px-6 py-9 text-primary-foreground sm:px-9"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-white/80"><Sparkles className="h-4 w-4"/> CONTROL CENTER</p><h1 className="font-display text-3xl font-extrabold sm:text-4xl">Yawmiyati OS</h1><p className="mt-3 max-w-xl text-sm leading-7 text-white/80">Five country workspaces. Verified catalog evidence, order operations, performance and owner approvals in one place.</p></div>{token&&<button className="rounded-full border border-white/40 px-5 py-3 text-sm font-semibold hover:bg-white/10" onClick={signOut}>Sign out</button>}</div></header>
 {!origin||!key?<section role="status" className="space-y-7 rounded-[2rem] border bg-card p-6 shadow-soft sm:p-9">
 <div className="flex items-start gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary"><Settings2 className="h-7 w-7"/></span><div><h2 className="text-2xl font-extrabold">Connect the owner dashboard</h2><p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">The project database exists, but this Lovable preview does not have its public Supabase URL and publishable key configured. No private records or invented performance numbers are displayed.</p></div></div>
 <div className="grid gap-3 sm:grid-cols-3">{[["1","Public project URL","VITE_YAWMIYATI_SUPABASE_URL"],["2","Publishable key only","VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY"],["3","Owner sign-in","Verified member access required"]].map(([n,t,d])=><div key={n} className="rounded-2xl border bg-background p-5"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{n}</span><h3 className="mt-4 text-sm font-bold">{t}</h3><p className="mt-2 break-words text-xs leading-6 text-muted-foreground">{d}</p></div>)}</div>
 <a href="https://supabase.com/dashboard/project/skhtunkknshvolturqlm/settings/api-keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-primary px-5 py-3 text-sm font-semibold text-primary hover:bg-primary-soft">Open this project's public API settings <ExternalLink className="h-4 w-4"/></a>
 <p className="text-xs leading-6 text-muted-foreground">Do not enter a service-role key into a browser variable. The connection remains private and market-authorized after sign-in.</p>
 </section>:!token?
 <form onSubmit={signIn} className="mx-auto max-w-md space-y-5 rounded-[2rem] border bg-card p-7 shadow-soft sm:p-9">
 <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary"><LockKeyhole className="h-6 w-6"/></div><h2 className="text-2xl font-extrabold">Owner sign in</h2><p className="text-sm text-muted-foreground">Use your authorized Supabase account to access real market data.</p>
 <label className="block">Email<input className="block w-full rounded border p-3" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label className="block">Password<input className="block w-full rounded border p-3" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <button disabled={busy} className="w-full rounded-lg bg-primary p-3 text-primary-foreground">{busy?"Signing in…":"Sign in"}</button>
 </form>:<>
 <nav aria-label="Dashboard sections" className="flex gap-2 overflow-x-auto rounded-2xl border bg-card p-2 text-xs font-bold">{[["Overview","#overview"],["Performance","#performance"],["Catalog","#catalog"],["AI approvals","#approvals"],["Safety","#safety"]].map(([name,href])=><a href={href} key={href} className="shrink-0 rounded-full px-4 py-2.5 text-primary hover:bg-primary-soft">{name}</a>)}</nav><label className="block">Market<select disabled={busy} className="ml-3 rounded border p-3" value={market} onChange={e=>{const next=e.target.value as MarketCode;setMarket(next);void load(next,token);}}>{Object.keys(markets).map(m=><option key={m} value={m}>{names[m as MarketCode]}</option>)}</select></label>
 {busy&&<p role="status">Loading verified database totals…</p>}
 {data&&<><div id="overview" className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[["Recorded orders",String(data.orders)],["Customers",String(data.customers)],["Recorded net (minor units)",data.recorded_net_minor+" "+data.currency]].map(([label,value])=><section key={label} className="rounded-[1.5rem] border bg-card p-5 shadow-soft"><h2 className="text-sm text-muted-foreground">{label}</h2><p className="mt-2 break-all text-2xl font-bold">{value}</p></section>)}</div><section className="rounded-xl border p-5"><h2 className="font-bold">Order status</h2>{Object.entries(data.order_statuses).map(([status,count])=><p key={status}>{status}: {count}</p>)}{!Object.keys(data.order_statuses).length&&<p>No orders yet.</p>}</section></>}
 {performance&&<section id="performance" className="space-y-4 rounded-[1.75rem] border bg-card p-6 shadow-soft"><h2 className="text-xl font-bold">Recorded performance · last {performance.window_days} days</h2>
 <div className="grid gap-3 sm:grid-cols-3">{[["Recorded orders",performance.orders.recorded],["Delivered statuses",performance.orders.delivered],["Failed statuses",performance.orders.failed],["Returned statuses",performance.orders.returned],["Cancelled statuses",performance.orders.cancelled],["Ledger entries",performance.ledger.entries],["Recorded net · minor units",performance.ledger.recorded_net_minor],["Observed ad spend · minor units",performance.marketing_observations.spend_minor],["Marketing observations",performance.marketing_observations.records]].map(([label,value])=><div key={String(label)} className="rounded border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="break-all text-xl font-bold">{value}</p></div>)}</div>
 <ul className="list-inside list-disc text-xs text-muted-foreground">{performance.warnings.map(w=><li key={w}>{w}</li>)}</ul></section>}
 {data&&reviewClient&&<CommercialReview key={market} client={reviewClient} token={token} market={market}/>}
 {data&&<section id="catalog" className="rounded-[1.75rem] border bg-card p-6 shadow-soft"><h2 className="text-xl font-bold">Product catalog</h2><p className="text-sm text-muted-foreground">First 50 listings · Read only</p>{catalog.length===0?<p className="mt-4">No supplier listings imported yet.</p>:<div className="overflow-x-auto"><table className="mt-4 w-full text-left text-sm"><thead><tr><th>Product</th><th>Status</th><th>Variants</th><th>Recently available</th></tr></thead><tbody>{catalog.map(row=><tr key={row.listing_id} className="border-t"><td className="py-3">{row.title}</td><td>{row.listing_status}</td><td>{row.variant_count}</td><td>{row.available_count}</td></tr>)}</tbody></table></div>}</section>}
 {data&&<section id="approvals" className="rounded-[1.75rem] border bg-card p-6 shadow-soft space-y-3"><h2 className="text-xl font-bold">Owner approvals</h2><p className="text-sm text-muted-foreground">Decisions are recorded only; nothing is published automatically.</p>{recommendations.length===0&&<p>No recommendations yet.</p>}{recommendations.map(r=><article key={r.id} className="rounded border p-4 space-y-2"><h3 className="font-bold">{r.kind} · {r.state}</h3><p>{r.rationale}</p><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(r.proposal,null,2)}</pre>{r.state==="pending"&&<div className="flex gap-2"><button disabled={busy} className="rounded border p-3" onClick={()=>void review(r.id,"approved")}>Approve proposal</button><button disabled={busy} className="rounded border p-3" onClick={()=>void review(r.id,"rejected")}>Reject</button></div>}</article>)}</section>}
 {policy&&<section id="safety" className="rounded-[1.75rem] border bg-card p-6 shadow-soft space-y-2"><h2 className="font-bold">Automation safety</h2><p>AI: {policy.enabled?"Enabled":"Disabled"} · Daily limit: ${(policy.daily_budget_microusd/1000000).toFixed(2)} USD</p><p>Automatic pricing: {policy.auto_pricing_enabled?"On":"Off"} · Publishing: {policy.auto_publish_enabled?"On":"Off"}</p><button disabled={busy} onClick={()=>void pauseAi()} className="rounded border p-3">Pause market automation</button></section>}
 <p className="text-sm text-muted-foreground">Recorded net is not verified settlement profit. Real fulfillment is disabled in staging.</p>
 </>}
 {error&&<p role="alert" className="rounded border p-3">{error}</p>}
 </div></main>;
}
