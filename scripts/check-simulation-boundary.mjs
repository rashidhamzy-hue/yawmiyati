#!/usr/bin/env node
/**
 * CI boundary check: simulation fixtures must never leak into public app code.
 * Only src/test and src/lib/store/simulation may import the simulator.
 * No third-party dependencies, and no modification of storefront routes.
 */
import {readdirSync,readFileSync,statSync} from "node:fs";
import {join,relative,sep} from "node:path";
const root=process.cwd();
const src=join(root,"src");
const violations=[];
function visit(folder){
 for(const entry of readdirSync(folder)){
  const absolute=join(folder,entry);
  if(statSync(absolute).isDirectory()){visit(absolute);continue;}
  if(!/\.[cm]?[jt]sx?$/.test(entry))continue;
  const rel=relative(root,absolute).split(sep).join("/");
  if(rel.startsWith("src/test/")||rel.startsWith("src/lib/store/simulation/"))continue;
  const text=readFileSync(absolute,"utf8");
  // Catch both standard imports and dynamic import()/require() direct references.
  const specifiers=[...text.matchAll(/\b(?:from\s*|import\s*\(|require\s*\()\s*["']([^"']+)["']/g)].map(m=>m[1]);
  for(const spec of specifiers){
   if(/(?:^|\/)simulation\/(?:fixtures|offline-commerce|outbox|signed-webhook|addresses)(?:\.[jt]s)?$/.test(spec)||/src\/lib\/store\/simulation\//.test(spec))violations.push(rel+" -> "+spec);
  }
 }
}
visit(src);
if(violations.length){console.error("Forbidden production imports of synthetic fixtures:\n"+violations.join("\n"));process.exit(1);}
console.log("Simulation isolation check passed.");
