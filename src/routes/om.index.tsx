import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {img} from "@/lib/store/images";
export const Route=createFileRoute("/om/")({
 head:()=>({meta:[
  {title:"يومياتي عُمان | تفاصيل صغيرة، حياة أجمل"},
  {name:"description",content:"تصفّحي أفكار يومياتي للبيت والقهوة والعناية والأزياء في عُمان، مع معلومات المنتجات المعتمدة بعملة الريال العُماني."},
  {property:"og:title",content:"يومياتي عُمان | تفاصيل صغيرة، حياة أجمل"},
  {property:"og:description",content:"تصفّحي أفكار يومياتي للبيت والقهوة والعناية والأزياء في عُمان، مع معلومات المنتجات المعتمدة بعملة الريال العُماني."},
  {property:"og:image",content:img.hero},
  {name:"twitter:card",content:"summary_large_image"},
  {name:"twitter:image",content:img.hero},
  {name:"robots",content:"noindex,nofollow"}
 ]}),
 component:()=> <MarketPreview market="om"/>
});
