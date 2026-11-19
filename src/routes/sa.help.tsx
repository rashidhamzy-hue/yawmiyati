import { createFileRoute } from "@tanstack/react-router";
import { country } from "@/lib/store/catalog";

export const Route = createFileRoute("/sa/help")({
  head: () => ({ meta: [{ title: "المساعدة والتوصيل | يومياتي" }, { name: "description", content: "كل ما تحتاجين معرفته عن التوصيل والدفع عند الاستلام والاسترجاع." }, { property: "og:title", content: "المساعدة | يومياتي" }, { property: "og:description", content: "التوصيل والدفع والاسترجاع." }] }),
  component: Help,
});

function Help() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 pt-8">
      <h1 className="font-display text-3xl font-extrabold">المساعدة</h1>
      <section><h2 className="text-xl font-bold">التوصيل والدفع</h2><p className="mt-2 text-muted-foreground">نوصل لجميع مدن المملكة خلال {country.deliveryDays}. رسوم التوصيل {country.deliveryFee} {country.currency}، ومجاني للطلبات فوق {country.freeDeliveryFrom} {country.currency}. تدفعين نقداً عند استلام الطلب، وسنتصل بك لتأكيده قبل الشحن.</p></section>
      <section id="returns"><h2 className="text-xl font-bold">الاسترجاع والاستبدال</h2><p className="mt-2 text-muted-foreground">يمكنك طلب الاسترجاع خلال ٧ أيام من الاستلام للمنتجات غير المستخدمة وفي تغليفها الأصلي.</p></section>
      <section id="contact"><h2 className="text-xl font-bold">تواصلي معنا</h2><p className="mt-2 text-muted-foreground">فريقنا متاح يومياً من ٩ صباحاً حتى ١٠ مساءً عبر واتساب.</p></section>
    </div>
  );
}
