import { readFileSync } from "node:fs";
import { markets, type MarketCode } from "../../src/lib/store/markets";
import { journeyCatalog } from "./catalog";
export function journeyPage() {
  const file=(name:string)=>readFileSync(new URL(name,import.meta.url),"utf8");
  const catalog=(Object.keys(markets) as MarketCode[]).flatMap(journeyCatalog);
  const data=JSON.stringify(catalog).replaceAll("<","\\u003c");
  return file("template.html").replace("/* JOURNEY */",()=>[
    "const catalog="+data+";", file("ledger.mjs").replace(/^export /gm,""),file("browser.js")
  ].join("\n"));
}
