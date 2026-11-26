import {sharedPageLinks} from "@/lib/seo/site";
import {editorialSchema,serializeEditorialSchema} from "@/lib/store/editorial-schema";
import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {img,editorialRemote} from "@/lib/store/images";
import {editorialPreload} from "@/lib/store/editorial-srcset";
import {marketExperience} from "@/lib/store/market-experience";
const title="يومياتي الإمارات | تفاصيل تليق بذوقج";
const description="أفكار عصرية للبيت والعناية والأزياء والقهوة في الإمارات. تصفّحي أقسام يومياتي واكتشفي تفاصيل تلائم ذوقج.";
export const Route=createFileRoute("/ae/")({
 head:()=>({links:[editorialPreload(img[marketExperience.ae.heroImage]),...sharedPageLinks("ae")],scripts:[{type:"application/ld+json",children:serializeEditorialSchema(editorialSchema("ae")!)}],meta:[
  {title},
  {name:"description",content:description},
  {property:"og:title",content:title},
  {property:"og:description",content:description},
  {property:"og:type",content:"website"},
  {property:"og:image",content:editorialRemote[marketExperience.ae.heroImage]},
  {name:"twitter:card",content:"summary_large_image"},
  {name:"twitter:image",content:editorialRemote[marketExperience.ae.heroImage]},
  {name:"robots",content:"noindex,nofollow"}
 ]}),
 component:()=> <MarketPreview market="ae"/>
});
