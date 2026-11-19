import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import {LiveCatalog,catalogMode} from "@/components/store/LiveCatalog";
import { products, getCategory } from "@/lib/store/catalog";
import { ProductCard } from "@/components/store/ProductCard";

export const Route = createFileRoute("/sa/search")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === "string" ? s.q : "" }),
  head: () => ({ meta: [{ title: "البحث | يومياتي" }, { name: "description", content: "ابحثي في منتجات يومياتي." }, { property: "og:title", content: "البحث | يومياتي" }, { property: "og:description", content: "ابحثي في منتجات يومياتي." }] }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: "/sa/search" });
  const term = q.trim();
  const results = term ? products.filter((p) => [p.name, p.short, p.sub, getCategory(p.category)?.name].join(" ").includes(term)) : products;
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <div className="relative">
        <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input autoFocus className="field pr-12 text-base" placeholder="ابحثي عن منتج…" value={q} onChange={(e) => navigate({ search: { q: e.target.value }, replace: true })} aria-label="بحث" />
      </div>
      {catalogMode()!=="demo"?<LiveCatalog query={q}/>:<><p className="mt-4 text-sm text-muted-foreground">{term ? `${results.length} نتيجة لـ «${term}»` : "كل المنتجات"}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">{results.map((p) => <ProductCard key={p.slug} p={p} />)}</div></>}
    </div>
  );
}
