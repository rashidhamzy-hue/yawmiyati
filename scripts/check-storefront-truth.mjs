#!/usr/bin/env node
/**
 * Fail-closed, source-only public-route truth guard. No network, no deployment.
 * Legacy catalog/cart/ProductCard remain quarantined as old, unused modules.
 * This guard covers active storefront route entrypoints and components, not all
 * possible dynamic imports; runtime and security acceptance remains separate.
 */
import {readFileSync,readdirSync} from "node:fs";
import {join} from "node:path";
const root=process.cwd();
const bad=[];
const storefront=[
 "src/components/store/MarketPreview.tsx",
 "src/components/store/MarketPromiseStrip.tsx",
 "src/components/store/StoreInfoPage.tsx",
 "src/components/store/StoreCommerceGuard.tsx",
 "src/components/store/StoreChrome.tsx",
 "src/lib/store/saudi-commerce-content.ts",
 "src/lib/store/market-policy-pages.ts",
 "src/lib/store/market-experience.ts",
 "src/lib/store/brand-story.ts",
];
// Owner-provided quote amounts may be shown only with explicit provenance and
// conditional language in the same source statement. Numbers are not proof of
// enabled checkout, confirmed shipping or a binding seller return policy.
const risky=/(?:٢٨\s*(?:ر\.س|ريالاً)|١٩\s*درهماً|٣\s*ريالات\s*عُمانية|٧[٬,]?٠٠٠\s*دينار(?:اً)?|٢٤[–-]٤٨\s*ساعة|٢[–-]٣\s*أيام|٤[–-]٥\s*أيام)/;
const qualifiers=/(?:إرشادي|إرشادياً|تقدير|المورّد السابق|عرض المورّد|غير مضمون|غير مضمونة|يحتاج|تحتاج|سابقة|بحسب|غير معتمد)/;
for(const path of storefront){
 const text=readFileSync(join(root,path),"utf8");
 for(const [lineNumber,line] of text.split("\n").entries()){
  // Customer-visible quoted copy must not name or allude to the upstream supplier.
  if(/"[^"\n]*(?:المورّد|المورد|Taager|تاجر)[^"\n]*"/i.test(line))bad.push(path+":"+(lineNumber+1)+": supplier reference in customer copy");
  if(risky.test(line)&&!qualifiers.test(line))bad.push(path+":"+(lineNumber+1)+": unqualified owner-supplied supplier quote");
 }
 if(/(?:from\s*|import\s*\()\s*["'][^"']*(?:\/|\.)catalog["']/.test(text))
  bad.push(path+": legacy fictional catalog import");
}
const routesDir=join(root,"src/routes");
for(const file of readdirSync(routesDir)){
 if(!/\.[jt]sx?$/.test(file))continue;
 const source=readFileSync(join(routesDir,file),"utf8");
 if(/(?:from\s*|import\s*\()\s*["'][^"']*(?:\/|\.)catalog["']/.test(source)||
  /(?:from\s*|import\s*\()\s*["'][^"']*(?:\/|\.)cart["']/.test(source)||
  /ProductCard|CartProvider/.test(source))bad.push("src/routes/"+file+": legacy cart/catalog import");
}
const rootSource=readFileSync(join(routesDir,"__root.tsx"),"utf8");
if(!rootSource.includes('{ name: "robots", content: "noindex,nofollow" }')||
 rootSource.includes("VITE_YAWMIYATI_PUBLIC_INDEXING_ENABLED"))
 bad.push("root robots directive must remain unconditional noindex");
const index=readFileSync(join(routesDir,"sa.index.tsx"),"utf8");
const search=readFileSync(join(routesDir,"sa.search.tsx"),"utf8");
if(!index.includes('name:"robots",content:"noindex,nofollow"')||
 !search.includes('name:"robots",content:"noindex,nofollow"'))bad.push("Saudi home/search must remain noindex");
if(bad.length){console.error(bad.join("\n"));process.exit(1);}
console.log("Storefront truth and prelaunch noindex boundary passed.");
