import {createFileRoute} from "@tanstack/react-router";
import {MarketPreview} from "@/components/store/MarketPreview";
import {img} from "@/lib/store/images";
export const Route=createFileRoute("/sa/")({
 head:()=>({meta:[
  {title:"يومياتي السعودية | تفاصيل صغيرة، حياة أجمل"},
  {name:"description",content:"اكتشفي اختيارات يومياتي السعودية للمنزل والقهوة والجمال والعناية والأزياء، وتصفّحي الأقسام والتفاصيل على ذوقك."},
  {name:"robots",content:"noindex,nofollow"},
  {property:"og:title",content:"يومياتي السعودية | تفاصيل صغيرة، حياة أجمل"},
  {property:"og:description",content:"اختيارات وأفكار يومية للمنزل والجمال والعناية."},
  {property:"og:image",content:img.hero},{name:"twitter:image",content:img.hero}
 ]}),component:()=> <MarketPreview market="sa"/>
});
