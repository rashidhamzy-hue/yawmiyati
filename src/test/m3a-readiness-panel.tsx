/**
 * Offline launch gate inspector for the existing LOCAL ONLY owner review shell.
 * This component is not loaded from public storefront/admin production routes.
 */
import {useMemo,useState} from "react";
import {markets,type MarketCode} from "../lib/store/markets";
import {READINESS_GATES,offlineReadiness,fiveMarketReadiness,exportLocalReadinessNotes,type LocalNote,type LocalReviewNote,type ReadinessGateId} from "../lib/store/simulation/offline-launch-readiness";

const countries:Record<MarketCode,string>={sa:"السعودية",ae:"الإمارات",om:"عُمان",eg:"مصر",iq:"العراق"};
export function OfflineLaunchReadinessPanel(){
 const [country,setCountry]=useState<MarketCode>("sa");
 const [notes,setNotes]=useState<LocalNote[]>([]);
 const [exported,setExported]=useState("");
 const assessment=useMemo(()=>offlineReadiness(country,notes),[country,notes]);
 const overall=useMemo(()=>fiveMarketReadiness(notes),[notes]);
 function setReview(gate:ReadinessGateId,note:LocalReviewNote){
  setNotes(current=>[...current.filter(x=>x.market!==country||x.gate!==gate),{market:country,gate,note}]);
  setExported("");
 }
 return <section dir="rtl" data-testid="offline-launch-readiness" aria-label="مراجعة جاهزية الإطلاق غير المتصلة"
  className="space-y-5 rounded-2xl border bg-card p-4 sm:p-6">
  <div className="space-y-2">
    <p className="text-xs font-extrabold text-destructive">OFFLINE ONLY · NO RELEASE AUTHORIZATION</p>
    <h2 className="text-xl font-extrabold">بوابات الإطلاق — كلها مقفلة حتى وصول أدلة موثّقة</h2>
    <p className="text-sm leading-7 text-muted-foreground">هذا فحص محلي لإظهار النواقص، وليس طريقة لتفعيل المتجر. اختيار «تمت المراجعة محلياً» لا يثبت اتصال مورد، ولا يسمح بالنشر أو الدفع أو الشحن أو الإنفاق.</p>
  </div>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="ملخص الحماية">
   <div className="rounded-xl border bg-muted px-4 py-3"><p className="text-xs">البلدان المعتمدة للإطلاق</p><p className="text-xl font-bold">0 / 5</p></div>
   <div className="rounded-xl border bg-muted px-4 py-3"><p className="text-xs">بوابات غير مثبتة</p><p className="text-xl font-bold" data-testid="blocked-gates">{overall.blockedGates}</p></div>
   <div className="rounded-xl border bg-muted px-4 py-3"><p className="text-xs">نشر / Checkout</p><p className="text-xl font-bold">موقوف</p></div>
   <div className="rounded-xl border bg-muted px-4 py-3"><p className="text-xs">تكاملات / إنفاق</p><p className="text-xl font-bold">موقوف</p></div>
  </div>
  <label className="block text-sm font-bold">الدولة قيد التدقيق
   <select aria-label="بلد فحص الجاهزية" className="mt-2 block min-h-11 w-full rounded-xl border bg-background px-3 sm:max-w-xs"
    value={country} onChange={e=>setCountry(e.target.value as MarketCode)}>
     {(Object.keys(markets) as MarketCode[]).map(m=><option key={m} value={m}>{countries[m]} · {markets[m].currency}</option>)}
   </select>
  </label>
  <p role="status" className="text-sm font-bold">بوابات هذا البلد غير المثبتة: {assessment.blockedCount} / {READINESS_GATES.length}</p>
  <div className="grid gap-3 md:grid-cols-2">{assessment.gates.map(gate=>
   <div className="rounded-xl border p-4" key={gate.id}>
    <p className="text-xs font-extrabold text-destructive">غير مثبت · ممنوع الإطلاق</p>
    <h3 className="mt-2 text-sm font-bold">{gate.label}</h3>
    <label className="mt-3 block text-xs font-semibold">حالة مراجعة المالك (ملاحظات فقط)
     <select aria-label={"مراجعة "+gate.id} value={gate.review} onChange={e=>setReview(gate.id,e.target.value as LocalReviewNote)}
      className="mt-2 min-h-11 w-full rounded-lg border bg-background px-3">
      <option value="not_reviewed">لم يُراجع</option>
      <option value="reviewed_offline">تمت المراجعة محلياً — ليس إثباتاً</option>
      <option value="needs_work">توجد نواقص</option>
     </select>
    </label>
   </div>
  )}</div>
  <div className="space-y-3 border-t pt-4">
   <button type="button" className="min-h-11 rounded-xl border border-primary px-4 font-bold text-primary"
    onClick={()=>setExported(exportLocalReadinessNotes(notes))}>تصدير تقرير محلي بدون معلومات شخصية</button>
   {exported&&<label className="block text-sm font-bold">التقرير — للنسخ فقط
    <textarea data-testid="readiness-export" readOnly rows={9} value={exported} className="mt-2 w-full rounded-xl border bg-background p-3 font-mono text-xs"/>
   </label>}
   <p className="text-xs leading-6 text-muted-foreground">لا توجد أزرار تشغيل أو نشر، ولا حاجة إلى بيانات اعتماد مورّد. التقرير غير متصل تماماً ولا يُحفظ تلقائياً.</p>
  </div>
 </section>;
}
