import {marketExperience} from "./market-experience";
import {marketIdentity} from "./market-identity";
import {saudiHomeQuestions} from "./saudi-commerce-content";
import {planCategorySeo} from "./seo-planning";
import {markets,type MarketCode} from "./markets";
/** Truthful editorial markup only. No production URL, offers, stock or release authorization. */
export function editorialSchema(market:MarketCode,category?:string){
 const language=markets[market].locale;
 if(category!==undefined){
  const page=planCategorySeo(market,category);
  if(!page)return null;
  return {"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[
   {"@type":"ListItem",position:1,name:"يومياتي "+marketIdentity[market].name,item:"/"+market+"/"},
   {"@type":"ListItem",position:2,name:page.title.split(" | ")[0],item:page.relativePath}
  ]};
 }
 const questions=market==="sa"?saudiHomeQuestions:marketExperience[market].questions;
 return {"@context":"https://schema.org","@graph":[
  {"@type":"Organization","@id":"#yawmiyati-organization",name:"يومياتي"},
  {"@type":"WebSite",name:"يومياتي",inLanguage:language,publisher:{"@id":"#yawmiyati-organization"}},
  {"@type":"FAQPage",inLanguage:language,mainEntity:questions.map(q=>({"@type":"Question",name:q.question,acceptedAnswer:{"@type":"Answer",text:q.answer}}))}
 ]};
}
export function serializeEditorialSchema(value:NonNullable<ReturnType<typeof editorialSchema>>){
 return JSON.stringify(value).replace(/</g,"\\u003c").replace(/>/g,"\\u003e").replace(/&/g,"\\u0026");
}
