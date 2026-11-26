import {editorialSchema,serializeEditorialSchema} from "@/lib/store/editorial-schema";
import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {img,editorialRemote} from "@/lib/store/images";
import {editorialPreload} from "@/lib/store/editorial-srcset";
import {marketExperience} from "@/lib/store/market-experience";
export const Route=createFileRoute("/sa/")({
 head:()=>({links:[editorialPreload(img[marketExperience.sa.heroImage])],scripts:[{type:"application/ld+json",children:serializeEditorialSchema(editorialSchema("sa")!)}],meta:[
  {title:"يومياتي السعودية | تفاصيل صغيرة، حياة أجمل"},
  {name:"description",content:"اكتشفي اختيارات يومياتي السعودية للمنزل والقهوة والجمال والعناية والأزياء، وتصفّحي الأقسام والتفاصيل على ذوقك."},
  {name:"robots",content:"noindex,nofollow"},
  {property:"og:title",content:"يومياتي السعودية | تفاصيل صغيرة، حياة أجمل"},
  {property:"og:description",content:"اختيارات وأفكار يومية للمنزل والجمال والعناية."},
  {property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"},
  {property:"og:image",content:editorialRemote.hero},{name:"twitter:image",content:editorialRemote.hero}
 ]}),component:()=> <MarketPreview market="sa"/>
});
