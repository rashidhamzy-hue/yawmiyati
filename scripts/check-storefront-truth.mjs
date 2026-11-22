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
 "src/components/store/StoreStoryPage.tsx",
 "src/components/store/StoreCategoryPage.tsx",
 "src/components/store/StoreSearchOverlay.tsx",
 "src/components/store/ShoppingAssistant.tsx",
 "src/lib/store/saudi-commerce-content.ts",
 "src/lib/store/market-policy-pages.ts",
 "src/lib/store/market-experience.ts",
 "src/lib/store/brand-story.ts",
 "src/lib/store/customer-service-copy.ts",
 "src/lib/store/shop-assistant.ts",
];
// Owner-provided quote amounts may be shown only with explicit provenance and
// conditional language in the same source statement. Numbers are not proof of
// enabled checkout, confirmed shipping or a binding seller return policy.
const risky=/(?:٢٨\s*(?:ر\.س|ريالاً)|١٩\s*درهماً|٣\s*ريالات\s*عُمانية|٧[٬,]?٠٠٠\s*دينار(?:اً)?|(?:٩٥|١٠٠|١٠٥)\s*جنيه|٢٤[–-]٤٨\s*ساعة|٢[–-]٣\s*أيام|٤[–-]٥\s*أيام)/;
const qualifiers=/(?:المتوقع|المتوقعة|متوقعة|متوقع|حسب|نؤكد|هنأكد|تأكيد|قبل|تختلف|قد تختلف)/;
for(const path of storefront){
 const text=readFileSync(join(root,path),"utf8");
 for(const [lineNumber,line] of text.split("\n").entries()){
  // Customer-visible quoted copy must not name or allude to the upstream supplier.
  const literal = /(["'`])(?:(?!\1).)*?(?:المورّد|المورد|الموّرد|Taager|تاجر|إرشادي|إرشادية|إرشادياً|المورِّد السابق|عرض المورّد|تقديرات سابقة)(?:(?!\1).)*?\1/i.test(line);
  const jsxText = />[^<>]*(?:المورّد|المورد|Taager|إرشادي|إرشادية|إرشادياً)[^<>]*</i.test(line);
  if(literal||jsxText)bad.push(path+":"+(lineNumber+1)+": internal source or awkward advisory wording in customer copy");
  // M9: keep approved customer copy direct; old 'coming soon' and
  // unverified shipping estimate language must never drift back.
  const placeholders=/(?:المتوقعة|المتوقع|سيكون متاحاً|ستكون متاحة|سيتم نشر|سنوضح|بنوضح|هنوضح|راح يتوفر|عند بدء استقبال الطلبات|بدء استقبال الطلبات|قبل بدء الطلبات|مع بدء الطلبات|مع تشغيل الطلبات|قبل تفعيل الطلبات|الشحن التقديري)/;
  if(placeholders.test(line))bad.push(path+":"+(lineNumber+1)+": forbidden coming-soon or speculative public copy");

  if(path!=="src/lib/store/customer-service-copy.ts"&&risky.test(line)&&!qualifiers.test(line))bad.push(path+":"+(lineNumber+1)+": unqualified owner-supplied supplier quote");
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
