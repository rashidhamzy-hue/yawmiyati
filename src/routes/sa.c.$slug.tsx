import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, SlidersHorizontal } from "lucide-react";
import { getCategory, products } from "@/lib/store/catalog";
import { ProductCard } from "@/components/store/ProductCard";

export const Route = createFileRoute("/sa/c/$slug")({
  loader: ({ params }) => {
    const category = getCategory(params.slug);
    if (!category) throw notFound();
    return { category };
  },
  head: ({ loaderData }) => {
    const n = loaderData?.category.name ?? "القسم";
    const d = loaderData?.category.intro ?? "تسوّقي من يومياتي";
    return { meta: [{ title: `${n} | يومياتي السعودية` }, { name: "description", content: d }, { property: "og:title", content: `${n} | يومياتي` }, { property: "og:description", content: d }] };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { category } = Route.useLoaderData();
  const [sub, setSub] = useState<string | null>(null);
  const [sort, setSort] = useState("featured");
  const [inStock, setInStock] = useState(false);
  const list = useMemo(() => {
    let l = products.filter((p) => p.category === category.slug && (!sub || p.sub === sub) && (!inStock || p.inStock));
    if (sort === "low") l = [...l].sort((a, b) => a.price - b.price);
    if (sort === "high") l = [...l].sort((a, b) => b.price - a.price);
    return l;
  }, [category.slug, sub, sort, inStock]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/sa" className="hover:text-primary">الرئيسية</Link><ChevronLeft className="h-4 w-4" /><span>{category.name}</span>
      </nav>
      <h1 className="mt-3 font-display text-3xl font-extrabold">{category.name}</h1>
      <p className="mt-1 text-muted-foreground">{category.intro}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {[null, ...category.subs].map((s) => (
          <button key={s ?? "all"} onClick={() => setSub(s)} className={`tap rounded-full border px-4 text-sm ${sub === s ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>{s ?? "الكل"}</button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-y py-3 text-sm">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="tap rounded-lg border bg-card px-3" aria-label="الترتيب">
          <option value="featured">المميز</option><option value="low">السعر: من الأقل</option><option value="high">السعر: من الأعلى</option>
        </select>
        <label className="tap flex items-center gap-2"><input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="h-4 w-4 accent-primary" /> المتوفر فقط</label>
        <span className="mr-auto text-muted-foreground">{list.length} منتج</span>
      </div>
      {list.length ? (
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">{list.map((p) => <ProductCard key={p.slug} p={p} />)}</div>
      ) : (
        <p className="py-16 text-center text-muted-foreground">لا توجد منتجات مطابقة حالياً.</p>
      )}
    </div>
  );
}
