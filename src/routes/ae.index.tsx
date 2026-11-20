import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {img} from "@/lib/store/images";
import {marketExperience} from "@/lib/store/market-experience";
const title="يومياتي الإمارات | تفاصيل تليق بذوقج";
const description="أفكار عصرية للبيت والعناية والأزياء والقهوة في الإمارات. تصفّحي أقسام يومياتي واكتشفي تفاصيل تلائم ذوقج.";
export const Route=createFileRoute("/ae/")({
 head:()=>({meta:[
  {title},
  {name:"description",content:description},
  {property:"og:title",content:title},
  {property:"og:description",content:description},
  {property:"og:image",content:img[marketExperience.ae.heroImage]},
  {name:"twitter:card",content:"summary_large_image"},
  {name:"twitter:image",content:img[marketExperience.ae.heroImage]},
  {name:"robots",content:"noindex,nofollow"}
 ]}),
 component:()=> <MarketPreview market="ae"/>
});
