import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import {img} from "@/lib/store/images";
import {ArrowRight,RefreshCw,Search} from "lucide-react";

function NotFoundComponent() {
 return <main dir="rtl" className="min-h-screen bg-background px-4 py-12 text-foreground sm:py-20">
   <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border bg-card shadow-soft lg:grid lg:grid-cols-2">
    <img src={img["cat-home"]} alt="تفاصيل منزلية دافئة" className="h-56 w-full object-cover lg:h-full" loading="lazy"/>
    <div className="flex flex-col justify-center px-7 py-12 sm:px-12">
     <a href="/sa" className="font-display text-2xl font-extrabold text-primary">يومياتي<span className="text-gold">.</span></a>
     <p className="mt-7 text-sm font-bold text-primary">٤٠٤ · الصفحة غير موجودة</p>
     <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-4xl">ضيعتي الطريق؟ خلّينا نرجعك للأشياء الحلوة</h1>
     <p className="mt-4 text-sm leading-8 text-muted-foreground">يمكن الرابط تغيّر أو الصفحة ما عادت متاحة. تقدرين ترجعين ليومياتي أو تفتحين البحث مباشرة.</p>
     <div className="mt-8 flex flex-wrap gap-3"><a href="/sa" className="btn-primary inline-flex items-center gap-2"><ArrowRight className="h-4 w-4"/>العودة للرئيسية</a><a href="/sa#discover" className="btn-outline inline-flex items-center gap-2"><Search className="h-4 w-4"/>تصفّحي الأقسام</a></div>
    </div>
   </div>
 </main>;
}
function ErrorComponent({error,reset}:ErrorComponentProps){
 const router=useRouter();
 useEffect(()=>{reportLovableError(error,{boundary:"tanstack_root_error_component"});},[error]);
 return <main dir="rtl" className="min-h-screen bg-background px-4 py-12 text-foreground sm:py-20">
  <div className="mx-auto max-w-3xl rounded-[2rem] border bg-card p-7 text-center shadow-soft sm:p-14">
   <a href="/sa" className="font-display text-2xl font-extrabold text-primary">يومياتي<span className="text-gold">.</span></a>
   <h1 className="mt-8 font-display text-3xl font-extrabold">صار شيء غير متوقع</h1>
   <p className="mt-4 text-sm leading-8 text-muted-foreground">ما قدرنا نعرض الصفحة الآن. جرّبي مرة ثانية، أو ارجعي للرئيسية. معلوماتك ما تحتاجين تعيدين إرسالها هنا.</p>
   <div className="mt-7 flex flex-wrap justify-center gap-3"><button type="button" onClick={()=>{router.invalidate();reset();}} className="btn-primary inline-flex items-center gap-2"><RefreshCw className="h-4 w-4"/>إعادة المحاولة</button><a href="/sa" className="btn-outline inline-flex items-center gap-2">العودة إلى يومياتي</a></div>
  </div>
 </main>;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Replace these placeholders with the app's name and description when first building the app.
    // Each content route, / included, must still set its own head(). Never add og:image or
    // twitter:image here: every page without its own would inherit the root's preview image.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "يومياتي" },
      { name: "description", content: "يومياتي — تجربة عربية للمنزل والجمال والعناية" },
      { name: "robots", content: import.meta.env.VITE_YAWMIYATI_PUBLIC_INDEXING_ENABLED==="true"?"index,follow":"noindex,nofollow" },
      
      { property: "og:title", content: "يومياتي" },
      { property: "og:description", content: "يومياتي — تجربة عربية للمنزل والجمال والعناية" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
