import {EditorialImport} from "../components/store/EditorialImport";
import { AccountOfferReview } from "../components/store/AccountOfferReview";
import { OfferSelectionDemo } from "../components/owner/OfferSelectionDemo";
import {publicBrowserConfig} from "@/lib/store/staging-public-config";
import { createFileRoute } from "@tanstack/react-router";
import {AlertTriangle,BarChart3,Boxes,ChartNoAxesCombined,ClipboardCheck,ExternalLink,LockKeyhole,LogOut,PackageSearch,PauseCircle,RefreshCw,Settings2,ShieldCheck,ShoppingBag,Users,Wallet,type LucideIcon} from "lucide-react";
import { useState, useRef, useMemo, useEffect, type FormEvent, type ReactNode } from "react";
import { dashboardClient, type OwnerSession, type DashboardSummary, type MarketPerformance, type CatalogRow, type Recommendation, type AiPolicy } from "../lib/store/dashboard-client";
import { CommercialReview } from "@/components/store/CommercialReview";
import { OwnerActionQueue } from "@/components/store/OwnerActionQueue";
import { BrainPanel } from "@/components/owner/BrainPanel";
import { TaagerImport } from "@/components/owner/TaagerImport";
import { TaagerRules } from "@/components/owner/TaagerRules";
import { OffersPanel } from "@/components/owner/OffersPanel";
import { MorningBrief } from "@/components/owner/MorningBrief";
import { OrderQualityPanel } from "@/components/owner/OrderQualityPanel";
import { AssistantPanel } from "@/components/owner/AssistantPanel";
import { markets, type MarketCode } from "../lib/store/markets";
import {summarizeOwnerMarket,formatRecordedMinor} from "@/lib/store/owner-dashboard-presentation";
import {marketIdentity} from "@/lib/store/market-identity";
export const Route = createFileRoute("/admin")({
 head:()=>({meta:[{title:"Yawmiyati OS | Owner"},{name:"robots",content:"noindex,nofollow"}]}),
 component:OwnerDashboard,
});
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
 const [catalogHasMore,setCatalogHasMore]=useState(false);
 const [catalogNextOffset,setCatalogNextOffset]=useState(0);
 const [catalogLoading,setCatalogLoading]=useState(false);
 const [catalogPageError,setCatalogPageError]=useState("");
 const catalogPageInFlight=useRef(false);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const generation=useRef(0);
 const {origin,key}=publicBrowserConfig(import.meta.env["VITE_YAWMIYATI_SUPABASE_URL"],import.meta.env["VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY"]);
 const reviewClient=useMemo(()=>{try{return dashboardClient(origin,key)}catch{return null}},[origin,key]);
 const overview=useMemo(()=>summarizeOwnerMarket(market,data,performance,data?catalog:null,data?recommendations:null,policy),[market,data,performance,catalog,recommendations,policy]);
 async function load(next:MarketCode,access:string){
  const id=++generation.current;setBusy(true);setError("");setData(null);setPerformance(null);setCatalog([]);setCatalogHasMore(false);setCatalogNextOffset(0);setCatalogLoading(false);setCatalogPageError("");catalogPageInFlight.current=false;setRecommendations([]);setPolicy(null);
  try{const client=dashboardClient(origin,key);const [result,rows,recs,ai,perf]=await Promise.all([client.summary(access,next),client.catalog(access,next),client.recommendations(access,next),client.policy(access,next),client.performance(access,next)]);if(id===generation.current){setPerformance(perf);setData(result);setCatalog(rows);setCatalogNextOffset(rows.length);setCatalogHasMore(rows.length===50);setRecommendations(recs);setPolicy(ai);}}
  catch{if(id===generation.current)setError("Unable to load this market. Verify access or sign in again.");}
  finally{if(id===generation.current)setBusy(false);}
 }
 // Renew the owner session in memory shortly before it expires (refresh token never stored).
 const refreshTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const sessionGen=useRef(0);
 useEffect(()=>()=>{if(refreshTimer.current)clearTimeout(refreshTimer.current);},[]);
 function keepAlive(s:OwnerSession){
  if(refreshTimer.current)clearTimeout(refreshTimer.current);
  if(!s.refresh)return;
  const refresh=s.refresh;const gen=sessionGen.current;
  refreshTimer.current=setTimeout(async()=>{
   try{const next=await dashboardClient(origin,key).refreshSession(refresh);if(gen===sessionGen.current){setToken(next.access);keepAlive(next);}}
   catch{if(gen===sessionGen.current)setError("Your session ended. Sign in again.");}
  },Math.max(60,s.expiresIn-120)*1000);
 }
 async function signIn(e:FormEvent){
  e.preventDefault();setBusy(true);setError("");
  try{sessionGen.current++;const s=await dashboardClient(origin,key).signInSession(email,password);setToken(s.access);keepAlive(s);await load(market,s.access);}
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
 async function loadMoreCatalog(){
  if(!token||!data||!catalogHasMore||catalogLoading||catalogPageInFlight.current||busy)return;
  const currentGeneration=generation.current,selectedMarket=market,access=token,offset=catalogNextOffset;
  catalogPageInFlight.current=true;setCatalogLoading(true);setCatalogPageError("");
  try{
   const page=await dashboardClient(origin,key).catalog(access,selectedMarket,offset);
   if(currentGeneration!==generation.current)return;
   setCatalog(previous=>{
    const ids=new Set(previous.map(row=>row.listing_id));
    return [...previous,...page.filter(row=>{
     if(ids.has(row.listing_id))return false;
     ids.add(row.listing_id);return true;
    })];
   });
   setCatalogNextOffset(offset+page.length);
   setCatalogHasMore(page.length===50&&offset+page.length<=100000);
  }catch{if(currentGeneration===generation.current)setCatalogPageError("Could not load more catalog records. Retry after checking access.");}
  finally{if(currentGeneration===generation.current){catalogPageInFlight.current=false;setCatalogLoading(false);}}
 }
 function signOut(){generation.current++;sessionGen.current++;if(refreshTimer.current)clearTimeout(refreshTimer.current);setToken("");setData(null);setPerformance(null);setCatalog([]);setCatalogHasMore(false);setCatalogNextOffset(0);setCatalogLoading(false);setCatalogPageError("");catalogPageInFlight.current=false;setRecommendations([]);setPolicy(null);setError("");setBusy(false);}
 const signedIn=Boolean(token);
 const loading=busy&&!data;
 return <main dir="ltr" className="min-h-screen bg-background pb-20 text-foreground">
  <header className="border-b border-border bg-card/95">
   <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 md:px-8">
    <a href="/sa" className="text-xl font-extrabold tracking-tight text-primary">yawmiyati<span className="text-gold">.</span><span className="ml-2 rounded-full bg-primary-soft px-2.5 py-1 align-middle text-[10px] font-bold uppercase tracking-wider text-primary">Owner</span></a>
    {signedIn?<button type="button" onClick={signOut} className="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold hover:bg-muted"><LogOut className="h-4 w-4" aria-hidden="true"/>Sign out</button>
     :<span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground"><LockKeyhole className="h-4 w-4 text-primary" aria-hidden="true"/>Private</span>}
   </div>
  </header>
  <div className="mx-auto max-w-6xl space-y-6 px-4 pt-6 md:px-8">
  {!origin||!key?<ConnectionMissing/>:!signedIn?
   <form onSubmit={signIn} className="mx-auto mt-6 max-w-sm space-y-5 rounded-3xl border bg-card p-7 shadow-soft">
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary"><LockKeyhole className="h-6 w-6" aria-hidden="true"/></div>
    <div><h1 className="text-2xl font-extrabold">Owner sign in</h1><p className="mt-1 text-sm text-muted-foreground">Yawmiyati control center · all five stores</p></div>
    <Field label="Email"><input className={inputClass} type="email" inputMode="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></Field>
    <Field label="Password"><input className={inputClass} type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></Field>
    {error&&<p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
    <button disabled={busy} className="min-h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground transition-opacity disabled:opacity-60">{busy?"Signing in…":"Sign in"}</button>
   </form>:<>
   <div className="sticky top-0 z-20 -mx-4 space-y-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
    <div role="radiogroup" aria-label="Owner market selector" className="flex gap-2 overflow-x-auto pb-1">
     {(Object.keys(markets) as MarketCode[]).map(m=>{const active=m===market;return <button key={m} type="button" role="radio" aria-checked={active} disabled={busy&&!active}
      onClick={()=>{if(active)return;setMarket(m);void load(m,token);}}
      className={"inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors "+(active?"border-primary bg-primary text-primary-foreground":"bg-card hover:border-primary/40")}>
      <span aria-hidden="true">{marketIdentity[m].flag}</span>{names[m]}<span className={"text-[11px] font-semibold "+(active?"text-primary-foreground/75":"text-muted-foreground")}>{markets[m].currency}</span></button>;})}
    </div>
    <nav aria-label="Dashboard sections" className="flex gap-1 overflow-x-auto text-xs font-bold">{sections.map(([name,href])=><a href={href} key={href} className="shrink-0 rounded-full px-3 py-2 text-muted-foreground hover:bg-primary-soft hover:text-primary">{name}</a>)}</nav>
   </div>
   {error&&<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{error}</span><button type="button" onClick={()=>void load(market,token)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-destructive/40 px-4 font-semibold"><RefreshCw className="h-4 w-4" aria-hidden="true"/>Retry</button></div>}
   <section id="overview" aria-label="Market overview" aria-busy={loading} className="scroll-mt-32 space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-2"><h1 className="text-2xl font-extrabold">{marketIdentity[market].flag} {names[market]}</h1><span className="rounded-full border px-3 py-1 text-xs font-bold text-muted-foreground">Not launched · checkout off</span></div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
     <Stat icon={ShoppingBag} label="Recorded orders" value={data?String(data.orders):null} loading={loading}/>
     <Stat icon={Users} label="Customers" value={data?String(data.customers):null} loading={loading}/>
     <Stat icon={Wallet} label="Recorded net (ledger)" value={data?overview.recordedNet:null} loading={loading}/>
     <Stat icon={Boxes} label="Catalog records" value={overview.catalogCount===null?null:String(overview.catalogCount)+(catalogHasMore?"+":"")} loading={loading}/>
     <Stat icon={ClipboardCheck} label="Pending approvals" value={overview.pendingRecommendations===null?null:String(overview.pendingRecommendations)} loading={loading} highlight={(overview.pendingRecommendations??0)>0}/>
     <Stat icon={ShieldCheck} label="AI automation" value={policy?(policy.enabled?"On":"Off"):null} loading={loading}/>
    </div>
    {overview.alerts.length>0&&<details className="group rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950" aria-label="Needs attention">
     <summary className="flex cursor-pointer list-none items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true"/>{overview.alerts.length} note{overview.alerts.length===1?"":"s"} on this data<span className="ml-auto text-xs font-semibold text-amber-800 group-open:hidden">Show</span></summary>
     <ul className="mt-3 space-y-2">{overview.alerts.map((alert,i)=><li role="status" key={alert.code+":"+i}><p className="font-bold">{alert.title}</p><p className="opacity-80">{alert.detail}</p></li>)}</ul>
    </details>}
   </section>
   {origin&&key&&<TaagerImport key={"taager-"+market} market={market} origin={origin} publicKey={key} token={token}/>}
   {origin&&key&&<TaagerRules key={"rules-"+market} market={market} origin={origin} publicKey={key} token={token}/>}
   {origin&&key&&<MorningBrief key={"brief-"+market} market={market} origin={origin} publicKey={key} token={token}/>}
   {origin&&key&&<BrainPanel key={"brain-"+market} market={market} origin={origin} publicKey={key} token={token}/>}
   {origin&&key&&<OffersPanel key={"offers-"+market} market={market} origin={origin} publicKey={key} token={token}/>}
   {origin&&key&&<OrderQualityPanel key={"quality-"+market} market={market} origin={origin} publicKey={key} token={token}/>}
   {origin&&key&&<AssistantPanel key={"assistant-"+market} market={market} origin={origin} publicKey={key} token={token}/>}
   {data&&<OwnerActionQueue market={market} catalog={catalog} recommendations={recommendations} policy={policy}/>}
   {performance&&<Card id="performance" title={"Performance · last "+performance.window_days+" days"} icon={ChartNoAxesCombined}>
    <OrderOutcomes p={performance}/>
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{([["Ledger entries",String(performance.ledger.entries)],["Recorded net",formatRecordedMinor(market,performance.ledger.recorded_net_minor)],["Ad spend observed",formatRecordedMinor(market,performance.marketing_observations.spend_minor)],["Impressions",performance.marketing_observations.impressions],["Clicks",performance.marketing_observations.clicks],["Marketing records",String(performance.marketing_observations.records)]] as const).map(([label,value])=><div key={label} className="rounded-xl bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-all font-bold">{value}</p></div>)}</div>
    {performance.warnings.length>0&&<ul className="mt-3 space-y-1 text-xs text-muted-foreground">{performance.warnings.map(w=><li key={w}>• {w}</li>)}</ul>}
   </Card>}
   {data&&Object.keys(data.order_statuses).length>0&&<Card title="Order status (all time)" icon={BarChart3}><StatusBars statuses={data.order_statuses}/></Card>}
   {data&&<Card id="catalog" title="Product catalog" icon={PackageSearch} aside={<span className="text-xs text-muted-foreground">{catalog.length} loaded · read only</span>}>
    {catalog.length===0?<Empty text="No supplier listings imported yet for this market."/>:<>
     <ul className="divide-y md:hidden">{catalog.map(row=><li key={row.listing_id} className="py-3"><p dir="auto" className="font-semibold leading-6">{row.title}</p><p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><StatusBadge status={row.listing_status}/>{row.variant_count} variant(s) · {row.available_count} recently available</p></li>)}</ul>
     <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-2 font-semibold">Product</th><th className="font-semibold">Status</th><th className="font-semibold">Variants</th><th className="font-semibold">Recently available</th></tr></thead><tbody>{catalog.map(row=><tr key={row.listing_id} className="border-t"><td dir="auto" className="py-3 pr-4 text-start">{row.title}</td><td><StatusBadge status={row.listing_status}/></td><td>{row.variant_count}</td><td>{row.available_count}</td></tr>)}</tbody></table></div>
    </>}
    {catalogPageError&&<p role="alert" className="mt-3 text-sm text-destructive">{catalogPageError}</p>}
    {catalogHasMore&&<button type="button" onClick={()=>void loadMoreCatalog()} disabled={busy||catalogLoading} className="mt-4 min-h-11 w-full rounded-xl border px-4 text-sm font-bold text-primary hover:bg-primary-soft disabled:opacity-50 sm:w-auto">{catalogLoading?"Loading catalog…":"Load 50 more listings"}</button>}
    {!catalogHasMore&&catalog.length>0&&<p className="mt-3 text-xs text-muted-foreground">End of catalog records for this market.</p>}
   </Card>}
   {data&&<Card id="approvals" title="Owner approvals" icon={ClipboardCheck} aside={<span className="text-xs text-muted-foreground">Decisions are recorded; nothing publishes automatically</span>}>
    {recommendations.length===0?<Empty text="No recommendations waiting for this market."/>:<div className="space-y-3">{recommendations.map(r=><article key={r.id} className="rounded-2xl border bg-background p-4">
     <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold capitalize">{r.kind.replace(/_/g," ")}</h3><StatusBadge status={r.state}/></div>
     <p className="mt-2 text-sm leading-6">{r.rationale}</p>
     <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold text-primary">Proposal details</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-3">{JSON.stringify(r.proposal,null,2)}</pre></details>
     {r.state==="pending"&&<div className="mt-3 grid grid-cols-2 gap-2 sm:flex"><button disabled={busy} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50" onClick={()=>void review(r.id,"approved")}>Approve proposal</button><button disabled={busy} className="min-h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-50" onClick={()=>void review(r.id,"rejected")}>Reject</button></div>}
    </article>)}</div>}
   </Card>}
   {data&&reviewClient&&<section id="reviews" aria-label="Review workspaces" className="scroll-mt-32 space-y-6">
    <CommercialReview key={"commercial-"+market} client={reviewClient} token={token} market={market}/>
    <EditorialImport catalog={catalog} key={"editorial-"+market} market={market} client={reviewClient} token={token}/>
    <AccountOfferReview key={"offers-"+market} market={market} client={reviewClient} token={token}/>
   </section>}
   {policy&&<Card id="safety" title="Automation safety" icon={ShieldCheck}>
    <div className="flex flex-wrap gap-2 text-sm"><Pill on={policy.enabled} label="AI"/><Pill on={policy.auto_pricing_enabled} label="Auto pricing"/><Pill on={policy.auto_publish_enabled} label="Auto publishing"/><span className="rounded-full border px-3 py-1.5">Daily AI limit ${(policy.daily_budget_microusd/1000000).toFixed(2)}</span></div>
    <button disabled={busy} onClick={()=>void pauseAi()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-destructive/40 px-4 text-sm font-bold text-destructive hover:bg-destructive/5 disabled:opacity-50"><PauseCircle className="h-4 w-4" aria-hidden="true"/>Pause {names[market]} automation</button>
   </Card>}
   {data&&<details className="rounded-3xl border bg-card p-5 shadow-soft"><summary className="cursor-pointer text-sm font-bold">Offer storefront preview (test fixtures)</summary><div className="mt-4"><OfferSelectionDemo key={market} market={market}/></div></details>}
   <p className="text-xs leading-6 text-muted-foreground">Figures are recorded observations for the selected store, not settled profit. Nothing here publishes products, turns on checkout or sends orders to the supplier.</p>
  </>}
  </div>
 </main>;
}

const names:Record<MarketCode,string>={sa:"Saudi Arabia",ae:"UAE",om:"Oman",eg:"Egypt",iq:"Iraq"};
const sections=[["Overview","#overview"],["Brain","#brain"],["Performance","#performance"],["Catalog","#catalog"],["Approvals","#approvals"],["Reviews","#reviews"],["Safety","#safety"]] as const;
const inputClass="block h-12 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-primary/20";
function Field({label,children}:{label:string;children:ReactNode}){
 return <label className="block space-y-1.5 text-sm font-semibold"><span>{label}</span>{children}</label>;
}
function Card({id,title,icon:Icon,aside,children}:{id?:string;title:string;icon:LucideIcon;aside?:ReactNode;children:ReactNode}){
 return <section id={id} aria-label={title} className="scroll-mt-32 rounded-3xl border bg-card p-5 shadow-soft sm:p-6">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="inline-flex items-center gap-2 text-lg font-extrabold"><Icon className="h-5 w-5 text-primary" aria-hidden="true"/>{title}</h2>{aside}</div>
  {children}
 </section>;
}
function Stat({icon:Icon,label,value,loading,highlight=false}:{icon:LucideIcon;label:string;value:string|null;loading:boolean;highlight?:boolean}){
 return <div className={"rounded-2xl border p-4 "+(highlight?"border-primary/40 bg-primary-soft":"bg-card")}>
  <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Icon className="h-3.5 w-3.5" aria-hidden="true"/>{label}</p>
  {loading?<div className="mt-2 h-7 w-16 animate-pulse rounded-md bg-muted" aria-hidden="true"/>:<p className="mt-1.5 break-all text-xl font-extrabold sm:text-2xl">{value??"—"}</p>}
 </div>;
}
function OrderOutcomes({p}:{p:MarketPerformance}){
 const o=p.orders;
 const parts=[["Delivered",o.delivered,"bg-emerald-500"],["Returned",o.returned,"bg-amber-500"],["Failed",o.failed,"bg-rose-500"],["Cancelled",o.cancelled,"bg-slate-400"],["Other",o.unknown,"bg-slate-200"]] as const;
 const total=Math.max(o.recorded,parts.reduce((n,[,v])=>n+v,0));
 return <div>
  <p className="text-sm"><span className="text-2xl font-extrabold">{o.recorded}</span> <span className="text-muted-foreground">orders recorded</span></p>
  <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={parts.map(([l,v])=>l+" "+v).join(", ")}>{total>0&&parts.map(([l,v,c])=>v>0&&<span key={l} className={c} style={{width:(v/total*100)+"%"}}/>)}</div>
  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">{parts.map(([l,v,c])=><li key={l} className="inline-flex items-center gap-1.5"><span className={"h-2.5 w-2.5 rounded-full "+c} aria-hidden="true"/>{l} <b>{v}</b></li>)}</ul>
 </div>;
}
function StatusBars({statuses}:{statuses:Record<string,number>}){
 const rows=Object.entries(statuses).sort((a,b)=>b[1]-a[1]);const max=Math.max(1,...rows.map(([,v])=>v));
 return <ul className="space-y-2">{rows.map(([status,count])=><li key={status} className="grid grid-cols-[minmax(6rem,10rem)_1fr_2.5rem] items-center gap-3 text-sm"><span className="truncate capitalize text-muted-foreground" title={status.replace(/_/g," ")}>{status.replace(/_/g," ")}</span><span className="h-2.5 rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{width:(count/max*100)+"%"}}/></span><b className="text-right">{count}</b></li>)}</ul>;
}
function StatusBadge({status}:{status:string}){
 const tone=/approved|active|live|delivered|published/.test(status)?"bg-emerald-50 text-emerald-800 border-emerald-200":/pending|draft|review/.test(status)?"bg-amber-50 text-amber-900 border-amber-200":/reject|fail|retired|archived|paused/.test(status)?"bg-rose-50 text-rose-800 border-rose-200":"bg-muted text-foreground border-border";
 return <span className={"inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold capitalize "+tone}>{status.replace(/_/g," ")}</span>;
}
function Pill({on,label}:{on:boolean;label:string}){
 return <span className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold "+(on?"border-amber-300 bg-amber-50 text-amber-900":"bg-background")}><span className={"h-2 w-2 rounded-full "+(on?"bg-amber-500":"bg-slate-300")} aria-hidden="true"/>{label} {on?"on":"off"}</span>;
}
function Empty({text}:{text:string}){
 return <p className="rounded-2xl border border-dashed bg-background px-4 py-6 text-center text-sm text-muted-foreground">{text}</p>;
}
function ConnectionMissing(){
 return <section role="status" className="space-y-4 rounded-3xl border bg-card p-6 shadow-soft sm:p-8">
  <div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary"><Settings2 className="h-6 w-6" aria-hidden="true"/></span><div><h1 className="text-xl font-extrabold">Dashboard not connected</h1><p className="mt-1 text-sm leading-7 text-muted-foreground">This build has no public Supabase URL and publishable key, so no private records can load. Set <code className="rounded bg-muted px-1">VITE_YAWMIYATI_SUPABASE_URL</code> and <code className="rounded bg-muted px-1">VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY</code> (never a service-role key).</p></div></div>
  <a href="https://supabase.com/dashboard/project/skhtunkknshvolturqlm/settings/api-keys" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary px-5 text-sm font-semibold text-primary hover:bg-primary-soft">Open public API settings <ExternalLink className="h-4 w-4" aria-hidden="true"/></a>
 </section>;
}
