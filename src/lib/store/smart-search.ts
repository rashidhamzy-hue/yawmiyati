import type {PublicListing} from "./public-catalog";
export type SearchCategory="home"|"kitchen"|"beauty"|"fashion"|"wellness"|"organize";
export const SEARCH_GROUPS=[
 {slug:"home",title:"المنزل والديكور",terms:["منزل","بيت","ديكور","اثاث","غرفة","home","decor","furniture"]},
 {slug:"kitchen",title:"المطبخ والقهوة",terms:["مطبخ","قهوة","كوب","اكواب","دلة","دله","coffee","kitchen","cup"]},
 {slug:"beauty",title:"الجمال والعناية",terms:["جمال","مكياج","بشرة","عناية","كريم","سيروم","beauty","skincare","serum"]},
 {slug:"fashion",title:"الأزياء والإكسسوارات",terms:["ازياء","موضة","ملابس","عباية","حقيبة","اكسسوارات","fashion","accessories","bag"]},
 {slug:"wellness",title:"الراحة والرفاهية",terms:["راحة","رفاهية","استرخاء","عطر","شمعة","wellness","relax"]},
 {slug:"organize",title:"التنظيم الذكي",terms:["تنظيم","ترتيب","تخزين","صندوق","رفوف","organize","storage","organizer"]},
] as const;
const synonyms:Record<string,string[]>={
 "قهوة":["دله","دلة","فنجان","اكواب","قهوه","coffee"],
 "دلة":["قهوة","قهوه","دله"],
 "مكياج":["تجميل","makeup","cosmetics"],
 "بشرة":["عناية","كريم","سيروم","skin"],
 "تنظيم":["ترتيب","تخزين","organizer"],
 "حقيبة":["شنطة","شنطه","bag"],
 "عباية":["عباءه","عباءة","abaya"],
 "بيت":["منزل","ديكور","home"],
 "هدية":["هدايا","gift"],
};
export function normalizeSearch(value:string){
 return value.normalize("NFKC").toLocaleLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,"").replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
}
function tokens(query:string){return normalizeSearch(query).split(" ").filter(Boolean).slice(0,8);}
function distance(a:string,b:string,max=2){
 if(Math.abs(a.length-b.length)>max)return max+1;
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const next=[i];let floor=next[0];for(let j=1;j<=b.length;j++){const v=Math.min(next[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));next[j]=v;floor=Math.min(floor,v);}if(floor>max)return max+1;prev=next;}
 return prev[b.length];
}
function tokenScore(query:string,titleTokens:string[],title:string){
 if(title===query)return 120;
 if(title.startsWith(query))return 90;
 if(title.includes(query))return 65;
 let best=0;
 for(const word of titleTokens){
  if(word===query)best=Math.max(best,45);
  else if(word.startsWith(query)||query.startsWith(word))best=Math.max(best,27);
  else if(query.length>=4&&distance(query,word,2)<=1)best=Math.max(best,15);
 }
 const aliases=synonyms[query]??[];
 for(const alias of aliases){const norm=normalizeSearch(alias);if(titleTokens.includes(norm)||title.includes(norm))best=Math.max(best,20);}
 return best;
}
/** Deterministic lexical intelligence on the *approved public catalog only*.
 * Arabic spelling normalization, synonyms, 1-edit typo tolerance, token ranking.
 * NOT a semantic vector/LLM backend; never manufactures missing products.
 */
export function smartCatalogSearch(query:string,listings:readonly PublicListing[],limit=40){
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw Error("Invalid search limit");
 const qs=tokens(query);
 if(!qs.length)return [...listings].slice(0,limit);
 return listings.map(listing=>{
  const title=normalizeSearch(listing.title),ws=title.split(" ");
  const scores=qs.map(q=>tokenScore(q,ws,title));const matched=scores.filter(x=>x>0).length;
  return {listing,score:matched===qs.length?scores.reduce((a,b)=>a+b,0)+35:scores.reduce((a,b)=>a+b,0)/2};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.listing.title.localeCompare(b.listing.title,"ar")).slice(0,limit).map(x=>x.listing);
}
export function suggestEditorialCategories(query:string){
 const qs=tokens(query);
 if(!qs.length)return SEARCH_GROUPS;
 return SEARCH_GROUPS.map(group=>({group,score:qs.reduce((score,q)=>score+group.terms.reduce((best,t)=>{const n=normalizeSearch(t);return Math.max(best,n===q?50:n.startsWith(q)||q.startsWith(n)?25:0);},0),0)}))
 .filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.group);
}
