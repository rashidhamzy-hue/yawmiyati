/**
 * M5B: offline, fact-traceable country-specific editorial package.
 * Does not translate or call a model. Every proposed field must be reviewed.
 */
import type {MarketCode} from "./markets";
import {validateContentDraft} from "./research-evidence";
export type EditorialField="title"|"description"|"seoTitle"|"seoDescription"|"faq"|"imageAlt";
export type EditorialProposal={field:EditorialField;segments:readonly {text:string;factIds:readonly string[]}[]};
export type EditorialPackage={
 market:MarketCode;sku:string;revision:string;
 proposals:readonly EditorialProposal[];
};
export type EditorialCheck={
 status:"needs_human_review"|"rejected";
 issues:readonly string[];
 fields:readonly EditorialField[];
 canPublish:false;canIndex:false;canAdvertise:false;
};
const fields:readonly EditorialField[]=["title","description","seoTitle","seoDescription","faq","imageAlt"];
const limits:Record<EditorialField,number>={title:120,description:4000,seoTitle:70,seoDescription:170,faq:2500,imageAlt:180};
const unsafe=/(?:\b(?:guaranteed|miracle cure|clinically proven|free shipping|only \d+ left)\b|مضمون ١٠٠|يشفي|يعالج|شحن مجاني|المورّد|المورد|تاچر|تاجر|Taager|supplier)/i;
export function validateEditorialPackage(pkg:EditorialPackage,verifiedFactIds:readonly string[]):EditorialCheck{
 const issues:string[]=[];
 if(!["sa","ae","om","eg","iq"].includes(pkg.market)||!pkg.sku?.trim()||!pkg.revision?.trim())issues.push("invalid_identity");
 if(!verifiedFactIds.length||new Set(verifiedFactIds).size!==verifiedFactIds.length)issues.push("missing_fact_registry");
 if(!Array.isArray(pkg.proposals)||!pkg.proposals.length||pkg.proposals.length>fields.length)issues.push("invalid_field_count");
 const seen=new Set<EditorialField>();
 for(const proposal of pkg.proposals??[]){
  if(!fields.includes(proposal.field)||seen.has(proposal.field)){issues.push("duplicate_or_unknown_field");continue;}
  seen.add(proposal.field);
  try{
   const draft=validateContentDraft({segments:proposal.segments},verifiedFactIds);
   const text=draft.segments.map(s=>(s as {text:string}).text).join(" ");
   if(text.length>limits[proposal.field])issues.push("field_too_long:"+proposal.field);
   if(unsafe.test(text))issues.push("unsafe_or_upstream_copy:"+proposal.field);
  }catch{issues.push("untraceable_field:"+proposal.field);}
 }
 return {status:issues.length?"rejected":"needs_human_review",issues,fields:[...seen],
  canPublish:false,canIndex:false,canAdvertise:false};
}
