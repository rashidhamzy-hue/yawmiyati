import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {catalogMode} from "@/components/store/LiveCatalog";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { country, formatPrice, getProduct, imageOf, orderTotals } from "@/lib/store/catalog";
import { useCart } from "@/lib/store/cart";

export const Route = createFileRoute("/sa/cart")({
  head: () => ({ meta: [{ title: "سلة التسوق | يومياتي" }, { name: "description", content: "راجعي منتجاتك قبل إتمام الطلب." }, { property: "og:title", content: "سلة التسوق | يومياتي" }, { property: "og:description", content: "راجعي منتجاتك قبل إتمام الطلب." }] }),
  beforeLoad:()=>{if(catalogMode()!=="demo")throw redirect({to:"/sa"});},
  component: CartPage,
});

function CartPage() {
  const { lines, setQty, remove, subtotal } = useCart();
  const t = orderTotals(subtotal);
  if (!lines.length)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-bold">سلتك فارغة</h1>
        <p className="mt-2 text-muted-foreground">اكتشفي مختاراتنا وأضيفي ما يعجبك.</p>
        <Link to="/sa" className="btn-primary mt-6">ابدئي التسوق</Link>
      </div>
    );
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-8 md:grid-cols-[1fr_340px]">
      <div>
        <h1 className="font-display text-3xl font-extrabold">سلة التسوق</h1>
        <ul className="mt-5 divide-y rounded-2xl bg-card shadow-soft">
          {lines.map((l, i) => {
            const p = getProduct(l.slug); if (!p) return null;
            return (
              <li key={i} className="flex gap-3 p-3">
                <img src={imageOf(p.image)} alt={p.name} width={96} height={96} className="h-24 w-24 rounded-xl object-cover" />
                <div className="flex flex-1 flex-col">
                  <Link to="/sa/p/$slug" params={{ slug: p.slug }} className="font-medium">{p.name}</Link>
                  {l.variant && <span className="text-xs text-muted-foreground">{p.variants?.label}: {l.variant}</span>}
                  <span className="mt-1 font-bold text-primary">{formatPrice(p.price * l.qty)}</span>
                  <div className="mt-auto flex items-center gap-2">
                    <div className="flex items-center rounded-full border">
                      <button className="tap flex items-center justify-center" aria-label="زيادة" onClick={() => setQty(i, l.qty + 1)}><Plus className="h-4 w-4" /></button>
                      <span className="w-6 text-center text-sm font-bold">{l.qty}</span>
                      <button className="tap flex items-center justify-center" aria-label="إنقاص" onClick={() => setQty(i, l.qty - 1)}><Minus className="h-4 w-4" /></button>
                    </div>
                    <button className="tap mr-auto flex items-center justify-center text-muted-foreground hover:text-destructive" aria-label="حذف" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <Summary subtotal={t.subtotal} delivery={t.delivery} total={t.total}>
        <Link to="/sa/checkout" className="btn-primary mt-4 w-full">إتمام الطلب</Link>
      </Summary>
    </div>
  );
}

export function Summary({ subtotal, delivery, total, children }: { subtotal: number; delivery: number; total: number; children?: React.ReactNode }) {
  return (
    <aside className="h-fit rounded-2xl bg-card p-5 shadow-soft md:sticky md:top-24">
      <h2 className="font-bold">ملخص الطلب</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between"><dt>المجموع الفرعي</dt><dd>{formatPrice(subtotal)}</dd></div>
        <div className="flex justify-between"><dt>التوصيل</dt><dd>{delivery ? formatPrice(delivery) : "مجاني"}</dd></div>
        {delivery > 0 && <p className="text-xs text-muted-foreground">أضيفي {formatPrice(country.freeDeliveryFrom - subtotal)} للتوصيل المجاني</p>}
        <div className="flex justify-between border-t pt-2 text-base font-bold"><dt>الإجمالي عند الاستلام</dt><dd className="text-primary">{formatPrice(total)}</dd></div>
      </dl>
      {children}
    </aside>
  );
}
