import {
  Outlet,
  createRootRoute,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import headingFont from "@fontsource-variable/el-messiri/files/el-messiri-arabic-wght-normal.woff2?url";
import textFont from "@fontsource-variable/readex-pro/files/readex-pro-arabic-wght-normal.woff2?url";
import {AnalyticsRoot} from "@/components/analytics/AnalyticsRoot";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { captureError } from "@/lib/monitoring/sentry-client";
import { CONSENT_PRECHECK_SCRIPT } from "@/lib/analytics/analytics";
import {img} from "@/lib/store/images";
import {chromeCopy,marketFromPath} from "@/lib/store/chrome-copy";
import {ArrowRight,RefreshCw,Search} from "lucide-react";

function useChrome(){
 const pathname=useRouterState({select:state=>state.location.pathname});
 const market=marketFromPath(pathname);
 return {market,copy:chromeCopy(market)};
}
function NotFoundComponent() {
 const {market,copy}=useChrome(),home="/"+market;
 return <main dir="rtl" className="min-h-screen bg-background px-4 py-12 text-foreground sm:py-20">
   <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border bg-card shadow-soft lg:grid lg:grid-cols-2">
    <img src={img["cat-home"]} alt={copy.notFoundAlt} width={1200} height={800} className="h-56 w-full object-cover lg:h-full" loading="lazy"/>
    <div className="flex flex-col justify-center px-7 py-12 sm:px-12">
     <a href={home} className="font-display text-2xl font-extrabold text-primary">يومياتي<span className="text-gold">.</span></a>
     <p className="mt-7 text-sm font-bold text-muted-foreground">{copy.notFoundBadge}</p>
     <h1 className="ym-h2 mt-3">{copy.notFoundTitle}</h1>
     <p className="ym-body mt-4">{copy.notFoundBody}</p>
     <div className="mt-8 flex flex-wrap gap-3"><a href={home} className="btn-primary"><ArrowRight className="h-4 w-4" aria-hidden="true"/>{copy.notFoundHome}</a><a href={home+"#discover"} className="btn-outline"><Search className="h-4 w-4" aria-hidden="true"/>{copy.notFoundBrowse}</a></div>
    </div>
   </div>
 </main>;
}
function ErrorComponent({error,reset}:ErrorComponentProps){
 const router=useRouter();
 const {market,copy}=useChrome(),home="/"+market;
 useEffect(()=>{reportLovableError(error,{boundary:"tanstack_root_error_component"});captureError(error,{boundary:"tanstack_root_error_component"});},[error]);
 return <main dir="rtl" className="min-h-screen bg-background px-4 py-12 text-foreground sm:py-20">
  <div className="mx-auto max-w-3xl rounded-[2rem] border bg-card p-7 text-center shadow-soft sm:p-14">
   <a href={home} className="font-display text-2xl font-extrabold text-primary">يومياتي<span className="text-gold">.</span></a>
   <h1 className="ym-h2 mt-8">{copy.errorTitle}</h1>
   <p className="ym-body mt-4">{copy.errorBody}</p>
   <div className="mt-7 flex flex-wrap justify-center gap-3"><button type="button" onClick={()=>{router.invalidate();reset();}} className="btn-primary"><RefreshCw className="h-4 w-4" aria-hidden="true"/>{copy.errorRetry}</button><a href={home} className="btn-outline">{copy.errorHome}</a></div>
  </div>
 </main>;
}

export const Route = createRootRoute({
  head: () => ({
    // Replace these placeholders with the app's name and description when first building the app.
    // Each content route, / included, must still set its own head(). Never add og:image or
    // twitter:image here: every page without its own would inherit the root's preview image.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "يومياتي" },
      { name: "description", content: "يومياتي — تجربة عربية للمنزل والجمال والعناية" },
      { name: "robots", content: "noindex,nofollow" }, // M4A: fail closed until launch authorization
      
      { property: "og:title", content: "يومياتي" },
      { property: "og:description", content: "يومياتي — تجربة عربية للمنزل والجمال والعناية" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      
    ],
    scripts: [{ children: CONSENT_PRECHECK_SCRIPT }],
    links: [
      // The stylesheet is written into the page itself by the server (src/lib/inline-css.ts), so the first paint does not
      // wait for a second request. Only the development server, which has no such step, links the file.
      ...(import.meta.env.DEV ? [{ rel: "stylesheet", href: appCss }] : []),
      // Both Arabic fonts start with the page instead of after the stylesheet is read.
      { rel: "preload", as: "font", type: "font/woff2", href: headingFont, crossOrigin: "anonymous" as const },
      { rel: "preload", as: "font", type: "font/woff2", href: textFont, crossOrigin: "anonymous" as const },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
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
  return (
    <>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <AnalyticsRoot />
    </>
  );
}
