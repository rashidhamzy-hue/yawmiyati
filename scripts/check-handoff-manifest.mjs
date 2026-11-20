#!/usr/bin/env node
/**
 * M3C: read-only handoff manifest integrity check.
 * No credentials, network calls, file mutations or production access.
 */
import {readFileSync,existsSync,statSync} from "node:fs";
import {join,resolve,relative,sep} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const file=join(root,"docs/handoff/ENGINEERING-MANIFEST.json");
const fail=(why)=>{throw new Error("Invalid handoff manifest: "+why);};
const value=JSON.parse(readFileSync(file,"utf8"));
if(value.schemaVersion!==1||value.project!=="Yawmiyati"||value.repo!=="tarikhtube-stack/saudi-store-spark")fail("identity");
if(!/^[a-f\d]{40}$/.test(value.baselineMainCommit))fail("baseline_commit");
const markets=[["sa","SAR",2],["ae","AED",2],["om","OMR",3],["eg","EGP",2],["iq","IQD",3]];
if(JSON.stringify(value.markets.map(m=>[m.code,m.currency,m.minorDigits]))!==JSON.stringify(markets))fail("market_currency_precision");
const flags=["catalog","checkout","fulfillment","paidAI","providerCalls","productionDeployment"];
if(flags.some(k=>value.releaseFlags?.[k]!==false)||Object.keys(value.releaseFlags??{}).length!==flags.length)fail("release_safety");
if(!Array.isArray(value.verifiedPaths)||value.verifiedPaths.length<25||new Set(value.verifiedPaths).size!==value.verifiedPaths.length)fail("verified_paths");
for(const path of value.verifiedPaths){
 if(typeof path!=="string"||path.startsWith("/")||path.includes("\\")||path.split("/").includes(".."))fail("unsafe_path");
 const absolute=resolve(root,path);
 if(!absolute.startsWith(root+sep)||!existsSync(absolute)||!statSync(absolute).isFile())fail("path_missing: "+path);
}
if(!value.verifiedPaths.includes("src/lib/store/catalog.ts")||!value.verifiedPaths.includes("scripts/check-simulation-boundary.mjs"))fail("critical_source_path");
if(!Array.isArray(value.milestones)||value.milestones.length!==7||value.milestones.some(m=>!m.status.startsWith("source_merged_ci_")))fail("milestone_scope");
if(!Array.isArray(value.blockers)||value.blockers.length<8||value.blockers.some(b=>b.requiresApproval!==true||!b.status))fail("release_blockers");
if(!Array.isArray(value.forbiddenUntilOwnerApproval)||value.forbiddenUntilOwnerApproval.length<6)fail("owner_approval");
if(!Array.isArray(value.commands)||!value.commands.includes("node scripts/check-simulation-boundary.mjs"))fail("validation_commands");
console.log("Engineering manifest verified: 5 markets, "+value.verifiedPaths.length+" source files, "+value.milestones.length+" source milestones; release flags remain off.");
