import {createHash} from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const run = (cmd,args) => spawnSync(cmd,args,{encoding:"utf8"});

test("five-market CLI preserves exact approvals and renders offline Arabic drafts", t=>{
  const dir=mkdtempSync(join(tmpdir(),"yawm-catalog-"));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const cli=(action,...args)=>run(process.execPath,["scripts/catalog/run.mjs",action,dir,...args]);
  assert.equal(cli("demo").status,0);
  const report=JSON.parse(cli("review").stdout);
  assert.equal(report.length,5);
  assert.equal(report.reduce((n,s)=>n+s.read,0),25);
  const sa=report.find(s=>s.market==="sa");
  const row=sa.decisions.find(d=>d.selected);
  const key=["sa",row.sku,row.revision];
  assert.notEqual(cli("draft",...key).status,0);
  assert.equal(cli("approve",...key).status,0);
  assert.equal(cli("approve",...key).status,0);
  const draft=cli("draft",...key);
  assert.equal(draft.status,0,draft.stderr);
  const html=readFileSync(draft.stdout.trim(),"utf8");
  assert.match(html,/lang="ar-SA"/);
  assert.match(html,/ماذا تتضمن العبوة/);
  assert.match(html,/noindex,nofollow/);
  assert.equal(cli("revoke",...key).status,0);
  assert.notEqual(cli("draft",...key).status,0);
  assert.equal(cli("approve",...key).status,0);
  const file=join(dir,"catalog.json");
  const snapshot=JSON.parse(readFileSync(file,"utf8"));
  const product=snapshot.stores[0].records.find(r=>r.offer.sku===row.sku);
  product.facts[1].text+=" تفاصيل.";
  writeFileSync(file,JSON.stringify(snapshot));
  assert.notEqual(cli("draft",...key).status,0);
  product.demand=[];
  product.comparisons[0].currency="USD";
  writeFileSync(file,JSON.stringify(snapshot));
  const held=JSON.parse(cli("review").stdout)[0].decisions.find(r=>r.sku===row.sku);
  assert.equal(held.selected,false);
  assert.ok(held.reasons.includes("missing_local_comparison") && held.reasons.includes("incomplete_research"));
});

test("saved retailer page requires exact identity, local currency, availability and explicit shipping",t=>{
  const dir=mkdtempSync(join(tmpdir(),"yawm-evidence-"));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const page=join(dir,"page.html");
  writeFileSync(page,'<script type="application/ld+json">'+JSON.stringify({"@type":"Product",sku:"PACK-3",offers:{"@type":"Offer",price:"3.125",priceCurrency:"OMR",availability:"https://schema.org/InStock"}})+'</script>');
  const args=["scripts/catalog/capture-price.py","--page",page,"--url","https://example.invalid/shop","--market","om","--product-key","rack-pack-3","--observed","2025-01-01T00:00:00Z","--id-field","sku","--identity","PACK-3"];
  const sample=JSON.parse(run("python3",args).stdout);
  assert.equal(sample.price,3125);assert.equal(sample.shipping,null);
  assert.equal(JSON.parse(run("python3",[...args,"--shipping","0.750"]).stdout).shipping,750);
  assert.notEqual(run("python3",[...args.slice(0,-1),"PACK-2"]).status,0);
});

test("Woo snapshot intake preserves partial pages, separate variations and missing-market coverage", t=>{
  const dir=mkdtempSync(join(tmpdir(),"yawm-woo-"));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const input=join(dir,"woo-pages.json");
  writeFileSync(input,JSON.stringify({sa:{observedAt:"2025-01-01T00:00:00Z",pages:[{page:1,totalPages:2,totalProducts:2,products:[
    {id:12,sku:"P",name:"رف",categories:[{name:"مطبخ"}],variations:[20,21]}]}]}}));
  const cli=action=>run(process.execPath,["scripts/catalog/run.mjs",action,dir]);
  assert.equal(cli("woo").status,0);
  const report=JSON.parse(cli("review").stdout);
  assert.equal(report[0].read,2);
  assert.equal(report[0].coverage,"unknown");
  assert.deepEqual(report[0].decisions.map(r=>r.sku),["woo-12-20","woo-12-21"]);
  assert.ok(report.every(s=>s.decisions.every(r=>!r.selected)));
  assert.equal(cli("woo").status,1);
});

test("weekly demand compares an item to a common benchmark and ignores unfinished weeks",t=>{
 const dir=mkdtempSync(join(tmpdir(),"yawm-demand-"));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const file=join(dir,"trends.csv");
 writeFileSync(file,"Category: All categories\n\nWeek,Item (Saudi Arabia),Anchor (Saudi Arabia)\n2025-01-05,20,60\n2025-01-12,100,1\n");
 const args=["scripts/catalog/trends-csv.py","--file",file,"--market","sa","--term","Item (Saudi Arabia)","--anchor","Anchor (Saudi Arabia)","--product-key","pack","--observed","2025-01-14T00:00:00Z","--url","https://trends.google.com/trends/explore?geo=SA"];
 const sample=JSON.parse(run("python3",args).stdout);
 assert.equal(sample.value,25); assert.deepEqual(sample.weeks,["2025-01-05"]);
 assert.notEqual(run("python3",[...args.slice(0,-1),"https://trends.google.com/trends/explore?geo=OM"]).status,0);
});

test("price proposal meets the owner margin at the lowest allowed minor unit and appears in the draft",t=>{
 const dir=mkdtempSync(join(tmpdir(),"yawm-pricing-"));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const cli=(action,...args)=>run(process.execPath,["scripts/catalog/run.mjs",action,dir,...args]);
 cli("demo");const file=join(dir,"catalog.json");const data=JSON.parse(readFileSync(file,"utf8"));
 const r=data.stores[0].records[2];
 Object.assign(r.offer.economics,{price:null,supplierCost:1000,outboundDelivery:100,deliveredFees:100,returnCost:0,adCost:100,deliveryBps:10000});
 r.offer.sellerFloor=1100;r.targetContributionMinor=200;
 writeFileSync(file,JSON.stringify(data));
 const report=JSON.parse(cli("review").stdout)[0];const row=report.decisions.find(x=>x.sku===r.offer.sku);
 assert.equal(row.proposedPriceMinor,1500);assert.equal(row.expectedContributionMinor,"200");
 r.targetContributionMinor=99999999;writeFileSync(file,JSON.stringify(data));
 assert.equal(JSON.parse(cli("review").stdout)[0].decisions.find(x=>x.sku===r.offer.sku).selected,false);
});

test("gallery bytes are revision-bound and five-market approved drafts open without external assets",t=>{
 const dir=mkdtempSync(join(tmpdir(),"yawm-media-"));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const cli=(action,...args)=>run(process.execPath,["scripts/catalog/run.mjs",action,dir,...args]);
 assert.equal(cli("demo").status,0);
 const file=join(dir,"catalog.json"),data=JSON.parse(readFileSync(file,"utf8"));
 mkdirSync(join(dir,"media"));
 const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/qQUAAAAASUVORK5CYII=","base64");
 const image=join(dir,"media","test.png");
 writeFileSync(image,png);
 for(const market of data.stores)for(const product of market.records){
   product.media=[{file:"test.png",alt:product.offer.title,factId:"title",rights:"test fixture",checksum:createHash("sha256").update(png).digest("hex")}];
 }
 writeFileSync(file,JSON.stringify(data));
 let last;
 for(const store of JSON.parse(cli("review").stdout)){
   const selected=store.decisions.find(d=>d.selected);
   last=[store.market,selected.sku,selected.revision];
   assert.equal(cli("approve",...last).status,0);
   const result=cli("draft",...last);
   assert.equal(result.status,0,result.stderr);
   assert.match(readFileSync(result.stdout.trim(),"utf8"),/data:image\/png;base64,/);
 }
 writeFileSync(image,Buffer.concat([png,Buffer.from("changed")]));
 assert.notEqual(cli("draft",...last).status,0);
});

test("board exports only recommended choices and stale batch approvals are atomic",t=>{
 const dir=mkdtempSync(join(tmpdir(),"yawm-board-"));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const cli=(action,...args)=>run(process.execPath,["scripts/catalog/run.mjs",action,dir,...args]);cli("demo");
 const rows=JSON.parse(cli("review").stdout).flatMap(r=>r.decisions.filter(d=>d.selected).map(d=>({market:r.market,sku:d.sku,revision:d.revision})));
 const board=readFileSync(cli("board").stdout.trim(),"utf8");assert.equal(board.match(/type="checkbox"/g).length,rows.length);
 const list=join(dir,"selected-offers.json");
 writeFileSync(list,JSON.stringify([rows[0],{...rows[1],revision:"old"}]));
 assert.notEqual(cli("batch-approve",list).status,0);assert.notEqual(cli("draft",rows[0].market,rows[0].sku,rows[0].revision).status,0);
 writeFileSync(list,JSON.stringify(rows));assert.equal(cli("batch-approve",list).status,0);
 const drafts=cli("batch-draft",list);assert.equal(drafts.status,0,drafts.stderr);assert.equal(drafts.stdout.trim().split("\n").length,10);
});

test("refresh retains unchanged enrichment, resets changed stock and archives removals only on full captures",t=>{
 const dir=mkdtempSync(join(tmpdir(),"yawm-refresh-"));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const cli=action=>run(process.execPath,["scripts/catalog/run.mjs",action,dir]);
 const file=join(dir,"catalog.json"),raw=join(dir,"woo-pages.json");
 const product=id=>({id,sku:"R"+id,name:"رف",categories:[],variations:[],price:"20.00",stock_status:"instock"});
 function capture(day,products,total=products.length,pages=1){writeFileSync(raw,JSON.stringify({sa:{observedAt:"2025-01-"+day+"T00:00:00Z",pages:[{page:1,totalPages:pages,totalProducts:total,products}]}}));}
 capture("01",[product(1),product(2),product(3)]);assert.equal(cli("woo").status,0);
 const data=JSON.parse(readFileSync(file,"utf8"));
 for(const r of data.stores[0].records)r.facts=[{id:"title",text:r.offer.title,source:"https://example.com"}];
 writeFileSync(file,JSON.stringify(data));const before=readFileSync(file,"utf8");
 capture("02",[product(1)],3,2);assert.notEqual(cli("refresh").status,0);assert.equal(readFileSync(file,"utf8"),before);
 capture("02",[product(1),{...product(2),stock_status:"outofstock"},product(4)]);
 const output=cli("refresh");assert.equal(output.status,0,output.stderr);const result=JSON.parse(output.stdout);
 assert.equal(readFileSync(result.backup,"utf8"),before);
 assert.deepEqual(result.changes,[{market:"sa",unchanged:1,changed:1,added:1,removed:1}]);
 const next=JSON.parse(readFileSync(file,"utf8")).stores[0].records;
 assert.equal(next[0].facts.length,1);assert.equal(next[1].facts.length,0);assert.equal(next[1].woo.stockStatus,"outofstock");
 assert.equal(cli("refresh").status,0);
 capture("01",[product(1)]);assert.notEqual(cli("refresh").status,0);
});

test("exact-pack measurements rank eligible offers without manual factor scores and export full pages", t=>{
  const dir=mkdtempSync(join(tmpdir(),"yawm-measured-"));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const cli=(action,...args)=>run(process.execPath,["scripts/catalog/run.mjs",action,dir,...args]);
  assert.equal(cli("demo").status,0);
  const catalog=JSON.parse(readFileSync(join(dir,"catalog.json")));
  const sa=catalog.stores.find(s=>s.market==="sa"),samples=[];
  for(const record of sa.records){
    record.offer.observations=[];record.packGtin="4006381333931";
    const price=record.comparisons[0],demand=record.demand[0];
    samples.push({...price,sku:record.offer.sku,feed:"https://shop.test/feed",packGtin:"04006381333931"},
      {...demand,sku:record.offer.sku,url:"https://trends.google.com/trends/explore",benchmark:"kitchen"});
    record.comparisons=[];record.demand=[];
  }
  writeFileSync(join(dir,"catalog.json"),JSON.stringify(catalog));
  writeFileSync(join(dir,"collected-evidence.json"),JSON.stringify({samples}));
  const review=cli("review");assert.equal(review.status,0,review.stderr);
  const row=JSON.parse(review.stdout).find(s=>s.market==="sa").decisions.find(d=>d.selected);
  assert.equal(row.rankingMethod,"regional_demand_then_expected_contribution");
  const args=["sa",row.sku,row.revision];
  assert.equal(cli("approve",...args).status,0);
  assert.equal(cli("draft",...args).status,0);
  const [packet]=JSON.parse(readFileSync(join(dir,"editorial-batch-sa.json")));
  assert.equal(packet.proposal.priceMinor,packet.page.priceMinor);
  assert.deepEqual(packet.page.components,row.components);
  for(const key of ["category","faq","description","seoTitle","seoDescription"])assert.ok(packet.page[key].length);
});
