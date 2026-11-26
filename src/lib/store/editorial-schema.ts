import {marketExperience} from "./market-experience";
import {saudiHomeQuestions} from "./saudi-commerce-content";
import {planCategorySeo} from "./seo-planning";
import {markets,type MarketCode} from "./markets";
import {breadcrumbNode,organizationNode,serializeJsonLd,websiteNode} from "@/lib/seo/structured-data";
/** Truthful editorial markup only: store identity, site search, visible FAQ and breadcrumbs. No offers or stock. */
export function editorialSchema(market:MarketCode,category?:string){
 const language=markets[market].locale;
 if(category!==undefined){
  const page=planCategorySeo(market,category);
  if(!page)return null;
  return {"@context":"https://schema.org",...breadcrumbNode(market,[{name:page.title.split(" | ")[0],suffix:"/c/"+category}])};
 }
 const questions=market==="sa"?saudiHomeQuestions:marketExperience[market].questions;
 return {"@context":"https://schema.org","@graph":[
  organizationNode(),
  websiteNode(market),
  {"@type":"FAQPage",inLanguage:language,mainEntity:questions.map(q=>({"@type":"Question",name:q.question,acceptedAnswer:{"@type":"Answer",text:q.answer}}))}
 ]};
}
export function serializeEditorialSchema(value:NonNullable<ReturnType<typeof editorialSchema>>){
 return serializeJsonLd(value);
}
