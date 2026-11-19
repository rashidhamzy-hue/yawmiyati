import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Banknote, Lock } from "lucide-react";
import { country, formatPrice, getProduct, isValidSaudiPhone, orderTotals } from "@/lib/store/catalog";
import { useCart } from "@/lib/store/cart";
import { Summary } from "./sa.cart";

export const Route = createFileRoute("/sa/checkout")({
  head: () => ({ meta: [{ title: "إتمام الطلب | يومياتي" }, { name: "description", content: "أدخلي بياناتك وادفعي عند الاستلام." }, { property: "og:title", content: "إتمام الطلب | يومياتي" }, { property: "og:description", content: "الدفع عند الاستلام." }] }),
  component: Checkout,
});

function Checkout() {
  const { lines, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const t = orderTotals(subtotal);
  const [f, setF] = useState({ name: "", phone: "", city: "", area: "", address: "", landmark: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  if (!lines.length)
    return <div className="py-20 text-center"><p>لا توجد منتجات في السلة.</p><Link to="/sa" className="btn-primary mt-4">العودة للمتجر</Link></div>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.name.trim().length < 2) er.name = "اكتبي الاسم";
    if (!isValidSaudiPhone(f.phone)) er.phone = "رقم جوال سعودي يبدأ بـ 05 ومكون من ١٠ أرقام";
    if (!f.city) er.city = "اختاري المدينة";
    if (!f.area.trim()) er.area = "اكتبي الحي";
    if (f.address.trim().length < 5) er.address = "اكتبي العنوان بالتفصيل";
    setErrors(er);
    if (Object.keys(er).length) return;
    const id = `SA-${Date.now().toString().slice(-6)}`;
    sessionStorage.setItem(`order-${id}`, JSON.stringify({ ...f, lines, ...t }));
    clear();
    navigate({ to: "/sa/order/$id", params: { id } });
  };

  const F = ({ k, label, children }: { k: string; label: string; children: React.ReactNode }) => (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {errors[k] && <span className="mt-1 block text-xs text-destructive">{errors[k]}</span>}
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="mx-auto grid max-w-6xl gap-8 px-4 pt-8 md:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-extrabold">إتمام الطلب</h1>
        <p className="flex items-center gap-2 rounded-xl bg-primary-soft p-3 text-sm text-primary"><Banknote className="h-5 w-5" /> الدفع نقداً عند الاستلام — لا حاجة لبطاقة</p>
        <div className="grid gap-4 rounded-2xl bg-card p-5 shadow-soft sm:grid-cols-2">
          <F k="name" label="الاسم الكامل"><input className="field" value={f.name} onChange={set("name")} autoComplete="name" /></F>
          <F k="phone" label="رقم الجوال"><input className="field" dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" value={f.phone} onChange={set("phone")} autoComplete="tel" /></F>
          <F k="city" label="المدينة">
            <select className="field" value={f.city} onChange={set("city")}><option value="">اختاري</option>{country.cities.map((c) => <option key={c}>{c}</option>)}</select>
          </F>
          <F k="area" label="الحي"><input className="field" value={f.area} onChange={set("area")} /></F>
          <div className="sm:col-span-2"><F k="address" label="العنوان (الشارع، رقم المبنى)"><input className="field" value={f.address} onChange={set("address")} autoComplete="street-address" /></F></div>
          <div className="sm:col-span-2"><F k="landmark" label="علامة مميزة (اختياري)"><input className="field" value={f.landmark} onChange={set("landmark")} /></F></div>
        </div>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {lines.map((l, i) => { const p = getProduct(l.slug); return p && <li key={i}>{l.qty} × {p.name}{l.variant ? ` (${l.variant})` : ""} — {formatPrice(p.price * l.qty)}</li>; })}
        </ul>
      </div>
      <Summary {...t}>
        <button type="submit" className="btn-primary mt-4 w-full">تأكيد الطلب — {formatPrice(t.total)}</button>
        <p className="mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> سنتصل بك لتأكيد الطلب قبل الشحن</p>
      </Summary>
    </form>
  );
}
