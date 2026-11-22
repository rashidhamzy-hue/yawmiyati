import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => { throw redirect({ to: "/sa" }); },
  head: () => ({
    meta: [
      { title: "يومياتي — متجر أسلوب الحياة" },
      { name: "description", content: "يومياتي: أفكار واختيارات للمنزل والجمال والعناية، بتجربة عربية سهلة." },
      { property: "og:title", content: "يومياتي — متجر أسلوب الحياة" },
      { property: "og:description", content: "اكتشفي عالم يومياتي للبيت والجمال والعناية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});
