import {useState} from "react";
import { AlertTriangle, ArrowLeft, Lock, Trash2, Truck } from "lucide-react";
import { paymentLabel } from "../../../supabase/functions/_shared/payment-policy";
import type { MarketCode } from "@/lib/store/markets";
import { formatMinor, priceOfferCart, type ApprovedOfferVersion, type PricedLine } from "@/lib/store/offer-version";
import { cartSuggestions } from "@/lib/store/offer-recommendations";
import { addOfferLine, removeOfferLine, setOfferZone, updateOfferLine, useOfferCart } from "@/lib/store/offer-cart";
import { FixtureNotice } from "./OfferProductPanel";
import { CodCheckoutForm } from "./CodCheckoutForm";

const money = (market: MarketCode, minor: bigint) => minor > 0n ? formatMinor(market, minor) : "مشمول";
function selectableCartPacks(row:PricedLine,zoneId:string|null){
 if(!row.version)return [];
 return row.version.packs.filter(pack=>pack.selectable&&(!zoneId||row.version!.zones.some(zone=>zone.zone_id===zoneId&&zone.pack_ids.includes(pack.pack_id))));
}
const problem: Record<Exclude<PricedLine["status"], "ok">, string> = {
  missing: "هذا المنتج لم يعد معروضاً. احذفيه من السلة.",
  changed: "تغيّرت تفاصيل هذا العرض بعد إضافته. احذفيه وأعيدي اختياره من صفحة المنتج.",
  unavailable_in_zone: "هذه العبوة غير متاحة لمنطقة التوصيل المختارة.",
};

/** Cart and checkout review for approved offer versions. Never submits an order. */
export function OfferCartPage({ market, type, versions }: { market: MarketCode; type: "cart" | "checkout"; versions: readonly ApprovedOfferVersion[] }) {
  const cart = useOfferCart(market);
  const priced = priceOfferCart(cart, versions);
  const path = "/" + market;
  const review = type === "checkout";
  const [completed,setCompleted]=useState(false);
  const [formValid,setFormValid]=useState(false);
  const sample=versions.length>0&&versions.every(v=>v.slug.startsWith("preview-"+market+"-"));
  const suggestions=!review&&priced.checkoutReady?cartSuggestions(cart,versions):[];
  return <section className="mx-auto max-w-4xl px-4 pb-20 pt-7 sm:px-6 sm:pt-10 lg:px-8" aria-labelledby="offer-cart-title">
    <nav aria-label="مسار الصفحة" className="mb-4 text-sm text-muted-foreground"><a href={path} className="hover:text-primary">يومياتي</a> / {review ? "مراجعة الطلب" : "السلة"}</nav>
    <h1 id="offer-cart-title" className="font-display text-3xl font-extrabold">{review ? "مراجعة الطلب" : "سلتك"}</h1>
    <div className="mt-4"><FixtureNotice /></div>

    {priced.zones.length > 1 && <label className="mt-6 block text-sm font-extrabold">منطقة التوصيل
      <select value={priced.zone?.zone_id ?? ""} onChange={e => setOfferZone(market, e.target.value)} className="field mt-2 block min-h-12 w-full sm:w-80" aria-label="منطقة التوصيل">
        {!priced.zone && <option value="" disabled>اختاري المنطقة</option>}
        {priced.zones.map(z => <option key={z.zone_id} value={z.zone_id}>{z.label} · {money(market, BigInt(z.delivery_minor))}</option>)}
      </select></label>}

    {priced.lines.length===0&&<div role="status" className="mt-6 rounded-2xl border border-border bg-card px-6 py-8 text-center"><h2 className="font-display text-xl font-extrabold">سلتك فارغة</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">تصفّحي الأقسام لاختيار المنتجات، ولن يُرسل أي طلب من بيئة الاختبار.</p><a href={path+"#discover"} className="btn-outline mt-5 inline-flex min-h-11 items-center">استكشفي الأقسام <ArrowLeft className="h-4 w-4" aria-hidden="true"/></a></div>}
    <ul className="mt-6 space-y-3" aria-label="منتجات السلة">{priced.lines.map((row, i) => <li key={i} className="flex gap-4 rounded-2xl border bg-card p-4" data-cart-line={row.line.slug + ":" + row.line.pack_id}>
      {row.version?.image && <img src={row.version.image.url} alt="" className="h-20 w-20 shrink-0 rounded-xl bg-[#efe6d7] object-contain" />}
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <a href={path + "/p/" + encodeURIComponent(row.line.slug)} className="block font-extrabold hover:text-primary">{row.version?.title ?? row.line.slug}</a>
        <p className="text-muted-foreground">{row.pack?.label ?? "عبوة غير متاحة"}</p>
        {!review&&row.status==="ok"&&selectableCartPacks(row,priced.zone?.zone_id??cart.zone_id).length>1&&<label className="mt-2 block text-xs font-bold">الكمية / العبوة<select aria-label={"تعديل الكمية أو العبوة لـ "+(row.version?.title??"المنتج")} value={row.line.pack_id} onChange={e=>updateOfferLine(market,i,{...row.line,pack_id:e.target.value,add_on_id:null})} className="field mt-1 min-h-10 w-full text-xs">{selectableCartPacks(row,priced.zone?.zone_id??cart.zone_id).map(pack=><option key={pack.pack_id} value={pack.pack_id}>{pack.label} · {formatMinor(market,pack.price_minor)}</option>)}</select></label>}
        {row.status === "ok" ? <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-xs">
          <dt>السعر</dt><dd className="font-bold">{money(market, row.price_minor)}</dd>
          <dt className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" aria-hidden="true" />التوصيل</dt><dd className="font-bold">{money(market, row.delivery_minor)}</dd>
          <dt className="font-extrabold">عند الاستلام</dt><dd className="font-extrabold text-primary">{money(market, row.door_minor)}</dd>
        </dl> : <p role="alert" className="flex items-start gap-2 text-xs font-bold text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{problem[row.status]}</p>}
      </div>
      {!review && <button type="button" onClick={() => removeOfferLine(market, i)} aria-label={"حذف " + (row.version?.title ?? "المنتج") + " من السلة"} className="tap grid h-11 w-11 shrink-0 place-items-center rounded-full border hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
    </li>)}</ul>

    {priced.lines.filter(l => l.status === "ok").length > 1 && <p className="mt-3 text-xs text-muted-foreground">في بيانات الاختبار الحالية قد تُحسب رسوم توصيل مستقلة لكل شحنة. هذا لا يحدّد رسوم الطلبات الفعلية في المتجر.</p>}

    <section aria-label="الإجمالي عند الاستلام" className="mt-6 rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between text-lg"><span className="font-extrabold">الإجمالي عند الاستلام</span>
        <span className="font-extrabold text-primary" data-cart-door-total>{priced.lines.length===0?"لا توجد منتجات":priced.zone ? money(market, priced.total_door_minor) : "اختاري منطقة التوصيل"}</span></div>
      <p className="mt-1 text-xs text-muted-foreground">{paymentLabel}{priced.zone ? " · " + priced.zone.label : ""}</p>
      {!priced.checkoutReady && priced.lines.length > 0 && <p className="mt-3 text-xs font-bold text-destructive">راجعي العناصر المعلّمة قبل متابعة الطلب.</p>}
      {review ? <div className="mt-5 space-y-3">
        {priced.checkoutReady&&<div className="rounded-xl border bg-background p-4"><CodCheckoutForm market={market} onValidityChange={setFormValid}/></div>}
        <button type="button" disabled className="btn-primary inline-flex min-h-12 w-full items-center justify-center gap-2 opacity-60 sm:w-auto" aria-describedby="orders-off-note"><Lock className="h-4 w-4" aria-hidden="true" />تأكيد الطلب</button>
        <p id="orders-off-note" className="text-xs leading-6 text-muted-foreground">استقبال الطلبات غير مفعّل في هذه البيئة. البيانات تبقى في هذه الصفحة فقط، ولا تُرسل ولا يُنشأ أي طلب.</p>
        {sample&&priced.checkoutReady&&<div className="rounded-xl border bg-background p-4"><h2 className="font-bold">تجربة إتمام الطلب</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">منتجات تجريبية فقط، لا يُرسل أي طلب.</p><button type="button" onClick={()=>setCompleted(true)} disabled={completed||!formValid} className="btn-primary mt-4 min-h-12 w-full disabled:opacity-60">{completed?"اكتملت المحاكاة":"إتمام طلب تجريبي"}</button>{!formValid&&!completed&&<p className="mt-2 text-xs text-muted-foreground">أكملي بيانات التوصيل أولاً.</p>}{completed&&<p role="status" className="mt-3 text-sm font-bold text-primary">تمت محاكاة الطلب بنجاح. لم يُرسل طلب حقيقي.</p>}</div>}
        <a href={path + "/cart"} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary">تعديل السلة <ArrowLeft className="h-4 w-4" aria-hidden="true" /></a>
      </div> : <div className="mt-5 flex flex-wrap gap-3">
        {priced.checkoutReady ? <a href={path + "/checkout"} className="btn-primary inline-flex min-h-12 items-center gap-2">مراجعة الطلب <ArrowLeft className="h-4 w-4" aria-hidden="true" /></a>
          : <span aria-disabled="true" className="btn-primary inline-flex min-h-12 items-center gap-2 opacity-50">مراجعة الطلب</span>}
        <a href={path + "#collection"} className="btn-outline inline-flex min-h-12 items-center">متابعة التسوق</a>
      </div>}
    </section>
    {suggestions.length>0&&<section aria-label="اقتراحات إضافية" className="mt-6 space-y-3"><h2 className="font-display text-lg font-extrabold">اختيارات إضافية قد تعجبك</h2>{suggestions.map(({version,pack,zone,total})=><article key={version.listing_id} className="flex items-center gap-3 rounded-xl border bg-card p-3">{version.image&&<img src={version.image.url} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-lg object-contain"/>}<div className="min-w-0 flex-1"><a href={path+"/p/"+encodeURIComponent(version.slug)} className="line-clamp-2 text-sm font-bold">{version.title}</a><p className="mt-1 text-xs text-muted-foreground">إضافة للإجمالي: {formatMinor(market,total)}</p></div><button type="button" className="btn-outline min-h-11 shrink-0 text-xs" onClick={()=>addOfferLine(market,{listing_id:version.listing_id,slug:version.slug,version_id:version.version_id,revision:version.revision,pack_id:pack.pack_id,add_on_id:null},zone.zone_id)}>أضيفي</button></article>)}</section>}
  </section>;
}
