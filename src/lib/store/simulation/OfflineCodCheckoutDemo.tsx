/**
 * Milestone 2C: TEST/OWNER DEMO ONLY. Never mount on a public or production route.
 * Every displayed product/address/quote is synthetic. This is NOT real checkout.
 */
import { useReducer, useState } from "react";
import type { MarketCode } from "../markets";
import { markets } from "../markets";
import { SIMULATION_MODE, type SimProduct } from "./fixtures";
import { createOfflineCheckoutSession } from "./checkout-session";
import { formatDemoMoney } from "./product-experience";

type Step = "cart" | "address" | "review" | "receipt";
const marketsArabic: Record<MarketCode,string> = {
  sa:"السعودية", ae:"الإمارات", om:"عُمان", eg:"مصر", iq:"العراق",
};
const stepNames: Record<Step,string> = {
  cart:"سلة افتراضية", address:"عنوان تجريبي", review:"مراجعة المحاكاة", receipt:"إيصال محاكاة",
};

export function OfflineCodCheckoutDemo({ initialMarket = "sa" }: { initialMarket?: MarketCode }) {
  const [market,setMarket] = useState<MarketCode>(initialMarket);
  const [session,setSession] = useState(() => createOfflineCheckoutSession(initialMarket));
  const [,refresh] = useReducer((n:number) => n + 1, 0);
  const [step,setStep] = useState<Step>("cart");
  const [error,setError] = useState<string|null>(null);
  const [ack,setAck] = useState(false);
  const current = session.snapshot();
  const catalog = session.catalog();
  const productBySku = new Map(catalog.map(p => [p.sku,p]));
  const readyProducts = catalog.filter(p =>
    p.variants.some(v => v.stock === "available" && v.availableUnits > 0)
  ).slice(0,6);

  function act(operation:()=>void) {
    try { operation(); setError(null); refresh(); }
    catch(e) { setError(e instanceof Error ? e.message : "simulation_error"); }
  }
  function restart(next:MarketCode) {
    setMarket(next);
    setSession(createOfflineCheckoutSession(next));
    setStep("cart"); setAck(false); setError(null);
  }
  function changeQty(sku:string, variantSku:string, quantity:number) {
    act(() => session.updateLine({mode:SIMULATION_MODE,sku,variantSku,quantity}));
  }
  function advanceToReview() {
    act(() => { session.review({mode:SIMULATION_MODE}); setStep("review"); setAck(false); });
  }
  function placeDemoOrder() {
    act(() => {
      session.place({ mode:SIMULATION_MODE, clientRequestId:"offline-demo-order-001", acknowledgeSimulation:ack });
      setStep("receipt");
    });
  }
  function productVariant(product:SimProduct, variantSku:string) {
    return product.variants.find(v => v.sku === variantSku);
  }
  return <section
    dir="rtl"
    data-simulation-only="true"
    aria-label="مختبر الدفع عند الاستلام التجريبي"
    className="mx-auto max-w-5xl space-y-6 px-4 py-7 text-foreground sm:px-6 lg:px-8"
  >
    <header className="rounded-3xl border-2 border-dashed border-amber-600 bg-amber-50 p-5 text-amber-950">
      <p className="inline-block rounded-full bg-amber-900 px-3 py-1 text-xs font-extrabold text-white">DEMO · SIMULATION ONLY</p>
      <h1 className="mt-3 text-2xl font-extrabold">مختبر السلة والدفع عند الاستلام — يومياتي</h1>
      <p className="mt-2 text-sm leading-7">تجربة داخلية غير متاحة للعملاء. منتجات وأسعار وشحن ومخزون وعناوين افتراضية. لا شراء حقيقي ولا دفع ولا اتصال بمورّد أو شركة توصيل.</p>
      <p className="mt-2 text-xs font-bold">مهم: أرقام الشحن ليست أسعار توصيل فعلية، خصوصاً قيمة مصر الموضوعة للاختبارات الحسابية فقط.</p>
    </header>
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
      <label className="text-sm font-bold">دولة الاختبار
        <select aria-label="دولة اختبار الدفع" value={market} onChange={e => restart(e.target.value as MarketCode)}
          className="mt-2 block min-h-11 w-full rounded-xl border bg-background px-3 sm:w-64">
          {(Object.keys(markets) as MarketCode[]).map(m => <option value={m} key={m}>{marketsArabic[m]} · {markets[m].currency}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => restart(market)}
        className="min-h-11 rounded-xl border px-4 text-sm font-bold">بدء محاكاة جديدة</button>
    </div>
    <nav aria-label="مراحل محاكاة الطلب" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {(["cart","address","review","receipt"] as const).map((s,i) =>
        <div key={s} aria-current={step===s?"step":undefined}
          className={`rounded-xl border px-3 py-3 text-center text-xs font-bold ${step===s?"border-primary bg-muted":"bg-card text-muted-foreground"}`}>
          {i+1}. {stepNames[s]}
        </div>
      )}
    </nav>
    {error&&<p role="alert" className="rounded-xl border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-900">تعذّرت العملية التجريبية: {error}</p>}

    {step==="cart"&&<div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold">اختيار عناصر للاختبار فقط</h2>
        <p className="mt-2 text-sm text-muted-foreground">يمكن إضافة نسخ تجريبية ذات مخزون اصطناعي متاح. البيانات لا تُرسل لأي جهة.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {readyProducts.map(product => <article key={product.sku} className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-extrabold text-amber-800">[تجريبي] · غير قابل للنشر</p>
          <h3 className="mt-2 text-sm font-bold leading-6">{product.title}</h3>
          <p className="my-3 text-base font-bold">{formatDemoMoney(market,product.priceMinor)} <span className="text-xs font-normal">افتراضي</span></p>
          <div className="space-y-2">{product.variants.map(variant => {
            const allowed = variant.stock==="available" && variant.availableUnits>0;
            const line = current.lines.find(l => l.variantSku===variant.sku);
            return <button key={variant.sku} type="button" disabled={!allowed}
              aria-label={`إضافة تجريبية: ${product.sku} ${variant.label}`}
              onClick={() => changeQty(product.sku,variant.sku,(line?.quantity??0)+1)}
              className="flex min-h-11 w-full items-center justify-between rounded-xl border px-3 py-2 text-right text-xs font-semibold disabled:opacity-45">
              <span>{variant.label} · {allowed?"متاح في الاختبار":"غير متاح افتراضياً"}</span>
              <span>{allowed?"+ إضافة": "—"}</span>
            </button>;
          })}</div>
        </article>)}
      </div>
      <section aria-label="السلة التجريبية" className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="text-lg font-extrabold">السلة التجريبية</h2>
        {current.lines.length===0?<p className="text-sm text-muted-foreground">السلة فارغة. اختاري عنصراً تجريبياً.</p>:
          <ul className="divide-y">{current.lines.map(line => {
            const product=productBySku.get(line.sku)!;
            const variant=productVariant(product,line.variantSku)!;
            return <li key={line.variantSku} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="text-sm font-bold">{product.title}</p>
                <p className="text-xs text-muted-foreground">{variant.label} · {formatDemoMoney(market,product.priceMinor)} / قطعة</p></div>
              <div className="flex items-center gap-2">
                <button type="button" aria-label={`تقليل كمية ${line.variantSku}`}
                  className="min-h-11 min-w-11 rounded-lg border" onClick={() => changeQty(line.sku,line.variantSku,line.quantity-1)}>−</button>
                <span className="min-w-7 text-center" aria-label={`الكمية ${line.quantity}`}>{line.quantity}</span>
                <button type="button" aria-label={`زيادة كمية ${line.variantSku}`}
                  className="min-h-11 min-w-11 rounded-lg border" disabled={line.quantity>=variant.availableUnits}
                  onClick={() => changeQty(line.sku,line.variantSku,line.quantity+1)}>+</button>
                <button type="button" aria-label={`حذف ${line.variantSku}`} className="min-h-11 rounded-lg border px-3 text-xs"
                  onClick={() => changeQty(line.sku,line.variantSku,0)}>حذف</button>
              </div>
            </li>;
          })}</ul>}
        {current.quote&&<div className="space-y-2 rounded-xl bg-muted p-4 text-sm" aria-label="ملخص مبالغ افتراضية">
          <div className="flex justify-between"><span>المنتجات الافتراضية</span><strong>{formatDemoMoney(market,current.quote.subtotalMinor)}</strong></div>
          <div className="flex justify-between"><span>شحن افتراضي للاختبار</span><strong>{formatDemoMoney(market,current.quote.shippingMinor)}</strong></div>
          <div className="flex justify-between border-t pt-2"><span>إجمالي محاكاة فقط</span><strong>{formatDemoMoney(market,current.quote.totalMinor)}</strong></div>
        </div>}
      </section>
      <button type="button" disabled={current.lines.length===0} onClick={()=>setStep("address")}
        className="min-h-12 w-full rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-40">التالي: عنوان اصطناعي</button>
    </div>}

    {step==="address"&&<div className="space-y-5 rounded-2xl border bg-card p-5">
      <h2 className="text-xl font-extrabold">اختيار عنوان تجريبي جاهز</h2>
      <p className="text-sm leading-7 text-muted-foreground">لا تدخلي عنواناً أو اسماً أو رقم هاتف حقيقياً. النموذج يستخدم بيانات غير شخصية حصراً، ولا يحتفظ بأي معلومات عن العملاء.</p>
      <div className="rounded-xl bg-muted p-4 text-sm leading-8" aria-label="تفاصيل عنوان الاختبار">
        <p>{session.sampleAddress().label}</p>
        <p>{session.sampleAddress().city}، {session.sampleAddress().district}</p>
        <p>{session.sampleAddress().street}، {session.sampleAddress().building}، {session.sampleAddress().landmark}</p>
        {session.sampleAddress().governorate&&<p>محافظة: {session.sampleAddress().governorate}</p>}
        {session.sampleAddress().emirate&&<p>إمارة: {session.sampleAddress().emirate}</p>}
        {session.sampleAddress().wilayat&&<p>ولاية: {session.sampleAddress().wilayat}</p>}
        {session.sampleAddress().nationalShortAddress&&<p>عنوان مختصر تجريبي: {session.sampleAddress().nationalShortAddress}</p>}
      </div>
      <button type="button" className="min-h-11 rounded-xl border px-4 font-semibold"
        onClick={()=>act(()=>session.setAddress({mode:SIMULATION_MODE,address:session.sampleAddress()}))}>
        استخدام العنوان الاصطناعي
      </button>
      {current.address&&<p role="status" className="text-sm font-bold">تم اختيار العنوان الاصطناعي فقط.</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" className="min-h-11 rounded-xl border px-5" onClick={()=>setStep("cart")}>العودة للسلة</button>
        <button type="button" disabled={!current.address} className="min-h-11 flex-1 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-40"
          onClick={advanceToReview}>مراجعة الطلب التجريبي</button>
      </div>
    </div>}

    {step==="review"&&current.reviewed&&current.quote&&<div className="space-y-5 rounded-2xl border bg-card p-5">
      <h2 className="text-xl font-extrabold">مراجعة محاكاة الدفع عند الاستلام</h2>
      <p className="text-sm text-muted-foreground">هذا ليس طلباً للشراء، ولن يُرسل أو يُحصّل أي مبلغ.</p>
      <dl className="grid grid-cols-2 gap-y-3 rounded-xl bg-muted p-4 text-sm">
        <dt>الدولة</dt><dd>{marketsArabic[market]}</dd>
        <dt>العنوان</dt><dd>{current.address?.label}</dd>
        <dt>عدد أصناف السلة</dt><dd>{current.lines.length}</dd>
        <dt>المجموع الاصطناعي</dt><dd className="font-bold">{formatDemoMoney(market,current.quote.totalMinor)}</dd>
        <dt>طريقة محاكاة الدفع</dt><dd>COD — دون تحصيل</dd>
      </dl>
      <label className="flex items-start gap-3 rounded-xl border p-4 text-sm leading-6">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={ack} onChange={e=>setAck(e.target.checked)}/>
        <span>أفهم أن هذا سينشئ رقم طلب SIM- تجريبياً في ذاكرة المتصفح فقط، دون أي دفع أو شحن أو مورّد.</span>
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" className="min-h-11 rounded-xl border px-5" onClick={()=>{setStep("cart");setAck(false)}}>تعديل السلة التجريبية</button>
        <button type="button" disabled={!ack} className="min-h-11 flex-1 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-40"
          onClick={placeDemoOrder}>إنشاء إيصال محاكاة فقط</button>
      </div>
    </div>}

    {step==="receipt"&&current.receipt&&<div className="space-y-4 rounded-2xl border bg-card p-5" role="status">
      <p className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-950">SIMULATION ONLY · NO REAL ORDER</p>
      <h2 className="text-xl font-extrabold">تم إنشاء إيصال اختبار في الذاكرة</h2>
      <p className="break-all font-mono text-sm" data-testid="simulation-order-id">{current.receipt.id}</p>
      <p className="text-sm">الحالة الاصطناعية: {current.receipt.status} · المجموع: {formatDemoMoney(market,current.receipt.totalMinor)}</p>
      <p className="text-sm">المورّد لم يؤكد شيئاً · لم يتم جمع أي دفعة · لا يوجد شحن أو توصيل فعلي.</p>
      <button type="button" onClick={()=>restart(market)} className="min-h-11 rounded-xl border px-5 font-semibold">بدء محاكاة جديدة</button>
    </div>}
    <footer className="border-t pt-4 text-xs leading-6 text-muted-foreground">
      عزل كامل: لا API ولا بيانات شخصية ولا سلة عميل ولا اتصال بمورّد ولا نشر. تعود جميع البيانات إلى الحالة الابتدائية عند إعادة التحميل.
    </footer>
  </section>;
}
