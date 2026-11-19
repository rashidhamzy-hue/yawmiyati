import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Banknote, Check, ChevronLeft, Minus, Plus, Truck, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { country, formatPrice, getCategory, getProduct, imageOf, products } from "@/lib/store/catalog";
import { useCart } from "@/lib/store/cart";
import { ProductCard } from "@/components/store/ProductCard";
import { img } from "@/lib/store/images";

export const Route = createFileRoute("/sa/p/$slug")({
  loader: ({ params }) => {
    const product = getProduct(params.slug);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.product;
    if (!p) return { meta: [{ title: "منتج غير متوفر | يومياتي" }, { name: "robots", content: "noindex" }] };
    return { meta: [
      { title: `${p.name} | يومياتي السعودية` }, { name: "description", content: p.short },
      { property: "og:title", content: p.name }, { property: "og:description", content: p.short },
      { property: "og:type", content: "product" },
      { property: "og:image", content: img[p.image] }, { name: "twitter:image", content: img[p.image] },
    ] };
  },
  component: ProductPage,
});

function ProductPage() {
  const { product: p } = Route.useLoaderData();
  const cat = getCategory(p.category);
  const [active, setActive] = useState(0);
  const [variant, setVariant] = useState(p.variants?.options[0]);
  const [qty, setQty] = useState(1);
  const { add } = useCart();
  const navigate = useNavigate();
  const related = products.filter((x) => x.category === p.category && x.slug !== p.slug).slice(0, 4);

  const buyNow = () => { add(p.slug, variant, qty); navigate({ to: "/sa/checkout" }); };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:pb-0">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/sa" className="hover:text-primary">الرئيسية</Link><ChevronLeft className="h-4 w-4" />
        {cat && <><Link to="/sa/c/$slug" params={{ slug: cat.slug }} className="hover:text-primary">{cat.name}</Link><ChevronLeft className="h-4 w-4" /></>}
        <span className="truncate">{p.name}</span>
      </nav>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-3xl bg-muted">
            <img src={imageOf(p.gallery[active])} alt={p.name} width={900} height={900} className="h-full w-full object-cover" />
          </div>
          {p.gallery.length > 1 && (
            <div className="mt-3 flex gap-2">
              {p.gallery.map((g, i) => (
                <button key={g} onClick={() => setActive(i)} aria-label={`صورة ${i + 1}`} className={`h-20 w-20 overflow-hidden rounded-xl border-2 ${i === active ? "border-primary" : "border-transparent"}`}>
                  <img src={imageOf(g)} alt="" width={80} height={80} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          {p.badge && <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">{p.badge}</span>}
          <h1 className="mt-3 font-display text-3xl font-extrabold">{p.name}</h1>
          <p className="mt-2 text-muted-foreground">{p.short}</p>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary">{formatPrice(p.price)}</span>
            {p.compareAt && <span className="text-muted-foreground line-through">{formatPrice(p.compareAt)}</span>}
          </div>
          <p className={`mt-2 text-sm font-medium ${p.inStock ? "text-success" : "text-destructive"}`}>{p.inStock ? "متوفر" : "غير متوفر حالياً"}</p>

          {p.variants && (
            <div className="mt-5">
              <p className="text-sm font-bold">{p.variants.label}: <span className="font-normal">{variant}</span></p>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.variants.options.map((o) => (
                  <button key={o} onClick={() => setVariant(o)} className={`tap rounded-full border px-4 text-sm ${variant === o ? "border-primary bg-primary-soft font-bold text-primary" : "bg-card"}`}>{o}</button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <div className="flex items-center rounded-full border bg-card">
              <button className="tap flex items-center justify-center" aria-label="زيادة" onClick={() => setQty(qty + 1)}><Plus className="h-4 w-4" /></button>
              <span className="w-8 text-center font-bold">{qty}</span>
              <button className="tap flex items-center justify-center" aria-label="إنقاص" onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="h-4 w-4" /></button>
            </div>
            <button disabled={!p.inStock} onClick={() => { add(p.slug, variant, qty); toast.success("أُضيف إلى السلة"); }} className="btn-outline flex-1">أضيفي للسلة</button>
          </div>
          <button disabled={!p.inStock} onClick={buyNow} className="btn-primary mt-3 hidden w-full md:flex"><Banknote className="h-5 w-5" /> اطلبي الآن وادفعي عند الاستلام</button>

          <div className="mt-6 space-y-2 rounded-2xl bg-card p-4 text-sm shadow-soft">
            <p className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> التوصيل خلال {country.deliveryDays}</p>
            <p className="flex items-center gap-2"><Banknote className="h-4 w-4 text-primary" /> الدفع نقداً عند الاستلام</p>
            <p className="flex items-center gap-2"><RotateCcw className="h-4 w-4 text-primary" /> استرجاع خلال ٧ أيام للمنتجات غير المستخدمة</p>
          </div>

          <Section title="المميزات"><ul className="space-y-1.5">{p.benefits.map((b) => <li key={b} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-success" />{b}</li>)}</ul></Section>
          <Section title="المواصفات"><dl className="grid grid-cols-2 gap-y-1.5">{p.specs.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}</dl></Section>
          <Section title="محتويات العلبة"><p>{p.included.join("، ")}</p></Section>
          <Section title="العناية"><p>{p.care}</p></Section>
        </div>
      </div>

      {related.length > 0 && (
        <section className="pt-14">
          <h2 className="font-display text-2xl font-bold">قد يعجبك أيضاً</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">{related.map((r) => <ProductCard key={r.slug} p={r} />)}</div>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background p-3 md:hidden">
        <button disabled={!p.inStock} onClick={buyNow} className="btn-primary w-full"><Banknote className="h-5 w-5" /> اطلبي الآن — {formatPrice(p.price * qty)}</button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-6 border-t pt-4 text-sm"><h2 className="mb-2 font-bold">{title}</h2>{children}</div>;
}
