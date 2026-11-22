import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";

test("normal sync entry point reads all product pages, preserves the last complete catalog and protects commercial decisions",t=>{
 const dir=mkdtempSync(join(tmpdir(),"yawmiyati-connected-"));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const mock=join(dir,"fetch.mjs");
 writeFileSync(mock,`globalThis.fetch=async(url,options)=>{
   if(url.pathname==="/wp-json/wc/v3/settings/general/woocommerce_currency")return Response.json({id:"woocommerce_currency",value:process.env.TEST_CAPTURE==="wrong"?"SAR":"EGP"});
   if(url.origin!=="https://fixture.invalid"||url.pathname!=="/wp-json/wc/v3/products"||url.searchParams.get("orderby")!=="id"||(options.method??"GET")!=="GET")throw Error("Unexpected request");
   const page=Number(url.searchParams.get("page")),mode=process.env.TEST_CAPTURE,n=mode==="empty"?0:51;
   if(mode==="broken"&&page===2)return new Response("failed",{status:503});
   const rows=Array.from({length:Math.min(n,page===1?50:1)},(_,i)=>({id:(page-1)*50+i+1,sku:"EG"+((page-1)*50+i),name:"Kitchen rack",categories:[],variations:[],regular_price:"545",meta_data:[{key:"taager_price",value:mode==="changed"?"291":"290"},{key:"secret_quantity_tier",value:"never-store-this"}]}));
   return Response.json(rows,{headers:{"X-WP-Total":String(n),"X-WP-TotalPages":String(Math.ceil(n/50))}});
 }`);
 const sync=mode=>execFileSync(process.execPath,["--import",mock,"scripts/catalog/run.mjs","sync",dir,"eg"],{env:{...process.env,TEST_CAPTURE:mode,YAWMIYATI_WOO_EG_ORIGIN:"https://fixture.invalid",YAWMIYATI_WOO_EG_KEY:"sample",YAWMIYATI_WOO_EG_SECRET:"sample"},stdio:"pipe"});
 const snapshot=()=>readFileSync(join(dir,"catalog.json"),"utf8");
 assert.throws(()=>sync("wrong"));assert.throws(()=>sync("empty"));assert.equal(existsSync(join(dir,"catalog.json")),false);
 sync("ok");const first=snapshot(),store=JSON.parse(first).stores.find(s=>s.market==="eg");
 assert.equal(store.records.length,51);assert.equal(store.records[0].offer.economics.supplierCost,null);
 assert.equal(store.records[0].woo.parentEvidence.signals[0].amount,"290");assert.ok(!first.includes("never-store-this"));
 assert.throws(()=>sync("broken"));assert.equal(snapshot(),first);assert.throws(()=>sync("empty"));assert.equal(snapshot(),first);
 assert.equal(JSON.parse(sync("ok")).changes[0].unchanged,51);
 assert.equal(JSON.parse(sync("changed")).changes[0].changed,51);
});
