import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => { throw redirect({ to: "/sa" }); },
  head: () => ({
    meta: [
      { title: "يومياتي — متجر أسلوب الحياة" },
      { name: "description", content: "يومياتي: منتجات منزلية وجمال وإكسسوارات مختارة، والدفع عند الاستلام." },
      { property: "og:title", content: "يومياتي — متجر أسلوب الحياة" },
      { property: "og:description", content: "منتجات مختارة للمرأة، والدفع عند الاستلام." },
    ],
  }),
});
