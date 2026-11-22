import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const html=readFileSync(new URL("./egypt-import-check.html",import.meta.url),"utf8");
const inspect=vm.runInNewContext(html.match(/<script id="core">([\s\S]*?)<\/script>/)[1]+";inspectCsv");
test("compares the exact pack, supports quoted cells and omits private and raw metadata",()=>{
 const input='\uFEFFID,SKU,Name,Regular price,Meta: _taager_price,Meta: quantity_discounts,Meta: secret_quantity_discount,Description\r\n1,EG030501CKKA99,"Cool Clean, 3 pieces",545,290,"[{""price"":300}]",PRIVATE,"two\nlines"\r\n2,ABC,other,10,2,,,PRIVATE';
 const r=inspect(input);assert.equal(r.rowsInspected,2);assert.equal(r.matchingRows,1);
 const p=r.products[0];assert.equal(p.item,"cool-clean-three-pack");assert.equal(p.candidateMetadata.supplier_cost.numericValues[0],"290");
 assert.equal(p.candidateMetadata.quantity_tier.populatedColumns,1);assert.doesNotMatch(JSON.stringify(r),/PRIVATE|two\\nlines|300/);
});
test("missing metadata and unknown SKUs remain unresolved",()=>{
 const r=inspect("Name,SKU,Regular price\nفرشاة شعر,unconfirmed,583");assert.equal(r.products[0].sku,null);assert.equal(Object.keys(r.products[0].candidateMetadata).length,0);
 assert.throws(()=>inspect('SKU,Name\nx,"broken'));assert.throws(()=>inspect('SKU,Name\nx,y,z'));
});
