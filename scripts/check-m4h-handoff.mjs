#!/usr/bin/env node
/** Offline handoff validation. This is NOT a live provider/database/deploy test. */
import {readFileSync,existsSync} from "node:fs";
import {join,resolve,sep} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const fail=why=>{throw Error("M4H handoff invalid: "+why);};
const raw=readFileSync(join(root,"docs/handoff/M4H-STATUS.json"),"utf8");
const x=JSON.parse(raw);
if(x.schemaVersion!==1||x.project!=="Yawmiyati"||x.repository!=="tarikhtube-stack/saudi-store-spark"||x.type!=="source_only_handoff")fail("identity");
const expected=[["sa","SAR",2,"28"],["ae","AED",2,"19"],["om","OMR",3,"3"],["eg","EGP",2,"95/100/105 by exact destination (screenshot only)"],["iq","IQD",3,"7000"]];
if(JSON.stringify(x.markets.map(m=>[m.code,m.currency,m.minorDigits,m.shippingGuide]))!==JSON.stringify(expected))fail("market_shipping_currency");
if(Object.values(x.restrictions).some(v=>v!==false)||Object.keys(x.restrictions).length!==8)fail("unsafe_release_flags");
if(x.current.m4h!=="pr_pending_ci"||x.current.supplierProductImport!=="not_connected"||x.current.localizedAI!=="offline_contract_only"||x.current.publicSEO!=="noindex")fail("false_live_status");
if(x.activeHandoffPaths.length<12||new Set(x.activeHandoffPaths).size!==x.activeHandoffPaths.length||x.launchBlockers.length<10)fail("incomplete_handoff");
for(const path of x.activeHandoffPaths){
 if(typeof path!=="string"||path.startsWith("/")||path.split("/").includes("..")||path.includes("\\"))fail("unsafe_path");
 const p=resolve(root,path);
 if(!p.startsWith(root+sep)||!existsSync(p))fail("missing "+path);
}
const customerFiles=[
 "src/lib/store/saudi-commerce-content.ts",
 "src/lib/store/market-policy-pages.ts",
 "src/components/store/MarketPreview.tsx",
 "src/components/store/StoreInfoPage.tsx"
];
for(const path of customerFiles){
 const src=readFileSync(join(root,path),"utf8");
 // Compare string content (comments describing internal evidence are not rendered).
 const quoted=[...src.matchAll(/"([^"\n]*)"/g)].map(m=>m[1]).join("\n");
 if(/المورّد|المورد|Taager|تاجر/i.test(quoted))fail("upstream_provider_mentioned_in_customer_copy:"+path);
}
console.log("M4H handoff status verified: five markets, honest shipping gaps, no provider disclosure or live-release authorization.");
