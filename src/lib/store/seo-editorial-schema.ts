/**
 * Source-only editorial SEO payloads. These do not authorize indexing,
 * publish a sitemap, or describe products that have not been released.
 * The future server release adapter must independently verify the domain,
 * market approvals and the published route inventory before emitting them.
 */
import {marketExperience} from "./market-experience";
import {marketIdentity} from "./market-identity";
import {saudiHomeQuestions} from "./saudi-commerce-content";
import {SEO_EDITORIAL_SLUGS,planCategorySeo} from "./seo-planning";
import type {MarketCode} from "./markets";

const markets=["sa","ae","om","eg","iq"] as const;
const languages={sa:"ar-SA",ae:"ar-AE",om:"ar-OM",eg:"ar-EG",iq:"ar-IQ"} as const;
function originOf(value:string){
 const u=new URL(value);
 if(u.protocol!=="https:"||u.username||u.password||u.pathname!=="/"||u.search||u.hash||u.port||!u.hostname.includes(".")||/\.(?:test|localhost|invalid)$/.test(u.hostname)||u.hostname.endsWith(".lovable.app"))throw Error("production_origin_required");
 return u.origin;
}
export function editorialSeoDraft(proposedOrigin:string,market:MarketCode,category?:string){
 if(!markets.includes(market))throw Error("invalid_market");
 if(category!==undefined&&!SEO_EDITORIAL_SLUGS.some(s=>s===category))throw Error("invalid_category");
 const origin=originOf(proposedOrigin),suffix=category?"/c/"+category:"";
 const canonical=origin+"/"+market+suffix;
 const home=origin+"/"+market;
 const title=category?planCategorySeo(market,category)!.title.split(" | ")[0]:marketIdentity[market].fullName;
 const questions=market==="sa"?saudiHomeQuestions:marketExperience[market].questions;
 const organization={"@type":"Organization","@id":origin+"/#organization",name:"يومياتي",url:origin,areaServed:markets.map(m=>({"@type":"Country",name:marketIdentity[m].fullName}))};
 const website={"@type":"WebSite","@id":origin+"/#website",name:"يومياتي",url:origin,publisher:{"@id":organization["@id"]},inLanguage:"ar"};
 const schema=category?[{"@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"يومياتي "+marketIdentity[market].name,item:home},{"@type":"ListItem",position:2,name:title,item:canonical}]}]:[organization,website,{"@type":"FAQPage",inLanguage:languages[market],mainEntity:questions.map(q=>({"@type":"Question",name:q.question,acceptedAnswer:{"@type":"Answer",text:q.answer}}))}];
 return {mode:"OFFLINE_DRAFT" as const,releaseAuthorized:false as const,proposedCanonical:canonical,proposedAlternates:markets.map(m=>({hreflang:languages[m],href:origin+"/"+m+suffix})),proposedSchema:{"@context":"https://schema.org","@graph":schema}};
}
export function editorialSitemapDraft(proposedOrigin:string){
 const origin=originOf(proposedOrigin);
 return {mode:"OFFLINE_DRAFT" as const,releaseAuthorized:false as const,proposedUrls:markets.flatMap(m=>[origin+"/"+m,...SEO_EDITORIAL_SLUGS.map(s=>origin+"/"+m+"/c/"+s)])};
}
