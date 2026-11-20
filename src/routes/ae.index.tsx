import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {img} from "@/lib/store/images";
export const Route=createFileRoute("/ae/")({
 head:()=>({meta:[
  {title:"يومياتي الإمارات | تفاصيل صغيرة، حياة أجمل"},
  {name:"description",content:"اكتشفي تفاصيل يومياتي للمنزل والقهوة والجمال والعناية والأزياء في الإمارات. أقسام ملهمة ومعلومات المنتجات المعتمدة بعملة الدرهم."},
  {property:"og:title",content:"يومياتي الإمارات | تفاصيل صغيرة، حياة أجمل"},
  {property:"og:description",content:"اكتشفي تفاصيل يومياتي للمنزل والقهوة والجمال والعناية والأزياء في الإمارات. أقسام ملهمة ومعلومات المنتجات المعتمدة بعملة الدرهم."},
  {property:"og:image",content:img.hero},
  {name:"twitter:card",content:"summary_large_image"},
  {name:"twitter:image",content:img.hero},
  {name:"robots",content:"noindex,nofollow"}
 ]}),
 component:()=> <MarketPreview market="ae"/>
});
