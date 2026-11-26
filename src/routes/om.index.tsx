import {editorialSchema,serializeEditorialSchema} from "@/lib/store/editorial-schema";
import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {img} from "@/lib/store/images";
import {editorialPreload} from "@/lib/store/editorial-srcset";
import {marketExperience} from "@/lib/store/market-experience";
const title="يومياتي عُمان | للبيت تفاصيله ولليوم نكهته";
const description="أفكار للبيت والقهوة والعناية والتنظيم في سلطنة عُمان. اكتشفي أقسام يومياتي بتفاصيل قريبة من يومك.";
export const Route=createFileRoute("/om/")({
 head:()=>({links:[editorialPreload(img[marketExperience.om.heroImage])],scripts:[{type:"application/ld+json",children:serializeEditorialSchema(editorialSchema("om")!)}],meta:[
  {title},
  {name:"description",content:description},
  {property:"og:title",content:title},
  {property:"og:description",content:description},
  {property:"og:type",content:"website"},
  {property:"og:image",content:img[marketExperience.om.heroImage]},
  {name:"twitter:card",content:"summary_large_image"},
  {name:"twitter:image",content:img[marketExperience.om.heroImage]},
  {name:"robots",content:"noindex,nofollow"}
 ]}),
 component:()=> <MarketPreview market="om"/>
});
