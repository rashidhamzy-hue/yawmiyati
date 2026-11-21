/**
 * Customer-friendly, locale-aware page metadata for five prelaunch stores.
 * All routes remain noindex. Product-specific data must come from the
 * authenticated, release-gated public catalog — never from an untrusted URL.
 */
import type {MarketCode} from "./markets";
import {marketIdentity} from "./market-identity";
import {marketExperience} from "./market-experience";
import {brandStory} from "./brand-story";
import {customerServiceCopy} from "./customer-service-copy";
import {planCategorySeo} from "./seo-planning";
import type {InfoTopic} from "@/components/store/StoreInfoPage";
import {planProductSeo} from "./seo-planning";
import type {PublicListing} from "./public-catalog";

type PageMetadata={title:string;description:string;robots:"noindex,nofollow"};
const SEO_ROBOTS="noindex,nofollow" as const;
const infoTitle:Record<InfoTopic,string>={
 help:"مركز المساعدة",privacy:"سياسة الخصوصية",terms:"شروط الاستخدام",
 "shipping-returns":"الدفع والتوصيل والاسترجاع"
};
function meta(market:MarketCode,title:string,description:string):PageMetadata{
 const name=marketIdentity[market].name;
 return {title:title+" | يومياتي "+name,description:description.trim().slice(0,220),robots:SEO_ROBOTS};
}
export function infoPageMetadata(market:MarketCode,topic:string):PageMetadata{
 if(!Object.prototype.hasOwnProperty.call(infoTitle,topic))return meta(market,"معلومات المتجر","تفاصيل يومياتي "+marketIdentity[market].name);
 const t=topic as InfoTopic,c=customerServiceCopy[market];
 const descriptions:Record<InfoTopic,string>={
  help:"اكتشفي طرق البحث والتصفح والمساعدة في يومياتي "+marketIdentity[market].name+".",
  privacy:"معلومات عن الخصوصية وحماية البيانات أثناء استخدام يومياتي.",
  terms:"اطلعي على شروط استخدام موقع يومياتي ومعلومات التسوق والمنتجات.",
  "shipping-returns":c.shippingIntro
 };
 return meta(market,infoTitle[t],descriptions[t]);
}
export function categoryPageMetadata(market:MarketCode,slug:string):PageMetadata{
 const planned=planCategorySeo(market,slug);
 if(!planned)return meta(market,"القسم غير موجود","تصفّحي أقسام يومياتي "+marketIdentity[market].name+".");
 const category=planned.title.split(" | ")[0];
 const description=marketExperience[market].categoryCaptions[slug]??
  "استكشفي أفكار واختيارات يومياتي حسب القسم.";
 return meta(market,category,"اكتشفي "+category+" في يومياتي "+marketIdentity[market].name+". "+description);
}
export function storyPageMetadata(market:MarketCode):PageMetadata{
 const story=brandStory[market];
 return meta(market,"قصتنا",story.lead);
}
/** Detail title only when matched to a verified public listing. */
export function productPageMetadata(market:MarketCode,listing?:PublicListing|null):PageMetadata{
 const planned=listing?planProductSeo(market,listing):null;
 if(!planned)return meta(market,"تفاصيل المنتج","تعرّفي على معلومات منتجات يومياتي "+marketIdentity[market].name+".");
 return {title:planned.title,description:planned.description,robots:SEO_ROBOTS};
}
