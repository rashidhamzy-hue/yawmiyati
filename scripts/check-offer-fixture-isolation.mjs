#!/usr/bin/env node
/**
 * M12 isolation guard for storefront offer fixtures (source + optional build output).
 *  - Only src/lib/store/offer-source.ts (and tests) may reference src/fixtures/.
 *  - That reference must be a dynamic import inside a VITE_YAWMIYATI_OFFER_FIXTURES === "true" branch,
 *    so bundles built without the flag contain no fixture chunk.
 *  - Fixture images must be repository-local /browse assets.
 *  - With --build <dir> (built WITHOUT the flag) no emitted file may contain fixture content.
 * No network, no deployment.
 */
import {readdirSync,readFileSync,statSync,existsSync} from "node:fs";
import {join,relative,sep} from "node:path";
const root=process.cwd();
const bad=[];
const walk=(dir,visit)=>{for(const entry of readdirSync(dir)){const abs=join(dir,entry);if(statSync(abs).isDirectory())walk(abs,visit);else visit(abs);}};
walk(join(root,"src"),abs=>{
 if(!/\.[cm]?[jt]sx?$/.test(abs))return;
 const rel=relative(root,abs).split(sep).join("/");
 if(rel.startsWith("src/test/")||rel.startsWith("src/fixtures/"))return;
 const text=readFileSync(abs,"utf8");
 const refs=[...text.matchAll(/\b(?:from\s*|import\s*\(|require\s*\()\s*["']([^"']+)["']/g)].map(m=>m[1]).filter(s=>/(?:^|\/)fixtures\//.test(s)&&!/simulation/.test(s));
 if(!refs.length)return;
 if(rel!=="src/lib/store/offer-source.ts"){bad.push(rel+": only offer-source.ts may load storefront fixtures");return;}
 if(/from\s*["'][^"']*fixtures\//.test(text))bad.push(rel+": fixtures must not be statically imported");
 const guard=text.indexOf('if (import.meta.env.VITE_YAWMIYATI_OFFER_FIXTURES === "true")');
 const dyn=text.indexOf('import("../../fixtures/storefront-offers")');
 if(guard<0||dyn<0||dyn<guard)bad.push(rel+": fixture import must sit inside the VITE_YAWMIYATI_OFFER_FIXTURES branch");
 if(!text.includes("fixtureHostAllowed(window.location.hostname)"))bad.push(rel+": fixture mode must be limited to loopback hosts");
});
const fixtures=readFileSync(join(root,"src/fixtures/storefront-offers.ts"),"utf8");
for(const m of fixtures.matchAll(/url:\s*"([^"]+)"/g))if(!m[1].startsWith("/browse/"))bad.push("fixture image must be a local /browse asset: "+m[1]);
if(/historicSupplierTerms|egyptScreenshotShippingEvidence|Taager/.test(fixtures))bad.push("fixtures must not reuse supplier evidence or historic quotes");
const at=process.argv.indexOf("--build");
if(at>0){
 const dir=join(root,process.argv[at+1]||".output");
 if(!existsSync(dir))bad.push("build output missing: "+dir);
 else walk(dir,abs=>{
  if(!/\.(m?js|html|json|css)$/.test(abs))return;
  const text=readFileSync(abs,"utf8");
  if(/yawmiyati-offer-fixture-v1|storefront-offers|fx-sa-spice-rack/.test(text))bad.push(relative(root,abs)+": fixture content in a build made without the fixture flag");
 });
}
if(bad.length){console.error("Offer fixture isolation failed:\n"+bad.join("\n"));process.exit(1);}
console.log("Offer fixture isolation passed"+(at>0?" (source and build output).":" (source)."));
