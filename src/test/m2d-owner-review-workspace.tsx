/**
 * M2D owner design-review desk. Importable ONLY in the separate local preview
 * harness and tests, never in TanStack routes or production bundles.
 * Review decisions are private, transient UI feedback, NOT publishing approval.
 */
import { useMemo, useState } from "react";
import { markets, type MarketCode } from "../lib/store/markets";
import { SIMULATION_MODE } from "../lib/store/simulation/fixtures";
import { SyntheticProductExperience } from "../lib/store/simulation/SyntheticProductExperience";
import { OfflineCodCheckoutDemo } from "../lib/store/simulation/OfflineCodCheckoutDemo";
import { OfflineLaunchReadinessPanel } from "./m3a-readiness-panel";

type Surface = "catalog" | "cod";
type Finding = "not_reviewed" | "pass" | "needs_fix";
const marketNames: Record<MarketCode,string> = {
  sa:"السعودية", ae:"الإمارات", om:"عُمان", eg:"مصر", iq:"العراق",
};
const headings: Record<Surface,string> = {
  catalog:"تجربة اكتشاف المنتجات الاصطناعية",
  cod:"محاكاة السلة والدفع عند الاستلام",
};
const criteria = [
  {id:"rtl",name:"الاتجاه العربي ووضوح النص"},
  {id:"mobile",name:"الشاشات الصغيرة واللمس"},
  {id:"keyboard",name:"التنقل بلوحة المفاتيح ووضوح التركيز"},
  {id:"currency",name:"عملة البلد ودقة الحساب الافتراضي"},
  {id:"safety",name:"تنبيه المحاكاة وعدم ظهور شراء حقيقي"},
] as const;

function reviewKey(market:MarketCode,surface:Surface,id:string) {
  return [market,surface,id].join(":");
}
export function LocalOwnerReviewWorkspace() {
  const [market,setMarket] = useState<MarketCode>("sa");
  const [surface,setSurface] = useState<Surface>("catalog");
  const [findings,setFindings] = useState<Record<string,Finding>>({});
  const [report,setReport] = useState("");
  const rows = useMemo(() => criteria.map(c => ({
    ...c, status:findings[reviewKey(market,surface,c.id)] ?? "not_reviewed",
  })),[market,surface,findings]);
  const reviewed = rows.filter(c => c.status!=="not_reviewed").length;

  function update(id:string,status:Finding) {
    setFindings(old => ({...old,[reviewKey(market,surface,id)]:status}));
    setReport("");
  }
  function exportReport() {
    const checks = (Object.keys(markets) as MarketCode[]).flatMap(m =>
      (["catalog","cod"] as Surface[]).flatMap(s => criteria.map(c => ({
        market:m, surface:s, criterion:c.id,
        status: findings[reviewKey(m,s,c.id)] ?? "not_reviewed",
      })))
    );
    setReport(JSON.stringify({
      kind:"yawmiyati_offline_owner_review",
      mode:SIMULATION_MODE,
      synthetic:true,
      note:"Local visual acceptance notes only; NOT catalog publishing permission",
      checks,
    },null,2));
  }
  return <main dir="rtl" data-testid="local-owner-review"
    className="min-h-screen bg-background px-3 py-5 text-foreground sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl space-y-5">
      <a href="#review-surface" className="skip-link">تخطّي إلى مساحة المراجعة</a>
      <header className="rounded-3xl border-2 border-dashed border-amber-600 bg-amber-50 px-5 py-6 text-amber-950">
        <p className="inline-block rounded-full bg-amber-900 px-3 py-1 text-xs font-extrabold text-white">LOCAL OWNER REVIEW · SIMULATION ONLY</p>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">مراجعة يومياتي الداخلية — دون نشر</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7">هذا الموقع المحلي للاختبار فقط. لا يُطلب منك تسجيل الدخول إلى قاعدة البيانات ولا يُنشئ طلبات حقيقية. جميع المنتجات والطلبات والمخزون والعناوين وهمية. الملاحظات تبقى داخل هذه الصفحة، وتختفي عند تحديثها.</p>
        <p className="mt-2 text-xs font-bold">الحماية هنا بكلمة مرور محلية مؤقتة، وليست بديلاً عن توثيق مالك المشروع عبر Supabase قبل أي نشر.</p>
      </header>
      <section aria-label="نطاق المراجعة" className="flex flex-col gap-3 rounded-2xl border bg-card p-4 md:flex-row md:items-end md:justify-between">
        <label className="text-sm font-bold">دولة الاختبار
          <select aria-label="بلد مراجعة المالك" value={market} onChange={e=>{setMarket(e.target.value as MarketCode);setReport("")}}
            className="mt-2 block min-h-11 w-full rounded-xl border bg-background px-3 md:w-64">
            {(Object.keys(markets) as MarketCode[]).map(m=><option key={m} value={m}>{marketNames[m]} · {markets[m].currency}</option>)}
          </select>
        </label>
        <div role="group" aria-label="نوع التجربة" className="flex flex-col gap-2 sm:flex-row">
          {(["catalog","cod"] as Surface[]).map(s=><button key={s} type="button" aria-pressed={s===surface}
            className={`min-h-11 rounded-xl border px-4 text-sm font-bold ${s===surface?"border-primary bg-primary text-primary-foreground":"bg-background"}`}
            onClick={()=>{setSurface(s);setReport("")}}>{headings[s]}</button>)}
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-4 sm:p-6" aria-label="قائمة تدقيق المالك">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">فحص جودة الواجهة — {marketNames[market]}</h2>
          <p role="status" className="text-sm text-muted-foreground">{reviewed} / {criteria.length} عناصر تمت مراجعتها</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map(c=>
          <label key={c.id} className="text-sm font-semibold">{c.name}
            <select aria-label={`تقييم ${c.id}`} value={c.status} onChange={e=>update(c.id,e.target.value as Finding)}
              className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3">
              <option value="not_reviewed">لم يُراجع بعد</option>
              <option value="pass">مقبول بصرياً (اختبار محلي)</option>
              <option value="needs_fix">بحاجة إلى تعديل</option>
            </select>
          </label>)}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className="min-h-11 rounded-xl border border-primary px-5 text-sm font-bold text-primary"
            onClick={exportReport}>تحضير تقرير المراجعة المحلي</button>
          <p className="text-xs text-muted-foreground">هذا تقييم واجهة، وليس تصريح نشر ولا موافقة على منتج أو سياسة توصيل.</p>
        </div>
        {report&&<label className="mt-4 block text-sm font-semibold">نتائج الفحص المحلي (للنسخ يدوياً)
          <textarea data-testid="local-review-report" readOnly rows={8} value={report} className="mt-2 w-full rounded-xl border bg-background p-3 font-mono text-xs" />
        </label>}
      </section>
      <OfflineLaunchReadinessPanel/>
      <section id="review-surface" aria-label="الواجهة قيد المراجعة" className="overflow-hidden rounded-3xl border bg-card" data-yawmiyati-market={market}>
        {surface==="catalog"?
          <SyntheticProductExperience key={`catalog-${market}`} initialMarket={market} lockedMarket/>:
          <OfflineCodCheckoutDemo key={`cod-${market}`} initialMarket={market} lockedMarket/>}
      </section>
      <footer className="border-t py-5 text-xs leading-6 text-muted-foreground">
        Local-only · No customer checkout · No external requests · No synthetic inventory published · No stored owner decisions
      </footer>
    </div>
  </main>;
}
