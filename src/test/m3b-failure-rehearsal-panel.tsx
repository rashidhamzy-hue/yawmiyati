/**
 * Read-only owner inspection of deterministic offline operational fault injections.
 * Only imported by the M2D local preview; never mounts on a public route.
 */
import {useMemo,useState} from "react";
import {markets,type MarketCode} from "../lib/store/markets";
import {FAILURE_SCENARIOS,runOfflineFailureMatrix,type FailureScenario} from "../lib/store/simulation/failure-rehearsal";

const titles:Record<FailureScenario,string>={
 expired_stock_evidence:"انتهاء صلاحية دليل المخزون",
 wrong_market_or_currency_cost:"اختلاف الدولة أو العملة وتكلفة غير مثبتة",
 missing_cod_cost_policy:"نقص تكاليف الدفع عند الاستلام والإرجاع",
 failed_order_lifecycle:"فشل الطلب ومنع انتقال غير موثّق",
 retry_then_dead_letter:"إعادة المحاولة ثم قائمة الأخطاء النهائية",
 reconciliation_divergence:"اختلاف سجلات التسوية والطلبات",
};
const arabic:Record<MarketCode,string>={sa:"السعودية",ae:"الإمارات",om:"عُمان",eg:"مصر",iq:"العراق"};
export function OfflineFailureRehearsalPanel(){
 const [market,setMarket]=useState<MarketCode>("sa");
 const report=useMemo(()=>runOfflineFailureMatrix(),[]);
 const rows=report.outcomes.filter(x=>x.market===market);
 const [exported,setExported]=useState("");
 return <section dir="rtl" data-testid="offline-failure-rehearsal"
  className="space-y-5 rounded-2xl border bg-card p-4 sm:p-6" aria-label="اختبارات الأعطال غير المتصلة">
  <header>
   <p className="text-xs font-extrabold text-destructive">OFFLINE FAULT INJECTION · NO REAL ORDERS</p>
   <h2 className="mt-2 text-xl font-extrabold">محاكاة الأعطال والاستجابة الآمنة</h2>
   <p className="mt-2 text-sm leading-7 text-muted-foreground">النجاح هنا يعني أن البرنامج كشف الخطأ التجريبي أو رفضه. لا يعني أن المورد متصل أو أن الدفع أو الشحن يعمل فعلياً.</p>
  </header>
  <div className="grid gap-3 sm:grid-cols-3">
   <div className="rounded-xl bg-muted p-4"><p className="text-xs">أعطال المتصفح المكتشفة في 5 دول</p><p data-testid="failure-count" className="text-xl font-bold">{report.detected} / {report.total}</p></div>
   <div className="rounded-xl bg-muted p-4"><p className="text-xs">الصلاحية للإطلاق</p><p className="text-xl font-bold">ممنوع</p></div>
   <div className="rounded-xl bg-muted p-4"><p className="text-xs">طلبات / دفعات حقيقية</p><p className="text-xl font-bold">0</p></div>
  </div>
  <label className="block text-sm font-bold">دولة اختبار الأعطال
   <select value={market} aria-label="دولة اختبار الأعطال" onChange={e=>{setMarket(e.target.value as MarketCode);setExported("");}}
    className="mt-2 block min-h-11 w-full rounded-xl border bg-background px-3 sm:max-w-xs">
    {(Object.keys(markets) as MarketCode[]).map(code=><option key={code} value={code}>{arabic[code]} · {markets[code].currency}</option>)}
   </select>
  </label>
  <div className="grid gap-3 sm:grid-cols-2">
   {rows.map(item=><article key={item.scenario} className="rounded-xl border p-4">
    <p className="text-xs font-extrabold">{item.caught?"تم اكتشاف العطل الاصطناعي":"فشل الكشف — يتطلب إصلاحاً"}</p>
    <h3 className="mt-2 text-sm font-bold">{titles[item.scenario]}</h3>
    <p className="mt-2 text-xs text-muted-foreground">لا تغيير على مخزون أو طلبات أو دفعات حقيقية.</p>
   </article>)}
  </div>
  <button type="button" className="min-h-11 rounded-xl border border-primary px-4 font-bold text-primary"
   onClick={()=>setExported(JSON.stringify(report,null,2))}>إظهار نتائج الأعطال للاختبارات فقط</button>
  {exported&&<label className="block text-sm font-bold">تقرير المحاكاة غير المتصل
    <textarea data-testid="failure-matrix-export" readOnly value={exported} rows={8}
     className="mt-2 w-full rounded-xl border bg-background p-3 font-mono text-xs" />
   </label>}
  <p className="text-xs text-muted-foreground">خمس تجارب إضافية لتوقيع HMAC الحقيقي تُفحص فقط في اختبارات Node داخل CI؛ لا تُشغّل في المتصفح.</p>
  <p className="text-xs text-muted-foreground">هذه نتائج اختبارات محلية فقط، ولا يمكن استخدامها لتجاوز أي من بوابات الإطلاق الأربعين.</p>
 </section>;
}
