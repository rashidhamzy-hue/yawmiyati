import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Phone, Truck, Banknote } from "lucide-react";
import { country, formatPrice } from "@/lib/store/catalog";

export const Route = createFileRoute("/sa/order/$id")({
  head: () => ({ meta: [{ title: "تم استلام طلبك | يومياتي" }, { name: "description", content: "شكراً لطلبك من يومياتي." }, { property: "og:title", content: "تم استلام طلبك | يومياتي" }, { property: "og:description", content: "شكراً لطلبك." }, { name: "robots", content: "noindex" }] }),
  component: OrderDone,
});

function OrderDone() {
  const { id } = Route.useParams();
  const [o, setO] = useState<{ name: string; city: string; total: number } | null>(null);
  useEffect(() => { try { setO(JSON.parse(sessionStorage.getItem(`order-${id}`) || "null")); } catch { /* ignore */ } }, [id]);
  return (
    <div className="mx-auto max-w-lg px-4 py-14 text-center">
      <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
      <h1 className="mt-4 font-display text-3xl font-extrabold">شكراً{o ? ` ${o.name}` : ""}، وصلنا طلبك!</h1>
      <p className="mt-2 text-muted-foreground">رقم الطلب: <span dir="ltr" className="font-bold text-foreground">{id}</span></p>
      <div className="mt-8 space-y-4 rounded-2xl bg-card p-5 text-right shadow-soft">
        <p className="flex gap-3"><Phone className="h-5 w-5 shrink-0 text-primary" /> سنتصل بك خلال ٢٤ ساعة لتأكيد الطلب.</p>
        <p className="flex gap-3"><Truck className="h-5 w-5 shrink-0 text-primary" /> التوصيل{o ? ` إلى ${o.city}` : ""} خلال {country.deliveryDays}.</p>
        {o && <p className="flex gap-3"><Banknote className="h-5 w-5 shrink-0 text-primary" /> المبلغ المطلوب عند الاستلام: <b>{formatPrice(o.total)}</b></p>}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">نسخة تجريبية — لن يتم شحن أي طلب.</p>
      <Link to="/sa" className="btn-outline mt-6">متابعة التسوق</Link>
    </div>
  );
}
