import {useEffect,useRef,useState,type FormEvent} from "react";
import {Bot,MessageCircle,Send,ShieldCheck,Sparkles,X} from "lucide-react";
import type {MarketCode} from "@/lib/store/markets";
import type {PublicListing} from "@/lib/store/public-catalog";
import {countryName,greeting,localShopAnswer,SHOP_ASSISTANT_SUGGESTIONS,type ShopMessage} from "@/lib/store/shop-assistant";

const apiEnabled=import.meta.env.VITE_YAWMIYATI_SHOP_ASSISTANT_API_ENABLED==="true";
const supabaseUrl=import.meta.env.VITE_YAWMIYATI_SUPABASE_URL;
const publishableKey=import.meta.env.VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY;
async function requestAssistance(question:string,market:MarketCode,history:ShopMessage[],signal:AbortSignal):Promise<string>{
 if(!apiEnabled||!supabaseUrl||!publishableKey)throw Error("Server assistant not enabled");
 const base=new URL(supabaseUrl);
 if(base.protocol!=="https:"||base.pathname!=="/"||base.search||base.hash)throw Error("Invalid assistant endpoint");
 const response=await fetch(new URL("/functions/v1/yawmiyati-shopping-assistant",base),{
  method:"POST",headers:{"content-type":"application/json","apikey":publishableKey},
  body:JSON.stringify({market,message:question,history:history.slice(-6).map(m=>({role:m.role,text:m.text.slice(0,500)}))}),
  cache:"no-store",redirect:"error",signal
 });
 if(!response.ok)throw Error("Assistant temporarily unavailable");
 const data:unknown=await response.json();
 if(!data||typeof data!=="object"||typeof (data as {reply?:unknown}).reply!=="string")throw Error("Invalid assistant reply");
 const reply=(data as {reply:string}).reply.trim();
 if(!reply||reply.length>1200)throw Error("Invalid assistant reply");
 return reply;
}
export function ShoppingAssistant({market,products,productPage=false}:{market:MarketCode;products:readonly PublicListing[];productPage?:boolean}){
 const [open,setOpen]=useState(false);
 const [messages,setMessages]=useState<ShopMessage[]>([{role:"assistant",text:greeting}]);
 const [draft,setDraft]=useState(""),[busy,setBusy]=useState(false);
 const scrollRef=useRef<HTMLDivElement>(null),inputRef=useRef<HTMLInputElement>(null),abortRef=useRef<AbortController|null>(null);
 useEffect(()=>{const el=scrollRef.current;if(el&&typeof el.scrollTo==="function")el.scrollTo({top:el.scrollHeight,behavior:"smooth"});},[messages,busy]);
 useEffect(()=>{if(open)inputRef.current?.focus();else {abortRef.current?.abort();setBusy(false);}},[open]);
 useEffect(()=>()=>abortRef.current?.abort(),[]);
 useEffect(()=>{setMessages([{role:"assistant",text:greeting}]);setDraft("")},[market]);
 async function send(value:string){
  const question=value.trim();
  if(!question||busy||question.length>500)return;
  const history=messages.slice(-6);
  const controller=new AbortController();abortRef.current?.abort();abortRef.current=controller;
  setBusy(true);setDraft("");
  setMessages(prev=>[...prev.slice(-15),{role:"visitor",text:question}]);
  let reply=localShopAnswer(question,market,products);
  if(apiEnabled){
   try{
    const timeout=AbortSignal.timeout(12000);
    const signal=AbortSignal.any([controller.signal,timeout]);
    reply=await requestAssistance(question,market,history,signal);
   }catch{ /* Fail closed to verified on-page guidance. Do not fabricate supplier information. */ }
  }
  if(!controller.signal.aborted)setMessages(prev=>[...prev.slice(-15),{role:"assistant",text:reply}]);
  if(!controller.signal.aborted)setBusy(false);
 }
 function submit(e:FormEvent){e.preventDefault();void send(draft);}
 return <div dir="rtl" className={"fixed left-3 z-[70] sm:bottom-6 sm:left-6 "+(productPage?"bottom-24":"bottom-4")}>
  {open&&<section role="dialog" aria-label="مساعد يومياتي للتسوق" aria-modal="false" onKeyDown={e=>{if(e.key==="Escape")setOpen(false)}} className="mb-3 flex h-[min(66dvh,550px)] w-[min(calc(100vw-24px),390px)] flex-col overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-2xl sm:h-[min(74vh,580px)]">
   <header className="flex shrink-0 items-center gap-3 bg-primary p-4 text-primary-foreground"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><Bot className="h-6 w-6"/></span><div className="min-w-0 flex-1"><h2 className="text-base font-extrabold">مساعد يومياتي الذكي</h2><p className="mt-0.5 text-xs text-white/80">يساعدك في استكشاف {countryName(market)} والمنتجات</p></div><button type="button" onClick={()=>setOpen(false)} className="tap grid place-items-center rounded-full hover:bg-white/15" aria-label="إغلاق المساعد"><X className="h-5 w-5"/></button></header>
   <div className="flex items-center gap-2 border-b px-4 py-3 text-[11px] leading-5 text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-primary"/>الإجابات تعتمد على المعلومات المتاحة. لا تشاركي معلومات شخصية أو بيانات الدفع.</div>
   <div ref={scrollRef} aria-live="polite" aria-relevant="additions" className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
    {messages.map((m,i)=><div key={i} className={"flex "+(m.role==="visitor"?"justify-start":"justify-end")}><p className={"max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-7 "+(m.role==="visitor"?"rounded-tr-sm bg-primary text-primary-foreground":"rounded-tl-sm bg-muted text-foreground")}>{m.text}</p></div>)}
    {messages.length===1&&<div className="grid gap-2">{SHOP_ASSISTANT_SUGGESTIONS.map(s=><button key={s} type="button" disabled={busy} onClick={()=>void send(s)} className="w-fit rounded-full border border-primary/20 bg-primary-soft px-3 py-2 text-right text-xs font-bold text-primary hover:border-primary">{s}</button>)}</div>}
    {busy&&<p role="status" className="text-xs text-muted-foreground">أبحث عن إجابة مناسبة…</p>}
   </div>
   <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t p-3"><input ref={inputRef} aria-label="اكتبي سؤالك لمساعد يومياتي" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={500} placeholder="بماذا أساعدك؟" className="field min-w-0 flex-1 text-sm" disabled={busy}/><button type="submit" aria-label="إرسال السؤال" disabled={busy||!draft.trim()} className="tap grid place-items-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-40"><Send className="h-5 w-5"/></button></form>
  </section>}
  <button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label={open?"إخفاء مساعد يومياتي الذكي":"افتح مساعد يومياتي الذكي"} className={"group flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary "+(open?"min-h-11 px-4 py-2.5":"h-12 w-12 sm:h-14 sm:w-auto sm:px-5 sm:py-3")}>
   {open?<X className="h-6 w-6"/>:<MessageCircle className="h-6 w-6"/>}<span className={open?"text-xs sm:text-sm":"hidden text-sm sm:inline"}>{open?"إخفاء المحادثة":"اسألي مساعد يومياتي"}</span>{!open&&<Sparkles className="hidden h-4 w-4 text-gold sm:inline"/>}
  </button>
 </div>;
}
