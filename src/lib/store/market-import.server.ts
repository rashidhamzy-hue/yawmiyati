import {markets,type MarketCode} from "./markets";
import {normalizeImportCandidate} from "./import-candidates";
import {createWooReader,type WooConfig} from "./woo.server";
type Candidate=ReturnType<typeof normalizeImportCandidate>;
export type MarketImportResult={market:MarketCode;pages:number;received:number;staged:number;skipped:number;complete:boolean};
export async function importMarket(config:WooConfig,options:{maxPages:number;startPage?:number;asOf:string},save:(market:MarketCode,rows:Candidate[])=>Promise<number>,request:typeof fetch=fetch):Promise<MarketImportResult>{
 if(!Object.hasOwn(markets,config.market)||!Number.isInteger(options.maxPages)||options.maxPages<1||options.maxPages>20||!Number.isFinite(Date.parse(options.asOf)))throw Error("Invalid import context");
 const start=options.startPage??1;
 if(!Number.isInteger(start)||start<1||start+options.maxPages-1>10000)throw Error("Invalid pagination");
 const reader=createWooReader(config,request);
 const result:MarketImportResult={market:config.market,pages:0,received:0,staged:0,skipped:0,complete:false};
 const seen=new Set<string>();
 for(let page=start;page<start+options.maxPages;page++){
  const response=await reader.listProducts(page);
  if(response.market!==config.market||response.records.length>50)throw Error("Invalid supplier page");
  const rows:Candidate[]=[];
  for(const record of response.records){
   let row:Candidate;
   try{row=normalizeImportCandidate(config.market,record,options.asOf);}catch{result.skipped++;continue;}
   const id=String(row.woo_product_id)+":"+row.woo_variation_id;
   if(seen.has(id)){result.skipped++;continue;}seen.add(id);rows.push(row);
  }
  if(rows.length){
   const count=await save(config.market,rows);
   if(!Number.isInteger(count)||count<0||count>rows.length)throw Error("Persistence count invalid");
   result.staged+=count;
  }
  result.pages++;result.received+=response.records.length;
  if(response.records.length<50){result.complete=true;break;}
 }
 return result;
}
// Only reads products. No stock verification, deletion, publication or order submission.
