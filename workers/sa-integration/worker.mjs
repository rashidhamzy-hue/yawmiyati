function timeoutSignal(ms){const controller=new AbortController();setTimeout(()=>controller.abort(),ms);return controller.signal;}
function failureKind(e){return e?.name==="AbortError"||e?.name==="TimeoutError"?"timeout":e?.name==="TypeError"?"network-or-runtime":e?.name==="SyntaxError"?"invalid-response":"runtime";}
const db="https://skhtunkknshvolturqlm.supabase.co";
const woo="https://logwave.s6-tastewp.com";
const headers={"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow","Content-Type":"application/json"};
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
const str=(v,n)=>typeof v==="string"?v.slice(0,n):"";
const list=(v,n)=>Array.isArray(v)?v.slice(0,n):[];
function minor(v){if(typeof v!=="string"||!/^\d{1,10}(\.\d{1,2})?$/.test(v))return null;const [a,b=""]=v.split(".");const x=Number(a)*100+Number(b.padEnd(2,"0"));return Number.isSafeInteger(x)?x:null;}
function url(v){try{const u=new URL(v);return u.protocol==="https:"&&!u.username&&!u.password?u.href.slice(0,1000):null}catch{return null}}
export function normalize(p,at){
 if(!p||p.type!=="simple"||!Number.isSafeInteger(p.id)||p.id<=0||typeof p.sku!=="string"||!p.sku.trim()||p.sku.length>200||typeof p.name!=="string"||!p.name.trim()||p.name.length>500)return null;
 return {woo_product_id:p.id,supplier_sku:p.sku,title:p.name,observed_price_minor:minor(p.price),observed_stock:p.stock_status==="outofstock"?"unavailable":"unknown",observed_at:at,
 supplier_snapshot:{description:str(p.description,10000),short_description:str(p.short_description,4000),images:list(p.images,12).map(i=>url(i?.src)).filter(Boolean),categories:list(p.categories,12).map(c=>({id:c?.id,name:str(c?.name,200)})),stock_status:str(p.stock_status,40),stock_quantity:Number.isSafeInteger(p.stock_quantity)?p.stock_quantity:null,manage_stock:p.manage_stock===true,regular_price:str(p.regular_price,40),sale_price:str(p.sale_price,40),type:p.type,attributes:list(p.attributes,12).map(a=>({name:str(a?.name,100),options:list(a?.options,12).map(o=>str(o,100))})),metadata_keys:list(p.meta_data,40).map(m=>str(m?.key,100)).filter(Boolean)}};
}
async function boundedJson(response){
 const reader=response.body?.getReader();if(!reader)throw Error("Missing body");const decoder=new TextDecoder();let size=0,text="";
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1500000){await reader.cancel();throw Error("Response too large");}text+=decoder.decode(value,{stream:true});}return JSON.parse(text+decoder.decode());}finally{reader.releaseLock();}
}
export async function handle(request,env,send=(input,init)=>globalThis.fetch(input,init)){
 const u=new URL(request.url);
 if(request.method!=="POST"||u.pathname!=="/sync")return reply(404,{error:"Not found"});
 const bearer=request.headers.get("Authorization");
 if(!bearer||bearer.length>4096||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bearer))return reply(401,{error:"Owner authentication required"});
 if(!env.SUPABASE_PUBLISHABLE_KEY||!env.WOO_SA_CONSUMER_KEY||!env.WOO_SA_CONSUMER_SECRET||env.WOO_SA_ORIGIN!==woo)return reply(503,{error:"Integration not configured"});
 const page=Number(u.searchParams.get("page")??"1");
 if(!Number.isInteger(page)||page<1||page>20)return reply(400,{error:"Invalid page"});
 const rpc=(name,body)=>send(db+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:bearer,"Content-Type":"application/json"},body:JSON.stringify(body),redirect:"error",signal:timeoutSignal(15000)});
 let step="owner-membership";
 try{
 const membership=await rpc("dashboard_ai_policy",{p_store:"sa"});
 if(!membership.ok)return reply(403,{error:"Saudi owner access required"});
 const policy=await boundedJson(membership);if(!policy||policy.store_code!=="sa")return reply(403,{error:"Saudi owner access required"});
 step="woo-read";const upstream=await send(woo+"/wp-json/wc/v3/products?per_page=20&page="+page,{headers:{Authorization:"Basic "+btoa(env.WOO_SA_CONSUMER_KEY+":"+env.WOO_SA_CONSUMER_SECRET)},redirect:"error",signal:AbortSignal.timeout(15000)});
 if(!upstream.ok)return reply(502,{error:"WooCommerce request failed",upstream_status:upstream.status});
 const products=await boundedJson(upstream);if(!Array.isArray(products)||products.length>20)return reply(502,{error:"Invalid supplier response"});
 const at=new Date().toISOString(),rows=products.map(p=>normalize(p,at)).filter(Boolean);
 if(!rows.length)return reply(200,{received:products.length,staged:0,skipped:products.length,page});
 step="candidate-write";const saved=await rpc("stage_sa_supplier_candidates",{p_rows:rows});
 if(!saved.ok)return reply(502,{error:"Candidate persistence failed"});
 const staged=await boundedJson(saved);if(!Number.isInteger(staged)||staged<0||staged>rows.length)return reply(502,{error:"Invalid persistence response"});
 return reply(200,{received:products.length,staged,skipped:products.length-rows.length,page});
 }catch(e){return reply(502,{error:"Supplier integration failed: "+step+" ("+failureKind(e)+")"});}
}
export default {fetch(request,env){return handle(request,env)}};
