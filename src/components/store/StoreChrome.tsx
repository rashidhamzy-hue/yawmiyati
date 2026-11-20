import {useEffect,useState} from "react";
import type {ReactNode} from "react";
import {ChevronDown,Home,LayoutGrid,Menu,Search,X,HelpCircle} from "lucide-react";
import {StoreSearchOverlay} from "./StoreSearchOverlay";
import {marketIdentity} from "@/lib/store/market-identity";
import {markets,type MarketCode} from "@/lib/store/markets";

const countryCodes:MarketCode[]=["sa","ae","om","eg","iq"];
const navLinks=[["الأقسام","#discover"],["المنتجات","#collection"],["قصتنا","#story"],["الأسئلة الشائعة","#questions"]] as const;

export function StoreHeader({market}:{market:MarketCode}){
 const [menu,setMenu]=useState(false);
 const [searchOpen,setSearchOpen]=useState(false);
 useEffect(()=>{const handler=()=>setSearchOpen(true);document.addEventListener("yawmiyati:open-search",handler);return()=>document.removeEventListener("yawmiyati:open-search",handler);},[]);
 const path="/"+market;
 const identity=marketIdentity[market];
 return <><header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-xl">
  <div className="mx-auto flex min-h-[68px] max-w-7xl items-center gap-3 px-4 sm:min-h-[76px] sm:gap-5 sm:px-6 lg:px-8">
   <a href={path} className="shrink-0 font-display text-[1.8rem] font-extrabold tracking-tight text-primary sm:text-[2rem]" aria-label={"يومياتي "+identity.name+"، الصفحة الرئيسية"}>يومياتي<span className="text-gold">.</span></a>
   <nav aria-label="التنقل الرئيسي" className="mr-5 hidden items-center gap-7 text-sm font-bold lg:flex">{navLinks.map(([title,hash])=><a href={path+hash} key={hash} className="transition-colors hover:text-primary">{title}</a>)}</nav>
   <div className="mr-auto flex items-center gap-2">
    <details className="group relative">
     <summary aria-label={"البلد والعملة: "+identity.fullName+"، "+identity.currencyLong} className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-border/90 bg-card px-2.5 py-1.5 text-xs font-bold text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-soft sm:px-3.5">
      <span className="text-xl leading-none" role="img" aria-label={"علم "+identity.name}>{identity.flag}</span>
      <span className="hidden whitespace-nowrap sm:inline">{identity.name}</span>
      <span className="hidden h-4 w-px bg-border sm:inline"/>
      <span className="whitespace-nowrap text-[11px] font-extrabold text-primary" dir="rtl">{identity.currencyLabel}</span>
      <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180 sm:block" aria-hidden="true"/>
     </summary>
     <div className="absolute left-0 top-full z-50 mt-2 w-[min(290px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-xl">
      <div className="px-3 py-2 text-xs font-bold text-muted-foreground">اختاري بلد التسوق</div>
      {countryCodes.map(code=><a key={code} href={"/"+code} aria-current={code===market?"page":undefined} className={"flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-primary-soft "+(code===market?"bg-primary-soft font-bold text-primary":"text-foreground")}>
       <span className="text-xl" role="img" aria-label={"علم "+marketIdentity[code].name}>{marketIdentity[code].flag}</span><span className="flex-1">{marketIdentity[code].name}</span><span className="text-xs text-muted-foreground" dir="rtl">{marketIdentity[code].currencyLabel}</span>
      </a>)}
      <p className="border-t px-3 py-2 text-[11px] leading-5 text-muted-foreground">كل متجر يعرض الأسعار والمنتجات الخاصة ببلده.</p>
     </div>
    </details>
    <button type="button" onClick={()=>setSearchOpen(true)} aria-label="افتح بحث يومياتي" aria-haspopup="dialog" className="tap grid place-items-center rounded-full border border-border bg-card transition-colors hover:border-primary/40 hover:text-primary"><Search className="h-[19px] w-[19px]"/></button>
    <button type="button" className="tap grid place-items-center rounded-full border border-border bg-card transition-colors hover:border-primary/40 lg:hidden" onClick={()=>setMenu(v=>!v)} aria-label={menu?"إغلاق القائمة":"فتح القائمة"} aria-expanded={menu} aria-controls="mobile-yawmiyati-menu">{menu?<X className="h-5 w-5"/>:<Menu className="h-5 w-5"/>}</button>
   </div>
  </div>
  {menu&&<nav id="mobile-yawmiyati-menu" aria-label="قائمة الجوال" className="grid gap-0 border-t bg-card px-5 py-2 text-sm font-bold lg:hidden">{navLinks.map(([title,hash])=><a key={hash} href={path+hash} onClick={()=>setMenu(false)} className="min-h-12 border-b border-border/50 py-3 last:border-0">{title}</a>)}</nav>}
 </header><StoreSearchOverlay market={market} open={searchOpen} onClose={()=>setSearchOpen(false)}/></>;
}
export function StoreFooter({market}:{market:MarketCode}){
 const path="/"+market,identity=marketIdentity[market];
 return <><footer className="bg-foreground text-background">
  <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
   <div><a href={path} className="font-display text-3xl font-extrabold">يومياتي<span className="text-gold">.</span></a><p className="mt-4 max-w-xs text-sm leading-8 text-white/75">تفاصيل البيت، الجمال والعناية… اختيارات تلهم يومك وتعبّر عن ذوقك.</p><p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-xs text-white/80"><span role="img" aria-label={"علم "+identity.name}>{identity.flag}</span> {identity.fullName} <span className="text-white/40">|</span> {identity.currencyLabel}</p></div>
   <nav aria-label="روابط المتجر"><h2 className="font-bold">اكتشفي يومياتي</h2><div className="mt-4 grid gap-3 text-sm text-white/75"><a href={path+"#discover"} className="hover:text-white">تسوقي حسب القسم</a><a href={path+"#collection"} className="hover:text-white">المنتجات</a><a href={path+"#story"} className="hover:text-white">قصتنا</a><a href={path+"/info/help"} className="hover:text-white">مركز المساعدة</a></div></nav>
   <nav aria-label="السياسات والبلدان"><h2 className="font-bold">معلومات تهمك</h2><div className="mt-4 grid gap-3 text-sm text-white/75"><a href={path+"/info/shipping-returns"} className="hover:text-white">الدفع والتوصيل والاسترجاع</a><a href={path+"/info/privacy"} className="hover:text-white">سياسة الخصوصية</a><a href={path+"/info/terms"} className="hover:text-white">شروط الاستخدام</a></div><div className="mt-6 flex flex-wrap gap-3">{countryCodes.map(code=><a key={code} href={"/"+code} aria-label={"متجر "+marketIdentity[code].fullName} aria-current={market===code?"page":undefined} className={"rounded-full border px-2.5 py-1.5 text-lg transition-colors hover:border-white/70 "+(market===code?"border-white/80 bg-white/10":"border-white/20")}><span role="img" aria-label={"علم "+marketIdentity[code].name}>{marketIdentity[code].flag}</span></a>)}</div></nav>
  </div>
  <div className="border-t border-white/15 px-4 py-5 text-center text-xs text-white/65">© ٢٠٢٦ يومياتي. جميع الحقوق محفوظة.</div>
 </footer><nav aria-label="التنقل السريع للجوال" className="fixed inset-x-0 bottom-0 z-[55] grid grid-cols-4 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(0,0,0,.08)] backdrop-blur-lg md:hidden">
  <a href={path} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold text-primary"><Home className="h-5 w-5"/>الرئيسية</a>
  <a href={path+"#discover"} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-primary"><LayoutGrid className="h-5 w-5"/>الأقسام</a>
  <button type="button" onClick={()=>document.dispatchEvent(new CustomEvent("yawmiyati:open-search"))} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-primary"><Search className="h-5 w-5"/>البحث</button>
  <a href={path+"/info/help"} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-primary"><HelpCircle className="h-5 w-5"/>المساعدة</a>
 </nav></>;
}
export function StoreFrame({market,children}:{market:MarketCode;children:ReactNode}){
 return <div dir="rtl" className="min-h-screen overflow-x-clip bg-background text-foreground">
  <a href="#main-content" className="skip-link">تخطي إلى المحتوى</a>
  <div className="bg-primary px-4 py-2 text-center text-[11px] font-semibold tracking-wide text-primary-foreground sm:text-xs">تفاصيل صغيرة… تجعل يومك أجمل</div>
  <StoreHeader market={market}/><main id="main-content">{children}</main><StoreFooter market={market}/>
 </div>;
}
