import {LiveCatalog,catalogMode} from "@/components/store/LiveCatalog";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Banknote, Truck, ShieldCheck, Headphones, ArrowLeft, Sparkles } from "lucide-react";
import { categories, products, imageOf, formatPrice } from "@/lib/store/catalog";
import { ProductCard } from "@/components/store/ProductCard";
import { img } from "@/lib/store/images";

export const Route = createFileRoute("/sa/")({
  head: () => ({
    meta: [
      { title: "يومياتي السعودية — نسخة اختبارية" },
      { name: "description", content: "معاينة متجر يومياتي السعودية. الطلب غير متاح حالياً." },
      { property: "og:title", content: "يومياتي السعودية" },
      { property: "og:description", content: "معاينة متجر يومياتي السعودية." },
      { property: "og:image", content: img.hero },
      { name: "twitter:image", content: img.hero },
    ],
  }),
  component: CatalogHome,
});

function Home() {
  const trending = products.filter((p) => p.trending);
  const fresh = products.filter((p) => p.isNew);
  const bundle = products.find((p) => p.slug === "bamboo-bath-set")!;
  return (
    <>
      <section className="relative mx-auto max-w-6xl px-4 pt-4">
        <div className="relative overflow-hidden rounded-3xl">
          <img src={imageOf("hero")} alt="ركن منزلي أنيق" width={1600} height={900} className="h-[420px] w-full object-cover md:h-[520px]" />
          <div className="absolute inset-0 bg-hero-fade" />
          <div className="absolute inset-y-0 right-0 flex max-w-md flex-col justify-end gap-4 p-6 text-background md:justify-center md:p-12">
            <span className="flex w-fit items-center gap-1.5 rounded-full bg-background/20 px-3 py-1 text-xs backdrop-blur"><Sparkles className="h-3.5 w-3.5" /> مختارات الموسم</span>
            <h1 className="font-display text-4xl font-extrabold leading-tight md:text-5xl">اجعلي يومك أسهل… وأجمل</h1>
            <p className="text-base opacity-90">قطع مختارة للبيت والعناية والقهوة، تصلك لباب بيتك وتدفعين عند الاستلام.</p>
            <Link to="/sa/c/$slug" params={{ slug: "home" }} className="btn-primary w-fit">تسوّقي الآن <ArrowLeft className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-12">
        <h2 className="font-display text-2xl font-bold">تسوّقي حسب القسم</h2>
        <div className="mt-5 grid grid-cols-3 gap-3 md:grid-cols-6">
          {categories.map((c) => (
            <Link key={c.slug} to="/sa/c/$slug" params={{ slug: c.slug }} className="group text-center">
              <div className="aspect-square overflow-hidden rounded-2xl bg-muted">
                <img src={imageOf(c.image)} alt={c.name} width={300} height={300} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <p className="mt-2 text-sm font-medium">{c.name}</p>
            </Link>
          ))}
        </div>
      </section>

      <Shelf title="الأكثر طلباً" items={trending} />

      <section className="mx-auto max-w-6xl px-4 pt-14">
        <div className="grid items-center gap-6 overflow-hidden rounded-3xl bg-accent md:grid-cols-2">
          <img src={imageOf(bundle.image)} alt={bundle.name} width={800} height={600} loading="lazy" className="aspect-[4/3] w-full object-cover" />
          <div className="p-6 md:p-10">
            <span className="text-sm font-bold text-primary">طقم مختار</span>
            <h2 className="mt-2 font-display text-3xl font-extrabold">{bundle.name}</h2>
            <p className="mt-3 text-accent-foreground">{bundle.short} يشمل: {bundle.included.join("، ")}.</p>
            <p className="mt-4 text-2xl font-bold text-primary">{formatPrice(bundle.price)}</p>
            <Link to="/sa/p/$slug" params={{ slug: bundle.slug }} className="btn-primary mt-5">شاهدي الطقم</Link>
          </div>
        </div>
      </section>

      <Shelf title="وصل حديثاً" items={fresh} />

      <section className="mx-auto max-w-6xl px-4 pt-14">
        <h2 className="font-display text-2xl font-bold">أفكار ليومك</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[
            { t: "ركن قهوة الصباح في ٣ خطوات", d: "خفاقة، برطمانات أنيقة، وفناجين — ابدئي يومك بهدوء.", k: "cat-kitchen" as const, s: "kitchen" },
            { t: "روتين مسائي مريح", d: "حرير للنوم وبخور هادئ لنهاية يوم طويل.", k: "cat-wellness" as const, s: "wellness" },
          ].map((e) => (
            <Link key={e.t} to="/sa/c/$slug" params={{ slug: e.s }} className="group flex gap-4 overflow-hidden rounded-2xl bg-card p-3 shadow-soft">
              <img src={imageOf(e.k)} alt="" width={160} height={160} loading="lazy" className="h-28 w-28 shrink-0 rounded-xl object-cover" />
              <div className="py-1">
                <p className="font-bold group-hover:text-primary">{e.t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{e.d}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-14">
        <div className="grid grid-cols-2 gap-4 rounded-3xl bg-primary-soft p-6 md:grid-cols-4">
          {[
            [Banknote, "الدفع عند الاستلام", "لا تدفعي إلا عند وصول طلبك"],
            [Truck, "توصيل لكل المدن", "خلال ٢–٥ أيام عمل"],
            [ShieldCheck, "تأكيد قبل الشحن", "نتواصل معك لتأكيد الطلب"],
            [Headphones, "دعم بالعربي", "نساعدك عبر واتساب"],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Truck;
            return (
              <div key={t as string} className="text-center">
                <I className="mx-auto h-7 w-7 text-primary" />
                <p className="mt-2 font-bold">{t as string}</p>
                <p className="text-xs text-muted-foreground">{d as string}</p>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function Shelf({ title, items }: { title: string; items: typeof products }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-14">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {items.slice(0, 4).map((p) => <ProductCard key={p.slug} p={p} />)}
      </div>
    </section>
  );
}

function CatalogHome(){return catalogMode()==="demo"?<Home/>:<LiveCatalog/>;}
