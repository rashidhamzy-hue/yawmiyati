#!/usr/bin/env node
/**
 * M4G read-only release-boundary regression checks. Checks source invariants,
 * not deployment, live database configuration or supplier contracts.
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const file=path=>readFileSync(resolve(root,path),"utf8");
const failures=[];
function requireCheck(ok,label){if(!ok)failures.push(label);}
const market=file("src/lib/store/markets.ts");
const expected=[["sa","SAR",2],["ae","AED",2],["om","OMR",3],["eg","EGP",2],["iq","IQD",3]];
for(const [code,currency,digits] of expected){
 requireCheck(new RegExp("\\b"+code+":\\s*\\{\\s*currency:\\s*\""+currency+"\",\\s*minorDigits:\\s*"+digits+"\\b").test(market),"market_currency_"+code);
}
const historical=file("src/lib/store/historic-supplier-terms.ts");
for(const marker of ['amount:"28",currency:"SAR"','amount:"19",currency:"AED"','amount:"3",currency:"OMR"','amount:"7000",currency:"IQD"',"shippingQuote:null"]){
 requireCheck(historical.includes(marker),"historical_shipping_"+marker);
}
requireCheck(historical.includes("customerPriceAuthorized:false")&&historical.includes("checkoutEnabled:false"),"historical_not_authorized");
const index=file("src/routes/__root.tsx");
requireCheck(index.includes('{ name: "robots", content: "noindex,nofollow" }'),"global_noindex");
const files=["src/lib/store/seo-planning.ts","src/lib/store/offline-seo-release.ts","src/lib/store/offline-ai-workflows.ts","src/lib/store/offline-product-proof.ts"];
for(const path of files){
 const source=file(path);
 requireCheck(!/\b(import\(|fetch\(|XMLHttpRequest\(|sendBeacon\()/.test(source),"offline_module_network_boundary_"+path);
}
const seo=file("src/lib/store/offline-seo-release.ts");
requireCheck(seo.includes('publishableCount:0')&&seo.includes('sitemapXml:null')&&seo.includes('canonicalUrl:null')&&seo.includes('releaseAuthorized:false'),"seo_remains_nonpublic");
const ai=file("src/lib/store/offline-ai-workflows.ts");
for(const marker of ["canCallModel:false","canPublish:false","canLaunchAds:false","canSpend:false","canRecommendPublicly:false","aiDailyBudgetMicrousd:0"]){
 requireCheck(ai.includes(marker),"ai_zero_spend_"+marker);
}
const approval=file("src/lib/store/catalog-approval.ts");
requireCheck(approval.includes('marketReleaseAuthorized')&&approval.includes('stockVerified')&&approval.includes('commercialReviewCurrent'),"catalog_release_gates");
if(failures.length){console.error("M4G source-only release regression:\n"+failures.join("\n"));process.exit(1);}
console.log("M4G source-only five-market release and zero-spend invariants passed; no production assurance implied.");
