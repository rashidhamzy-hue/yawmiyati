#!/usr/bin/env node
// Runs one reviewed SQL file on the staging database through the Supabase Management API. See .github/workflows/staging-sql.yml.
import {readFileSync} from "node:fs";

const STAGING="skhtunkknshvolturqlm";
/** What will be sent, or an Error for anything that is not a known migration or a rollback-only test. */
export function plan(kind,file,read=p=>readFileSync(p,"utf8")){
 if(kind==="migration"){
  const m=/^(\d{14})_([a-z0-9_]+)\.sql$/.exec(file);
  if(!m)throw Error("not a migration file name");
  const sql=read("supabase/migrations/"+file);
  if(/^\s*(begin|commit|rollback)\s*;/im.test(sql))throw Error("a migration must not manage its own transaction");
  return {label:"migration "+m[1]+" "+m[2],version:m[1],
   check:`select count(*)::int as n from supabase_migrations.schema_migrations where version = '${m[1]}' or name = '${m[2]}'`,
   sql:`begin;\n${sql}\n;insert into supabase_migrations.schema_migrations(version, name) values ('${m[1]}', '${m[2]}');\ncommit;`};
 }
 if(kind==="test"){
  if(!/^[a-z0-9-]+-test\.sql$/.test(file))throw Error("not a test file name");
  const sql=read("docs/"+file),bare=sql.replace(/--.*$/gm,"");
  if(!/^\s*begin\s*;/im.test(bare)||!/^\s*rollback\s*;\s*$/im.test(bare)||/\bcommit\b/i.test(bare))throw Error("a test must begin, end with rollback and never commit");
  return {label:"test "+file,sql};
 }
 throw Error("kind must be migration or test");
}
async function query(sql){
 const r=await fetch(`https://api.supabase.com/v1/projects/${STAGING}/database/query`,{method:"POST",
  headers:{authorization:"Bearer "+process.env.SUPABASE_ACCESS_TOKEN,"content-type":"application/json"},body:JSON.stringify({query:sql})});
 const body=await r.text();
 if(!r.ok)throw Error("database said: "+body.slice(0,1500));
 return body;
}
async function main(){
 if(process.env.PROJECT!==STAGING)throw Error("this script only talks to staging");
 if(!process.env.SUPABASE_ACCESS_TOKEN)throw Error("SUPABASE_ACCESS_TOKEN is not set");
 const p=plan(process.env.KIND,process.env.FILE);
 if(p.check){
  const seen=JSON.parse(await query(p.check));
  if(seen[0]?.n>0){console.log("ALREADY APPLIED: "+p.label+" — nothing done.");return;}
 }
 const out=await query(p.sql);
 console.log("OK: "+p.label+(p.version?" applied and recorded.":" passed (rolled back).")+" "+out.slice(0,300));
}
if(import.meta.url==="file://"+process.argv[1])main().catch(e=>{console.error("FAILED: "+e.message);process.exit(1);});
