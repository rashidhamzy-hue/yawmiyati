import {pageCopy} from "@/lib/store/page-copy";
import {ArrowLeft,ArrowRight,ShoppingBag,PackageSearch,ShieldCheck,Search} from "lucide-react";
import {StoreFrame} from "./StoreChrome";
import {ShoppingAssistant} from "./ShoppingAssistantDeferred";
import {img} from "@/lib/store/images";
import {editorialSrcSet} from "@/lib/store/editorial-srcset";
import type {MarketCode} from "@/lib/store/markets";
import {marketExperience} from "@/lib/store/market-experience";
import {customerServiceCopy} from "@/lib/store/customer-service-copy";
import {useOfferVersions} from "@/lib/store/offer-source";
import {useOfferCart} from "@/lib/store/offer-cart";
import {lazy,Suspense} from "react";
const OfferCartPage=lazy(()=>import("@/components/preview/OfferCartPage").then(m=>({default:m.OfferCartPage})));
const ShopCartPage=lazy(()=>import("./ShopCartPage").then(m=>({default:m.ShopCartPage})));
const cartFallback=<div className="mx-auto max-w-3xl px-4 py-8" aria-busy="true"><div className="ym-skeleton h-8 w-32"/><div className="ym-skeleton mt-6 h-24"/></div>;
import {useShopCart} from "@/lib/store/shop-cart";
const content={cart:{image:img["cat-home"],icon:ShoppingBag},checkout:{image:img["cat-kitchen"],icon:ShieldCheck},order:{image:img["cat-organize"],icon:PackageSearch}} as const;
export function StoreCommerceGuard({market,type}:{market:MarketCode;type:keyof typeof content}){
 // Approved offer versions (isolated fixture mode only, for now) replace the empty
 // state when this market's cart holds selections. Orders are never submitted.
 const offers=useOfferVersions(market),offerCart=useOfferCart(market);
 // Released products chosen in this browser: the real cart and order form (order submission itself stays off).
 const shopCart=useShopCart(market);
 if(type!=="order"&&offers.state==="ready"&&offerCart.lines.length)return <StoreFrame market={market} focused={type==="checkout"}><Suspense fallback={cartFallback}><OfferCartPage market={market} type={type} versions={offers.versions}/></Suspense></StoreFrame>;
 if(type!=="order"&&offers.state==="off"&&shopCart.lines.length)return <StoreFrame market={market} focused={type==="checkout"}><Suspense fallback={cartFallback}><ShopCartPage market={market} type={type}/></Suspense></StoreFrame>;
 const entry=content[type],Icon=entry.icon,path="/"+market,pc=pageCopy(market);
 const words={cart:{eyebrow:pc.cartEyebrow,title:pc.cartTitle,alt:pc.cartAlt},checkout:{eyebrow:pc.checkoutEyebrow,title:pc.checkoutTitle,alt:pc.checkoutAlt},order:{eyebrow:pc.orderEyebrow,title:pc.orderTitle,alt:pc.orderAlt}}[type];
 const copy=customerServiceCopy[market];
 return <StoreFrame market={market}>
  <section className="mx-auto max-w-6xl px-4 pb-20 pt-7 sm:px-6 sm:pt-12 lg:px-8">
   <nav aria-label={pc.crumbs} className="mb-6 text-sm text-muted-foreground"><a href={path} className="hover:text-primary">{pc.brand}</a> / {words.eyebrow}</nav>
   <div className="grid overflow-hidden rounded-[2rem] border bg-card shadow-soft md:grid-cols-2">
    <img src={entry.image} srcSet={editorialSrcSet(entry.image)} sizes="(min-width: 1152px) 560px, (min-width: 768px) 50vw, calc(100vw - 2rem)" alt={words.alt} width={1200} height={800} fetchPriority="high" className="h-64 w-full object-cover md:h-full md:min-h-[480px]"/>
    <div className="flex flex-col justify-center p-7 sm:p-12">
     <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary"><Icon className="h-7 w-7"/></span>
     <p className="text-sm font-extrabold text-primary">{words.eyebrow}</p>
     <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-4xl">{words.title}</h1>
     <p className="mt-5 text-sm leading-8 text-muted-foreground sm:text-base">{type==="order"?copy.tracking:copy.preCheckoutNotice}</p>
     {type!=="order"&&<p className="mt-2 text-sm">{copy.payment}</p>}
     <div className="mt-8 flex flex-wrap gap-3">
      <a href={path+"#discover"} className="btn-primary inline-flex min-h-12 items-center gap-2">{pc.browseSections} <ArrowLeft className="h-4 w-4"/></a>
      <button type="button" onClick={()=>document.dispatchEvent(new CustomEvent("yawmiyati:open-search"))} className="btn-outline inline-flex min-h-12 items-center gap-2"><Search className="h-4 w-4"/> {pc.searchStore}</button>
     </div>
     <p className="mt-6 text-xs leading-6 text-muted-foreground">{pc.browseHint} <a href={path+"/info/shipping-returns"} className="font-bold text-primary underline underline-offset-2">{pc.policiesLink}</a></p>
    </div>
   </div>
  </section>
  <ShoppingAssistant market={market} products={[]}/>
 </StoreFrame>;
}
