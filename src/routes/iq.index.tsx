import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {img} from "@/lib/store/images";
import {marketExperience} from "@/lib/store/market-experience";
const title="يومياتي العراق | تفاصيل تحلّي يومچ";
const description="أفكار للبيت والمطبخ والعناية والتنظيم في العراق. تصفّحي أقسام يومياتي وشوفي التفاصيل اللي تعجبچ.";
export const Route=createFileRoute("/iq/")({
 head:()=>({meta:[
  {title},
  {name:"description",content:description},
  {property:"og:title",content:title},
  {property:"og:description",content:description},
  {property:"og:image",content:img[marketExperience.iq.heroImage]},
  {name:"twitter:card",content:"summary_large_image"},
  {name:"twitter:image",content:img[marketExperience.iq.heroImage]},
  {name:"robots",content:"noindex,nofollow"}
 ]}),
 component:()=> <MarketPreview market="iq"/>
});
