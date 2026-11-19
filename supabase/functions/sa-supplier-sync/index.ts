import {handle} from "./supplier.mjs";
const origin="https://yawmiyati-owner-staging.rashid-hamzy.workers.dev";
const cors={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin","Cache-Control":"no-store"};
Deno.serve(async(req)=>{
 const o=req.headers.get("origin");
 if(o!==origin)return new Response(null,{status:403});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return new Response(null,{status:405,headers:cors});
 const env={SUPABASE_PUBLISHABLE_KEY:Deno.env.get("SUPABASE_ANON_KEY"),WOO_SA_ORIGIN:Deno.env.get("WOO_SA_ORIGIN"),WOO_SA_CONSUMER_KEY:Deno.env.get("WOO_SA_CONSUMER_KEY"),WOO_SA_CONSUMER_SECRET:Deno.env.get("WOO_SA_CONSUMER_SECRET")};
 const request=new Request("https://internal.invalid/sync?page=1",{method:"POST",headers:{Authorization:req.headers.get("Authorization")||""}});
 const response=await handle(request,env);
 return new Response(response.body,{status:response.status,headers:{...cors,"Content-Type":"application/json"}});
});