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

export function candidateSink(origin:string, serviceKey:string, request:typeof fetch=fetch){
 const url=new URL(origin);
 if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash||!serviceKey)throw new Error("Invalid database configuration");
 return async(rows:Candidate[])=>{
 if(!rows.length)return;
 const response=await request(new URL("/rest/v1/catalog_import_candidates?on_conflict=store_code,woo_product_id,woo_variation_id",url),{
 method:"POST",headers:{apikey:serviceKey,Authorization:"Bearer "+serviceKey,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(rows),redirect:"error",signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error("Candidate persistence failed");
 };
}
