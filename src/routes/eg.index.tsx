import {sharedPageLinks} from "@/lib/seo/site";
import {editorialSchema,serializeEditorialSchema} from "@/lib/store/editorial-schema";
import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {img,editorialRemote} from "@/lib/store/images";
import {editorialPreload} from "@/lib/store/editorial-srcset";
import {marketExperience} from "@/lib/store/market-experience";
const title="يومياتي مصر | حاجات صغيرة تفرّح يومك";
const description="حاجات حلوة للبيت والمطبخ والجمال والتنظيم في مصر. خدي لفة في أقسام يومياتي ودوري على اللي يناسب ذوقك.";
export const Route=createFileRoute("/eg/")({
 head:()=>({links:[editorialPreload(img[marketExperience.eg.heroImage]),...sharedPageLinks("eg")],scripts:[{type:"application/ld+json",children:serializeEditorialSchema(editorialSchema("eg")!)}],meta:[
  {title},
  {name:"description",content:description},
  {property:"og:title",content:title},
  {property:"og:description",content:description},
  {property:"og:type",content:"website"},
  {property:"og:image",content:editorialRemote[marketExperience.eg.heroImage]},
  {name:"twitter:card",content:"summary_large_image"},
  {name:"twitter:image",content:editorialRemote[marketExperience.eg.heroImage]},
  {name:"robots",content:"noindex,nofollow"}
 ]}),
 component:()=> <MarketPreview market="eg"/>
});
