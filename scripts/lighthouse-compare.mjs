// Median Lighthouse results per page for base (main) vs branch.
// Usage: node scripts/lighthouse-compare.mjs <dir with base__page__N.json / branch__page__N.json>
import {readFileSync,readdirSync} from "node:fs";
const dir=process.argv[2];
const rows={};
for(const f of readdirSync(dir).filter(f=>f.endsWith(".json"))){
  const [variant,page]=f.split("__");
  const r=JSON.parse(readFileSync(dir+"/"+f,"utf8"));const a=r.audits;
  const phases=Object.fromEntries((a["largest-contentful-paint-element"]?.details?.items?.[1]?.items??[]).map(x=>[x.phase,x.timing]));
  ((rows[page]??={})[variant]??=[]).push({
    perf:Math.round((r.categories.performance?.score??0)*100),lcp:a["largest-contentful-paint"]?.numericValue??0,
    fcp:a["first-contentful-paint"]?.numericValue??0,tbt:a["total-blocking-time"]?.numericValue??0,
    kb:(a["total-byte-weight"]?.numericValue??0)/1024,delay:phases["Load Delay"]??0,render:phases["Render Delay"]??0,
  });
}
const med=(xs,k)=>{const v=xs.map(x=>x[k]).sort((a,b)=>a-b);return v[Math.floor(v.length/2)]??0;};
const fmt=(xs)=>xs?`perf ${med(xs,"perf")} LCP ${(med(xs,"lcp")/1000).toFixed(2)}s FCP ${(med(xs,"fcp")/1000).toFixed(2)}s TBT ${Math.round(med(xs,"tbt"))} loadDelay ${Math.round(med(xs,"delay"))} renderDelay ${Math.round(med(xs,"render"))} ${Math.round(med(xs,"kb"))}KB`:"n/a";
for(const [page,v] of Object.entries(rows).sort()){
  console.log(`\n/${page.replace(/_/g,"/")}\n  main   : ${fmt(v.base)}\n  branch : ${fmt(v.branch)}`);
}
