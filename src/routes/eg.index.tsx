import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {img} from "@/lib/store/images";
export const Route=createFileRoute("/eg/")({
 head:()=>({meta:[
  {title:"يومياتي مصر | تفاصيل صغيرة، حياة أجمل"},
  {name:"description",content:"اكتشفي أقسام يومياتي للمنزل والقهوة والجمال والأزياء في مصر. تفاصيل تلهم يومك ومعلومات المنتجات المعتمدة بالجنيه المصري."},
  {property:"og:title",content:"يومياتي مصر | تفاصيل صغيرة، حياة أجمل"},
  {property:"og:description",content:"اكتشفي أقسام يومياتي للمنزل والقهوة والجمال والأزياء في مصر. تفاصيل تلهم يومك ومعلومات المنتجات المعتمدة بالجنيه المصري."},
  {property:"og:image",content:img.hero},
  {name:"twitter:card",content:"summary_large_image"},
  {name:"twitter:image",content:img.hero},
  {name:"robots",content:"noindex,nofollow"}
 ]}),
 component:()=> <MarketPreview market="eg"/>
});
