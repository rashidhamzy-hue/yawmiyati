import {createWooReader,type WooConfig} from "./woo.server";
import {normalizeImportCandidate} from "./import-candidates";
type Candidate=ReturnType<typeof normalizeImportCandidate>;
export async function importProductPage(config:WooConfig,page:number,save:(rows:Candidate[])=>Promise<void>,request:typeof fetch=fetch){
 const result=await createWooReader(config,request).listProducts(page);
 const rows:Candidate[]=[];let skipped=0;
 const observedAt=new Date().toISOString();
 for(const raw of result.records){
  try{rows.push(normalizeImportCandidate(config.market,raw,observedAt));}catch{skipped++;}
 }
 if(rows.length)await save(rows);
 return {market:config.market,received:result.records.length,staged:rows.length,skipped};
}
