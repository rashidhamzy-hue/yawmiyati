import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {img} from "@/lib/store/images";
export const Route=createFileRoute("/iq/")({
 head:()=>({meta:[
  {title:"يومياتي العراق | تفاصيل صغيرة، حياة أجمل"},
  {name:"description",content:"استكشفي أفكار يومياتي للمنزل والقهوة والجمال والأزياء في العراق، مع معلومات المنتجات المعتمدة بالدينار العراقي."},
  {property:"og:title",content:"يومياتي العراق | تفاصيل صغيرة، حياة أجمل"},
  {property:"og:description",content:"استكشفي أفكار يومياتي للمنزل والقهوة والجمال والأزياء في العراق، مع معلومات المنتجات المعتمدة بالدينار العراقي."},
  {property:"og:image",content:img.hero},
  {name:"twitter:card",content:"summary_large_image"},
  {name:"twitter:image",content:img.hero},
  {name:"robots",content:"noindex,nofollow"}
 ]}),
 component:()=> <MarketPreview market="iq"/>
});
