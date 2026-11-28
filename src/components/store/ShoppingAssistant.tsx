import {offerFixturesRequested,previewCatalogActive} from "@/lib/store/offer-source";
import {publicBrowserConfig} from "@/lib/store/staging-public-config";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {Bot,Check,MessageCircle,Send,ShieldCheck,ShoppingBag,X} from "lucide-react";
import type {MarketCode} from "@/lib/store/markets";
import {formatPrice,type PublicListing} from "@/lib/store/public-catalog";
import {assistantAnswer,countryName,humanLink,marketGreeting,type AssistantLink,type AssistantMessage} from "@/lib/store/shop-assistant";
import {assistantCopy} from "@/lib/store/assistant-copy";
import {ASSISTANT_EVENT} from "@/lib/store/assistant-open";
import {productMediaPath} from "@/lib/store/product-media";
import {addToCart} from "@/lib/store/shop-cart";
import {useStoreCatalog} from "@/lib/store/store-catalog";
import {useStoreOffers} from "@/lib/store/store-offers";
import {track} from "@/lib/analytics/analytics";

// Paid answers need three switches: this public flag, the server secret and the market's budget row. All off until launch.
const apiEnabled=!offerFixturesRequested && import.meta.env.VITE_YAWMIYATI_SHOP_ASSISTANT_API_ENABLED==="true";
const {origin:supabaseUrl,key:publishableKey}=publicBrowserConfig(import.meta.env.VITE_YAWMIYATI_SUPABASE_URL,import.meta.env.VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY);
type ServerReply={reply:string;products:string[];add_to_cart:string|null;handover:boolean};
/** The paid answer, or null when the server says "answer locally" (policy question, budget spent, switched off, unverified reply). */
async function requestAssistance(question:string,market:MarketCode,history:AssistantMessage[],pageTitle:string|null,signal:AbortSignal):Promise<ServerReply|null>{
 if(!apiEnabled||!supabaseUrl||!publishableKey)return null;
 const base=new URL(supabaseUrl);
 if(base.protocol!=="https:"||base.pathname!=="/"||base.search||base.hash)return null;
 const response=await fetch(new URL("/functions/v1/yawmiyati-shopping-assistant",base),{
  method:"POST",headers:{"content-type":"application/json","apikey":publishableKey,"authorization":"Bearer "+publishableKey},
  body:JSON.stringify({market,message:question,history:history.slice(-6).map(m=>({role:m.role,text:m.text.slice(0,500)})),...(pageTitle?{page:{title:pageTitle.slice(0,300)}}:{})}),
  cache:"no-store",redirect:"error",signal
 });
 if(!response.ok)return null;
 const data:unknown=await response.json();
 if(!data||typeof data!=="object"||(data as {fallback?:unknown}).fallback===true)return null;
 const d=data as Record<string,unknown>;
 if(typeof d["reply"]!=="string"||!d["reply"].trim()||d["reply"].length>900)return null;
 return {reply:d["reply"].trim(),products:(Array.isArray(d["products"])?d["products"]:[]).filter((s):s is string=>typeof s==="string").slice(0,3),
  add_to_cart:typeof d["add_to_cart"]==="string"?d["add_to_cart"]:null,handover:d["handover"]===true};
}

function ProductCard({item,market,primary}:{item:PublicListing;market:MarketCode;primary:boolean}){
 const copy=assistantCopy(market),[added,setAdded]=useState(false);
 const add=()=>{addToCart(market,{kind:"item",listing_id:item.listing_id,slug:item.slug,title:item.title,image:item.image??null,quantity:1});setAdded(true);
  track("add_to_cart",{market,slug:item.slug,quantity:1,value_minor:item.price_minor,source:"assistant"});};
 const hint=item.delivery_included?copy.deliveryFreeHint:item.offer?copy.offerHint:item.kind==="bundle"?copy.setHint:item.is_new?copy.newHint:"";
 return <li className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2" data-assistant-product={item.slug}>
  <a href={`/${market}/p/${encodeURIComponent(item.slug)}`} className="h-14 w-14 flex-none overflow-hidden rounded-xl bg-surface" tabIndex={-1} aria-hidden="true">{item.image&&<img src={productMediaPath(item.image,360)} alt="" width={56} height={56} loading="lazy" decoding="async" className="h-full w-full object-cover"/>}</a>
  <div className="min-w-0 flex-1"><a href={`/${market}/p/${encodeURIComponent(item.slug)}`} className="line-clamp-2 text-[13px] font-medium leading-5 hover:underline">{item.title}</a>
   <p className="mt-0.5 text-xs"><span className="ym-price text-sm">{formatPrice(item.price_minor,market)}</span>{hint&&<span className="ms-2 text-muted-foreground">{hint}</span>}</p></div>
  <button type="button" onClick={add} disabled={added} aria-label={(added?copy.added:copy.addToCart)+": "+item.title} className={"grid h-11 w-11 flex-none place-items-center rounded-full "+(added?"bg-success/10 text-success":primary?"bg-primary text-primary-foreground":"border border-border")}>{added?<Check className="h-4 w-4" aria-hidden="true"/>:<ShoppingBag className="h-4 w-4" aria-hidden="true"/>}</button>
 </li>;
}
const Links=({links}:{links:readonly AssistantLink[]})=><p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">{links.map(l=><a key={l.href} href={l.href} {...(l.external?{target:"_blank",rel:"noopener noreferrer"}:{})} className="font-bold underline underline-offset-4">{l.label}</a>)}</p>;

export function ShoppingAssistant({market,products,productPage}:{market:MarketCode;products:readonly PublicListing[];productPage?:boolean}){
 const copy=assistantCopy(market);
 const [open,setOpen]=useState(false);
 const [messages,setMessages]=useState<AssistantMessage[]>([{role:"assistant",text:marketGreeting(market)}]);
 const [draft,setDraft]=useState(""),[busy,setBusy]=useState(false);
 const scrollRef=useRef<HTMLDivElement>(null),inputRef=useRef<HTMLInputElement>(null),abortRef=useRef<AbortController|null>(null),queued=useRef("");
 // The catalogue the assistant recommends from: this page's rows when it has them, else the market's released catalogue.
 const catalog=useStoreCatalog(market,open&&!products.length),offers=useStoreOffers(market);
 const rows=products.length?products:catalog.state==="ready"?catalog.rows:[];
 useEffect(()=>{const el=scrollRef.current;if(el&&typeof el.scrollTo==="function")el.scrollTo({top:el.scrollHeight,behavior:"smooth"});},[messages,busy]);
 useEffect(()=>{if(open)inputRef.current?.focus();else {abortRef.current?.abort();setBusy(false);}},[open]);
 useEffect(()=>()=>abortRef.current?.abort(),[]);
 useEffect(()=>{document.body.classList.toggle("yawmiyati-assistant-open",open);return()=>document.body.classList.remove("yawmiyati-assistant-open");},[open]);
 useEffect(()=>{setMessages([{role:"assistant",text:marketGreeting(market)}]);setDraft("")},[market]);
 async function send(value:string,source:"typed"|"suggestion"|"page"="typed"){
  const question=value.trim();
  if(!question||busy||question.length>500)return;
  const history=messages.slice(-6);
  const controller=new AbortController();abortRef.current?.abort();abortRef.current=controller;
  setBusy(true);setDraft("");
  setMessages(prev=>[...prev.slice(-15),{role:"visitor",text:question}]);
  // The free, exact answer first; the paid model only improves product advice and is never needed for policies.
  const local=assistantAnswer(question,market,rows,offers.free_delivery?.threshold_minor??null);
  let answer:AssistantMessage={role:"assistant",text:local.text,products:local.products,links:local.links},paid=false;
  if(apiEnabled&&!previewCatalogActive()&&(local.intent==="products"||local.intent==="other")){
   try{
    const pageTitle=productPage?document.querySelector("main h1")?.textContent??null:null;
    const server=await requestAssistance(question,market,history,pageTitle,AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]));
    if(server){
     const bySlug=new Map(rows.map(r=>[r.slug,r])),human=humanLink(market);
     answer={role:"assistant",text:server.reply,products:server.products.map(s=>bySlug.get(s)).filter((r):r is PublicListing=>!!r),addSlug:server.add_to_cart,
      links:server.handover&&human?[{href:human,label:copy.humanLink,external:true}]:[]};paid=true;
    }
   }catch{ /* fail closed to the verified local answer */ }
  }
  if(controller.signal.aborted)return;
  // What was asked is never sent to analytics: only the kind of question and whether products were found.
  track("assistant_answer",{market,intent:local.intent,products:answer.products?.length??0,paid,source});
  setMessages(prev=>[...prev.slice(-15),answer]);setBusy(false);
 }
 // Other parts of the page can open the assistant, optionally with a first question (product page, empty search).
 useEffect(()=>{
  const onOpen=(e:Event)=>{const q=String((e as CustomEvent<{question?:string}>).detail?.question??"");setOpen(true);track("assistant_opened",{market,source:q?"page_question":"page"});if(q)queued.current=q;};
  window.addEventListener(ASSISTANT_EVENT,onOpen);return()=>window.removeEventListener(ASSISTANT_EVENT,onOpen);
 },[market]);
 useEffect(()=>{if(open&&queued.current&&!busy){const q=queued.current;queued.current="";void send(q,"page");}});
 function submit(e:FormEvent){e.preventDefault();void send(draft);}
 const toggle=()=>{setOpen(v=>{if(!v)track("assistant_opened",{market,source:"button"});return !v;});};
 return <div dir="rtl" data-shopping-assistant="" className={(productPage&&!open?"static mx-4 my-4 sm:fixed":"fixed")+" left-3 z-[70] sm:bottom-6 sm:left-6 "+(open?"bottom-[calc(.5rem+env(safe-area-inset-bottom))]":"bottom-[calc(5.25rem+env(safe-area-inset-bottom))]")}>
  {open&&<section role="dialog" aria-label={copy.title} aria-modal="false" onKeyDown={e=>{if(e.key==="Escape")setOpen(false)}} className="mb-3 flex h-[min(72dvh,560px)] max-h-[calc(100dvh-5rem)] w-[min(calc(100vw-24px),390px)] flex-col overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-2xl sm:h-[min(74dvh,580px)]">
   <header className="flex shrink-0 items-center gap-3 bg-primary p-4 text-primary-foreground"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><Bot className="h-6 w-6" aria-hidden="true"/></span><div className="min-w-0 flex-1"><h2 className="text-base font-extrabold">{copy.title}</h2><p className="mt-0.5 text-xs text-white/80">{copy.subtitle(countryName(market))}</p></div><button type="button" onClick={()=>setOpen(false)} className="tap grid place-items-center rounded-xl hover:bg-white/15" aria-label={copy.closeDialog}><X className="h-5 w-5" aria-hidden="true"/></button></header>
   <div className="flex items-center gap-2 border-b px-4 py-3 text-[11px] leading-5 text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true"/>{copy.privacy}</div>
   <div ref={scrollRef} aria-live="polite" aria-relevant="additions" className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
    {messages.map((m,i)=><div key={i} className={"flex "+(m.role==="visitor"?"justify-start":"justify-end")}><div className={"max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-7 "+(m.role==="visitor"?"rounded-tr-sm bg-primary text-primary-foreground":"rounded-tl-sm bg-muted text-foreground")}>
     <p className="whitespace-pre-wrap">{m.text}</p>
     {m.products&&m.products.length>0&&<ul className="mt-3 space-y-2">{m.products.map(p=><ProductCard key={p.listing_id} item={p} market={market} primary={m.addSlug===p.slug||m.products!.length===1}/>)}</ul>}
     {m.links&&m.links.length>0&&<Links links={m.links}/>}
    </div></div>)}
    {messages.length===1&&<div className="grid gap-2">{copy.suggestions.map(s=><button key={s} type="button" disabled={busy} onClick={()=>void send(s,"suggestion")} className="w-fit rounded-full border border-primary/20 bg-primary-soft px-3 py-2 text-right text-xs font-bold text-primary hover:border-primary">{s}</button>)}</div>}
    {busy&&<p role="status" className="text-xs text-muted-foreground">{copy.thinking}</p>}
   </div>
   <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t p-3"><input ref={inputRef} aria-label={copy.inputLabel} value={draft} onChange={e=>setDraft(e.target.value)} maxLength={500} placeholder={copy.placeholder} className="field min-w-0 flex-1 text-sm" disabled={busy}/><button type="submit" aria-label={copy.sendLabel} disabled={busy||!draft.trim()} className="tap grid place-items-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-40"><Send className="h-5 w-5 -scale-x-100" aria-hidden="true"/></button></form>
  </section>}
  <button type="button" onClick={toggle} aria-expanded={open} aria-label={open?copy.closeLabel:copy.openLabel} className={"group flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary "+(open?"min-h-11 px-4 py-2.5":"h-12 w-12 sm:h-14 sm:w-auto sm:px-5 sm:py-3")}>
   {open?<X className="h-6 w-6" aria-hidden="true"/>:<MessageCircle className="h-6 w-6" aria-hidden="true"/>}<span className={open?"text-xs sm:text-sm":"hidden text-sm sm:inline"}>{open?copy.closeLabel:copy.openLabel}</span>
  </button>
 </div>;
}
