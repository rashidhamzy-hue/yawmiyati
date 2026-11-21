#!/usr/bin/env node
/**
 * M4G zero-network adversarial fixture test of the actual storefront truth
 * executable (not a separately reimplemented regex). All files are temporary.
 */
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";

const root=mkdtempSync(join(tmpdir(),"yawmiyati-m4g-truth-"));
const script=resolve(dirname(fileURLToPath(import.meta.url)),"check-storefront-truth.mjs");
const paths=[
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
];
const write=(path,content)=>{const full=join(root,path);mkdirSync(dirname(full),{recursive:true});writeFileSync(full,content);};
const run=()=>spawnSync(process.execPath,[script],{cwd:root,encoding:"utf8",timeout:10000});
const check=(expected,stage)=>{const result=run();if((result.status===0)!==expected)throw Error(stage+": "+result.stderr+" "+result.stdout);return result;};
try{
 for(const path of paths)write(path,"export const safe = true;\n");
 write("src/routes/__root.tsx",'export const meta = { name: "robots", content: "noindex,nofollow" };\n');
 write("src/routes/sa.index.tsx",'export const seo = {name:"robots",content:"noindex,nofollow"};\n');
 write("src/routes/sa.search.tsx",'export const seo = {name:"robots",content:"noindex,nofollow"};\n');
 check(true,"baseline");
 // Deliberately split the quote onto the next line to catch an incorrect
 // literal "\\n" splitter and a doubly escaped regex.
 write(paths[1],"export const heading = 'توصيل آمن';\nexport const raw = 'أجرة الشحن ٧٬٠٠٠ دينار عراقي';\n");
 const bad=check(false,"unqualified_multiline_quote");
 if(!bad.stderr.includes("unqualified owner-supplied supplier quote"))throw Error("quote rule did not fire");
 write(paths[1],"export const guidance = 'بحسب عرض المورّد السابق، الشحن ٧٬٠٠٠ دينار عراقي إرشادي ويحتاج تأكيداً قبل الطلب';\n");
 check(false,"previous_provider_phrase_is_banned");
 write(paths[1],'export const awkward = "الشحن الإرشادي ١٩ درهماً";\n');
 check(false,"unnatural_advisory_wording_is_banned");
 write(paths[1],"export const leaked = 'بحسب عرض المورّد السابق';\n");
 // The production copy uses double quoted TS strings; exercise that exact form.
 write(paths[1],'export const leaked = "بحسب عرض المورّد السابق";\n');
 const leaked=check(false,"upstream_supplier_mentioned_to_customer");
 if(!leaked.stderr.includes("internal source or awkward advisory wording in customer copy"))throw Error("customer copy rule did not fire");
 write(paths[1],'export const customer = "الشحن التقديري ٧٬٠٠٠ دينار عراقي؛ السعر يحتاج تأكيداً قبل الطلب";\n');
 check(true,"customer_branded_estimate");

 write(paths[1],"import {catalog} from './catalog';\n");
 check(false,"legacy_catalog_import");
 write(paths[1],"export const safe = true;\n");
 write("src/routes/__root.tsx",'export const meta = { name: "robots", content: "index,follow" };\n');
 check(false,"noindex_removed");
 console.log("M4G storefront truth guard adversarial fixtures passed.");
}finally{
 rmSync(root,{recursive:true,force:true});
}
