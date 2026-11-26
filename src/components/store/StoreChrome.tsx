import {useEffect,useRef,useState} from "react";
import type {ReactNode} from "react";
import {ChevronDown,Home,LayoutGrid,Menu,Search,ShoppingBag,X,HelpCircle} from "lucide-react";
import {useOfferVersions} from "@/lib/store/offer-source";
import {useOfferCart} from "@/lib/store/offer-cart";
import {StoreSearchOverlay} from "./StoreSearchOverlay";
import {marketIdentity} from "@/lib/store/market-identity";
import {marketExperience} from "@/lib/store/market-experience";
import {markets,type MarketCode} from "@/lib/store/markets";

const countryCodes:MarketCode[]=["sa","ae","om","eg","iq"];
const navLinks=[["الأقسام","#discover"],["كل المنتجات","/search"],["قصتنا","/story"],["الأسئلة الشائعة","#questions"]] as const;

/** Cart shortcut appears only while approved offers are active and this market's cart has selections. */
function OfferCartLink({market}:{market:MarketCode}){
 const offers=useOfferVersions(market),cart=useOfferCart(market);
 if(offers.state!=="ready"||!cart.lines.length)return null;
 return <a href={"/"+market+"/cart"} aria-label={"السلة، "+cart.lines.length+" منتج"} className="tap relative grid place-items-center rounded-full border border-border bg-card transition-colors hover:border-primary/40 hover:text-primary"><ShoppingBag className="h-[19px] w-[19px]"/><span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-extrabold text-primary-foreground" data-offer-cart-count>{cart.lines.length}</span></a>;
}
export function StoreHeader({market}:{market:MarketCode}){
 const [menu,setMenu]=useState(false);
 const [searchOpen,setSearchOpen]=useState(false);
 const countrySelector=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{const handler=()=>setSearchOpen(true);document.addEventListener("yawmiyati:open-search",handler);return()=>document.removeEventListener("yawmiyati:open-search",handler);},[]);
 useEffect(()=>{
  const closeOutside=(event:PointerEvent)=>{
   if(countrySelector.current&&!countrySelector.current.contains(event.target as Node)){
    countrySelector.current.open=false;
   }
  };
  const closeEscape=(event:KeyboardEvent)=>{
   if(event.key==="Escape"&&countrySelector.current?.open){
    countrySelector.current.open=false;
    countrySelector.current.querySelector("summary")?.focus();
   }
  };
  document.addEventListener("pointerdown",closeOutside);
  document.addEventListener("keydown",closeEscape);
  return()=>{document.removeEventListener("pointerdown",closeOutside);document.removeEventListener("keydown",closeEscape);};
 },[]);
 const path="/"+market;
 const identity=marketIdentity[market];
 return <><header className="sticky top-0 z-50 border-b border-border/70 bg-background/95">
  <div className="mx-auto flex min-h-[60px] max-w-7xl items-center gap-3 px-4 sm:min-h-[76px] sm:gap-5 sm:px-6 lg:px-8">
   <a href={path} className="shrink-0 font-display text-[1.8rem] font-extrabold tracking-tight text-primary sm:text-[2rem]" aria-label={"يومياتي "+identity.name+"، الصفحة الرئيسية"}>يومياتي<span className="text-gold">.</span></a>
   <nav aria-label="التنقل الرئيسي" className="mr-5 hidden items-center gap-7 text-sm font-bold lg:flex">{navLinks.map(([title,hash])=><a href={path+(hash.startsWith("/")?hash:hash)} key={hash} className="transition-colors hover:text-primary">{title}</a>)}</nav>
   <div className="mr-auto flex items-center gap-2">
    <details ref={countrySelector} className="group relative">
     <summary aria-controls="yawmiyati-market-options" className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-border/90 bg-card px-2.5 py-1.5 text-xs font-bold text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-3.5">
      <span className="sr-only">{"البلد والعملة: "+identity.fullName+"، "+identity.currencyLong}</span>
      <span className="text-xl leading-none" aria-hidden="true">{identity.flag}</span>
      <span className="hidden whitespace-nowrap sm:inline">{identity.name}</span>
      <span className="hidden h-4 w-px bg-border sm:inline"/>
      <span className="whitespace-nowrap text-[11px] font-extrabold text-primary" dir="rtl">{identity.currencyLabel}</span>
      <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180 sm:block" aria-hidden="true"/>
     </summary>
     <div id="yawmiyati-market-options" className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+6.75rem)] z-[70] mx-auto max-h-[min(70dvh,560px)] w-auto max-w-sm overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-2 shadow-2xl [scrollbar-gutter:stable] sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:mx-0 sm:max-h-[min(70vh,560px)] sm:w-[290px] sm:max-w-[calc(100vw-32px)] sm:shadow-xl">
      <div className="sticky top-0 z-10 rounded-t-xl bg-card px-3 py-2 text-xs font-bold text-muted-foreground">اختاري بلد التسوق</div>
      {countryCodes.map(code=><a key={code} href={"/"+code} onClick={()=>{if(countrySelector.current)countrySelector.current.open=false;}} aria-current={code===market?"page":undefined} className={"flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary "+(code===market?"bg-primary-soft font-bold text-primary":"text-foreground")}>
       <span className="text-xl" role="img" aria-label={"علم "+marketIdentity[code].name}>{marketIdentity[code].flag}</span><span className="flex-1">{marketIdentity[code].name}</span><span className="text-xs text-muted-foreground" dir="rtl">{marketIdentity[code].currencyLabel}</span>
      </a>)}
      <p className="border-t px-3 py-2 text-[11px] leading-5 text-muted-foreground">كل متجر يعرض الأسعار والمنتجات الخاصة ببلده.</p>
     </div>
    </details>
    <OfferCartLink market={market}/>
    <button type="button" onClick={()=>setSearchOpen(true)} aria-label="افتح بحث يومياتي" aria-haspopup="dialog" className="tap grid place-items-center rounded-full border border-border bg-card transition-colors hover:border-primary/40 hover:text-primary"><Search className="h-[19px] w-[19px]"/></button>
    <button type="button" className="tap grid place-items-center rounded-full border border-border bg-card transition-colors hover:border-primary/40 lg:hidden" onClick={()=>setMenu(v=>!v)} aria-label={menu?"إغلاق القائمة":"فتح القائمة"} aria-expanded={menu} aria-controls="mobile-yawmiyati-menu">{menu?<X className="h-5 w-5"/>:<Menu className="h-5 w-5"/>}</button>
   </div>
  </div>
  {menu&&<nav id="mobile-yawmiyati-menu" aria-label="قائمة الجوال" className="grid gap-0 border-t bg-card px-5 py-2 text-sm font-bold lg:hidden">{navLinks.map(([title,hash])=><a key={hash} href={path+(hash.startsWith("/")?hash:hash)} onClick={()=>setMenu(false)} className="min-h-12 border-b border-border/50 py-3 last:border-0">{title}</a>)}</nav>}
 </header><StoreSearchOverlay market={market} open={searchOpen} onClose={()=>setSearchOpen(false)}/></>;
}
export function StoreFooter({market}:{market:MarketCode}){
 const path="/"+market,identity=marketIdentity[market];
 return <><footer className="bg-foreground pb-16 text-background md:pb-0">
  <div className="mx-auto grid max-w-7xl gap-6 px-4 py-9 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
   <div><a href={path} className="font-display text-3xl font-extrabold">يومياتي<span className="text-gold">.</span></a><p className="mt-4 max-w-xs text-sm leading-8 text-white/75">{marketExperience[market].footerDescription}</p><p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-xs text-white/80">{identity.fullName} <span className="text-white/40">|</span> {identity.currencyLabel}</p></div>
   <nav aria-label="روابط المتجر"><h2 className="font-bold">اكتشفي يومياتي</h2><div className="mt-4 grid gap-3 text-sm text-white/75"><a href={path+"#discover"} className="hover:text-white">تسوقي حسب القسم</a><a href={path+"/search"} className="hover:text-white">كل المنتجات</a><a href={path+"/story"} className="hover:text-white">قصتنا</a><a href={path+"/info/help"} className="hover:text-white">مركز المساعدة</a></div></nav>
   <nav aria-label="السياسات والبلدان"><h2 className="font-bold">معلومات تهمك</h2><div className="mt-4 grid gap-3 text-sm text-white/75"><a href={path+"/info/shipping-returns"} className="hover:text-white">الدفع والتوصيل والاسترجاع</a><a href={path+"/info/privacy"} className="hover:text-white">سياسة الخصوصية</a><a href={path+"/info/terms"} className="hover:text-white">شروط الاستخدام</a></div><div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-0">{countryCodes.map(code=><a key={code} href={"/"+code} aria-label={"متجر "+marketIdentity[code].fullName} aria-current={market===code?"page":undefined} className={"inline-flex min-h-11 items-center text-sm transition-colors hover:text-white focus-visible:outline-offset-2 "+(market===code?"font-bold text-white underline underline-offset-8":"text-white/75")}>{marketIdentity[code].name}</a>)}</div></nav>
  </div>
  <div className="border-t border-white/15 px-4 py-5 text-center text-xs text-white/65">© ٢٠٢٦ يومياتي. جميع الحقوق محفوظة.</div>
 </footer><nav aria-label="التنقل السريع للجوال" className="store-mobile-nav fixed inset-x-0 bottom-0 z-[55] grid grid-cols-4 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(0,0,0,.08)] backdrop-blur-lg md:hidden">
  <a href={path} className="flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-bold text-primary"><Home className="h-5 w-5"/>الرئيسية</a>
  <a href={path+"/#discover"} className="flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-primary"><LayoutGrid className="h-5 w-5"/>الأقسام</a>
  <button type="button" onClick={()=>document.dispatchEvent(new CustomEvent("yawmiyati:open-search"))} className="flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-primary"><Search className="h-5 w-5"/>البحث</button>
  <a href={path+"/info/help"} className="flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-primary"><HelpCircle className="h-5 w-5"/>المساعدة</a>
 </nav></>;
}
export function StoreFrame({market,children}:{market:MarketCode;children:ReactNode}){
 return <div dir="rtl" data-yawmiyati-market={market} className="min-h-screen overflow-x-clip bg-background text-foreground">
  <a href="#main-content" className="skip-link">تخطي إلى المحتوى</a>
  <div className="bg-primary px-4 py-2 text-center text-[11px] font-semibold tracking-wide text-primary-foreground sm:text-xs">{marketExperience[market].announcement}</div>
  <StoreHeader market={market}/><main id="main-content">{children}</main><StoreFooter market={market}/>
 </div>;
}
