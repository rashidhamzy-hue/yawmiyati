import { createFileRoute } from "@tanstack/react-router";
import { StoreChooser } from "@/components/store/StoreChooser";
import { MARKET_CODES, SITE_ORIGIN, marketUrl } from "@/lib/seo/site";
import { markets } from "@/lib/store/markets";
import { chromeCopy } from "@/lib/store/chrome-copy";

// The root is the store chooser. Visitors from our five countries never see it: the Worker sends them to their
// own store first (src/lib/store/visitor-country.ts); everyone else, unknown countries and search engines land here.
export const Route = createFileRoute("/")({
  component: StoreChooser,
  head: () => ({
    meta: [
      { title: chromeCopy("sa").brand + " — " + chromeCopy("sa").chooserTitle },
      { name: "description", content: chromeCopy("sa").chooserLead },
      { property: "og:title", content: chromeCopy("sa").brand + " — " + chromeCopy("sa").chooserTitle },
      { property: "og:description", content: chromeCopy("sa").chooserLead },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [
      { rel: "canonical", href: SITE_ORIGIN + "/" },
      ...MARKET_CODES.map((m) => ({ rel: "alternate", hrefLang: markets[m].locale, href: marketUrl(m) })),
      { rel: "alternate", hrefLang: "x-default", href: SITE_ORIGIN + "/" },
    ],
  }),
});
