// Builds one-line bookmarklets from the readable sources in this folder.
// Usage: node tools/taager/build-bookmarklets.mjs  → prints each bookmarklet.
import { readFileSync } from "node:fs";
const dir = new URL(".", import.meta.url);
for (const name of ["add-all.js", "sync.js", "recorder.js"]) {
  const src = readFileSync(new URL(name, dir), "utf8");
  const one = src.split("\n").map((l) => l.trim()).join("");
  if (one.includes("%")) throw new Error(`${name}: '%' breaks bookmarklets`);
  new Function(one); // syntax check
  console.log(`--- ${name} (${one.length} chars)\njavascript:${one}\n`);
}
