import {sharedPageLinks} from "@/lib/seo/site";
import {editorialSchema,serializeEditorialSchema} from "@/lib/store/editorial-schema";
import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {img,editorialRemote} from "@/lib/store/images";
import {editorialPreload} from "@/lib/store/editorial-srcset";
import {marketExperience} from "@/lib/store/market-experience";
const title="يومياتي العراق | تفاصيل تحلّي يومچ";
const description="أفكار للبيت والمطبخ والعناية والتنظيم في العراق. تصفّحي أقسام يومياتي وشوفي التفاصيل اللي تعجبچ.";
export const Route=createFileRoute("/iq/")({
 head:()=>({links:[editorialPreload(img[marketExperience.iq.heroImage]),...sharedPageLinks("iq")],scripts:[{type:"application/ld+json",children:serializeEditorialSchema(editorialSchema("iq")!)}],meta:[
  {title},
  {name:"description",content:description},
  {property:"og:title",content:title},
  {property:"og:description",content:description},
  {property:"og:type",content:"website"},
  {property:"og:image",content:editorialRemote[marketExperience.iq.heroImage]},
  {name:"twitter:card",content:"summary_large_image"},
  {name:"twitter:image",content:editorialRemote[marketExperience.iq.heroImage]},
  {name:"robots",content:"noindex,nofollow"}
 ]}),
 component:()=> <MarketPreview market="iq"/>
});
