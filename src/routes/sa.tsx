import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import {catalogMode} from "@/components/store/LiveCatalog";
import { Search, ShoppingBag, Truck, Banknote, RotateCcw, MapPin, Menu, X } from "lucide-react";
import { Toaster } from "sonner";
import { CartProvider, useCart } from "@/lib/store/cart";
import { categories, country } from "@/lib/store/catalog";

export const Route = createFileRoute("/sa")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: SaLayout,
});

function SaLayout() {
  if(catalogMode()!=="demo")return <Outlet/>;
  return (
    <CartProvider>
      <div className="min-h-screen bg-background text-foreground">
        <BenefitStrip />
        <Header />
        <main><Outlet /></main>
        <Footer />
        <Toaster position="top-center" dir="rtl" />
      </div>
    </CartProvider>
  );
}

function BenefitStrip() {
  return (
    <div className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-6 overflow-x-auto px-4 py-2 text-xs whitespace-nowrap">
        <span className="flex items-center gap-1.5"><Banknote className="h-4 w-4" /> الدفع عند الاستلام</span>
        <span className="flex items-center gap-1.5"><Truck className="h-4 w-4" /> توصيل مجاني فوق {country.freeDeliveryFrom} {country.currency}</span>
        <span className="hidden items-center gap-1.5 sm:flex"><RotateCcw className="h-4 w-4" /> استرجاع سهل</span>
      </div>
    </div>
  );
}

function Header() {
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <button className="tap -mr-2 flex items-center justify-center md:hidden" aria-label="القائمة" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Link to="/sa" className="font-display text-2xl font-extrabold tracking-tight text-primary">يومياتي</Link>
        <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {country.name}</span>
        <nav className="mr-6 hidden gap-5 text-sm md:flex">
          {categories.slice(0, 5).map((c) => (
            <Link key={c.slug} to="/sa/c/$slug" params={{ slug: c.slug }} className="hover:text-primary" activeProps={{ className: "text-primary font-bold" }}>{c.name}</Link>
          ))}
        </nav>
        <div className="mr-auto flex items-center gap-1">
          <Link to="/sa/search" search={{ q: "" }} className="tap flex items-center justify-center rounded-full hover:bg-muted" aria-label="بحث"><Search className="h-5 w-5" /></Link>
          <Link to="/sa/cart" className="tap relative flex items-center justify-center rounded-full hover:bg-muted" aria-label="السلة">
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[11px] font-bold text-foreground">{count}</span>}
          </Link>
        </div>
      </div>
      {open && (
        <nav className="border-t px-4 py-2 md:hidden">
          {categories.map((c) => (
            <Link key={c.slug} to="/sa/c/$slug" params={{ slug: c.slug }} onClick={() => setOpen(false)} className="tap flex items-center border-b py-2 last:border-0">{c.name}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t bg-secondary">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="font-display text-xl font-extrabold text-primary">يومياتي</p>
          <p className="mt-2 text-sm text-muted-foreground">متجر نسائي لأسلوب حياة أسهل وأجمل. اطلبي الآن وادفعي عند الاستلام.</p>
        </div>
        <div>
          <p className="font-bold">الأقسام</p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {categories.map((c) => <li key={c.slug}><Link to="/sa/c/$slug" params={{ slug: c.slug }} className="hover:text-primary">{c.name}</Link></li>)}
          </ul>
        </div>
        <div>
          <p className="font-bold">المساعدة</p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            <li><Link to="/sa/help" className="hover:text-primary">التوصيل والدفع</Link></li>
            <li><Link to="/sa/help" hash="returns" className="hover:text-primary">الاسترجاع والاستبدال</Link></li>
            <li><Link to="/sa/help" hash="contact" className="hover:text-primary">تواصلي معنا</Link></li>
          </ul>
        </div>
      </div>
      <p className="border-t py-4 text-center text-xs text-muted-foreground">© ٢٠٢٦ يومياتي — نسخة تجريبية، المنتجات للعرض فقط</p>
    </footer>
  );
}
