// Prints a compact Lighthouse summary plus the top findings that drive performance.
// Usage: node scripts/lighthouse-summary.mjs lh/*.report.json
import {readFileSync} from "node:fs";
const ids=["render-blocking-insight","render-blocking-resources","unused-javascript","uses-responsive-images","image-delivery-insight","largest-contentful-paint-element","lcp-discovery-insight","bootup-time","mainthread-work-breakdown","font-display-insight","label-content-name-mismatch","color-contrast","heading-order"];
for(const file of process.argv.slice(2)){
  const r=JSON.parse(readFileSync(file,"utf8"));const c=r.categories;const a=r.audits;
  const s=k=>Math.round((c[k]?.score??0)*100);
  console.log(`\n=== ${r.finalDisplayedUrl} | perf ${s("performance")} a11y ${s("accessibility")} bp ${s("best-practices")} seo ${s("seo")} | LCP ${a["largest-contentful-paint"]?.displayValue} TBT ${a["total-blocking-time"]?.displayValue} CLS ${a["cumulative-layout-shift"]?.displayValue} bytes ${Math.round((a["total-byte-weight"]?.numericValue??0)/1024)}KB`);
  for(const id of ids){
    const x=a[id]; if(!x||x.score===null||x.score>=0.9) continue;
    console.log(`  ## ${id} ${x.displayValue??""}`);
    const items=x.details?.items??[];
    for(const it of items.slice(0,6)){
      const o={};
      for(const k of ["url","wastedBytes","totalBytes","wastedMs","total","scripting","groupLabel","duration"]) if(it[k]!==undefined) o[k]=typeof it[k]==="number"?Math.round(it[k]):it[k];
      if(it.node?.snippet) o.node=it.node.snippet.slice(0,200);
      if(it.items) o.sub=JSON.stringify(it.items).slice(0,400);
      console.log("    "+JSON.stringify(o).slice(0,500));
    }
  }
}
