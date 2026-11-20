import {useState} from "react";
import {Menu,Search,X} from "lucide-react";
import {markets,type MarketCode} from "@/lib/store/markets";
const names:Record<MarketCode,string>={sa:"السعودية",ae:"الإمارات",om:"عُمان",eg:"مصر",iq:"العراق"};
export function StoreHeader({market}:{market:MarketCode}){
 const [menu,setMenu]=useState(false);
 const path="/"+market;
 const shopName="يومياتي "+names[market];
 return <>
  <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-xl">
   <div className="mx-auto flex min-h-[76px] max-w-7xl items-center gap-5 px-4 sm:px-6 lg:px-8">
    <a href={path} className="shrink-0 font-display text-[1.85rem] font-extrabold tracking-tight text-primary" aria-label={shopName+" — الرئيسية"}>يومياتي<span className="text-gold">.</span></a>
    <span className="hidden rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground sm:inline-flex">{names[market]}</span>
    <nav aria-label="التنقل الرئيسي" className="mr-6 hidden items-center gap-7 text-sm font-bold lg:flex">
     <a href={path+"#discover"} className="transition-colors hover:text-primary">اكتشفي الأقسام</a><a href={path+"#collection"} className="transition-colors hover:text-primary">المنتجات</a><a href={path+"#story"} className="transition-colors hover:text-primary">حكايتنا</a><a href={path+"/info/help"} className="transition-colors hover:text-primary">الأسئلة الشائعة</a>
    </nav>
    <div className="mr-auto flex items-center gap-2">
     <span className="hidden rounded-full bg-primary-soft px-3 py-2 text-xs font-extrabold text-primary sm:inline-flex">{markets[market].currency}</span>
     <a href={path+"#collection"} aria-label="ابحثي في المنتجات" className="tap grid place-items-center rounded-full border border-border bg-card hover:border-primary"><Search className="h-5 w-5"/></a>
     <button type="button" className="tap grid place-items-center rounded-full border border-border bg-card lg:hidden" onClick={()=>setMenu(v=>!v)} aria-label={menu?"إغلاق القائمة":"فتح القائمة"} aria-expanded={menu} aria-controls="mobile-yawmiyati-menu">{menu?<X className="h-5 w-5"/>:<Menu className="h-5 w-5"/>}</button>
    </div>
   </div>
   {menu&&<nav id="mobile-yawmiyati-menu" aria-label="قائمة الجوال" className="grid gap-0 border-t bg-card px-5 py-2 text-sm font-bold lg:hidden">{[["اكتشفي الأقسام","#discover"],["المنتجات","#collection"],["حكايتنا","#story"],["الأسئلة الشائعة","#questions"]].map(([label,hash])=><a key={hash} href={path+hash} onClick={()=>setMenu(false)} className="min-h-12 border-b border-border/50 py-3 last:border-0">{label}</a>)}</nav>}
  </header>
 </>;
}
export function StoreFooter({market}:{market:MarketCode}){
 const path="/"+market;
 return <>
  <footer className="bg-foreground text-background"><div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.35fr_1fr_1fr] lg:px-8"><div><a href={path} className="font-display text-3xl font-extrabold">يومياتي<span className="text-gold">.</span></a><p className="mt-4 max-w-xs text-sm leading-8 text-white/70">من الإلهام إلى التفاصيل اليومية الجميلة. تجربة تسوّق عربية نعمل على تجهيزها بعناية.</p><span className="mt-4 inline-block rounded-full border border-white/20 px-4 py-2 text-xs text-white/80">اكتشفي يومياتي</span></div><nav aria-label="روابط المتجر"><h2 className="font-bold">استكشفي</h2><div className="mt-4 grid gap-3 text-sm text-white/70"><a href={path+"#discover"} className="hover:text-white">الأقسام</a><a href={path+"#collection"} className="hover:text-white">المنتجات</a><a href={path+"#story"} className="hover:text-white">حكايتنا</a><a href={path+"/info/help"} className="hover:text-white">المساعدة</a><a href={path+"/info/shipping-returns"} className="hover:text-white">الدفع والتوصيل والاسترجاع</a><a href={path+"/info/privacy"} className="hover:text-white">الخصوصية</a><a href={path+"/info/terms"} className="hover:text-white">الشروط</a></div></nav><nav aria-label="اختيار البلد"><h2 className="font-bold">بلدك</h2><div className="mt-4 grid grid-cols-2 gap-3 text-sm">{(Object.keys(names) as MarketCode[]).map(code=><a key={code} href={"/"+code} aria-current={code===market?"page":undefined} className={code===market?"font-extrabold text-white":"text-white/70 hover:text-white"}>{names[code]}</a>)}</div><p className="mt-5 text-xs text-white/60">العملة: {markets[market].currency}</p></nav></div><div className="border-t border-white/15 px-4 py-5 text-center text-xs text-white/60">© ٢٠٢٦ يومياتي · جميع الحقوق محفوظة.</div></footer>
 </>;
}
export function StoreFrame({market,children}:{market:MarketCode;children:React.ReactNode}){
 return <div dir="rtl" className="min-h-screen overflow-x-clip bg-background text-foreground">
 <a href="#main-content" className="skip-link">تخطي إلى المحتوى</a>
 <div className="bg-primary px-4 py-2.5 text-center text-[11px] font-bold tracking-wide text-primary-foreground sm:text-xs">اختيارات يومية للبيت والجمال والعناية · {names[market]}</div>
 <StoreHeader market={market}/><main id="main-content">{children}</main><StoreFooter market={market}/>
 </div>;
}
