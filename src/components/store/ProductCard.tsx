import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { formatPrice, imageOf, type Product } from "@/lib/store/catalog";
import { useCart } from "@/lib/store/cart";
import { toast } from "sonner";

export function ProductCard({ p }: { p: Product }) {
  const { add } = useCart();
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-soft">
      <Link to="/sa/p/$slug" params={{ slug: p.slug }} className="relative block aspect-square overflow-hidden bg-muted">
        <img src={imageOf(p.image)} alt={p.name} width={600} height={600} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        {p.badge && <span className="absolute right-2 top-2 rounded-full bg-card/90 px-2.5 py-1 text-xs font-bold text-primary">{p.badge}</span>}
        {!p.inStock && <span className="absolute inset-x-0 bottom-0 bg-foreground/70 py-1 text-center text-xs font-bold text-background">غير متوفر حالياً</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link to="/sa/p/$slug" params={{ slug: p.slug }} className="line-clamp-2 text-sm font-medium leading-snug">{p.name}</Link>
        <div className="mt-auto flex items-baseline gap-2">
          <span className="font-bold text-primary">{formatPrice(p.price)}</span>
          {p.compareAt && <span className="text-xs text-muted-foreground line-through">{formatPrice(p.compareAt)}</span>}
        </div>
        <button
          disabled={!p.inStock}
          onClick={() => { add(p.slug, p.variants?.options[0]); toast.success("أُضيف إلى السلة"); }}
          className="btn-outline min-h-11 px-3 text-sm disabled:opacity-40"
        >
          <ShoppingBag className="h-4 w-4" /> أضيفي للسلة
        </button>
      </div>
    </div>
  );
}
