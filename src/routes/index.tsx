import { createFileRoute } from "@tanstack/react-router";
import { CHOOSER_PHOTO, CHOOSER_PHOTO_SIZES, StoreChooser } from "@/components/store/StoreChooser";
import { editorialPreload } from "@/lib/store/editorial-srcset";
import { MARKET_CODES, SITE_ORIGIN, marketUrl } from "@/lib/seo/site";
import { markets } from "@/lib/store/markets";
import { chromeCopy } from "@/lib/store/chrome-copy";
import { editorialRemote } from "@/lib/store/images";

// The root is the store chooser. Visitors from our five countries never see it: the Worker sends them to their
// own store first (src/lib/store/visitor-country.ts); everyone else, unknown countries and search engines land here.
export const Route = createFileRoute("/")({
  component: StoreChooser,
  head: () => ({
    meta: [
      { title: chromeCopy("sa").brand + " — " + chromeCopy("sa").chooserHeadline },
      { name: "description", content: chromeCopy("sa").chooserLead },
      { property: "og:title", content: chromeCopy("sa").brand + " — " + chromeCopy("sa").chooserHeadline },
      { property: "og:description", content: chromeCopy("sa").chooserLead },
      { property: "og:type", content: "website" },
      { property: "og:image", content: editorialRemote.hero },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: editorialRemote.hero },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [
      // The photograph is the largest element on phones: start it while the head is parsed.
      editorialPreload(CHOOSER_PHOTO, CHOOSER_PHOTO_SIZES),
      { rel: "canonical", href: SITE_ORIGIN + "/" },
      ...MARKET_CODES.map((m) => ({ rel: "alternate", hrefLang: markets[m].locale, href: marketUrl(m) })),
      { rel: "alternate", hrefLang: "x-default", href: SITE_ORIGIN + "/" },
    ],
  }),
});
