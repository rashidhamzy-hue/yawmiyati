import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,rmSync} from "node:fs";
import {execFileSync,spawn} from "node:child_process";
import {tmpdir} from "node:os";
import {once} from "node:events";
import {submit,advance,result,envelope,destinations} from "./ledger.mjs";

test("five markets, consent, replay and outcome accounting",async t=>{
  const dir=mkdtempSync(tmpdir()+"/journey-");t.after(()=>rmSync(dir,{recursive:true,force:true}));
  for(const cmd of ["demo","board"])execFileSync(process.execPath,["scripts/catalog/run.mjs",cmd,dir]);
  const html=readFileSync(dir+"/offer-journey.html","utf8");
  const zones=JSON.parse(html.match(/const catalog=(\[.*\]);\n/)[1]);
  assert.equal(zones.length,7);
  const context={campaign:"organic",placement:"homepage",phone:"PRIVATE",query:"PRIVATE"};
  for(const z of zones){
    const o=z.rows.find(r=>r.id===z.winner),low=z.rows.find(r=>r.kind==="Low-margin control");
    assert.throws(()=>submit(low,context,"demo-reject"));
    assert.ok(o.expected>=o.target);assert.equal(o.maxCpa,o.expected+o.ad-o.target);
    const order=submit(o,context,"demo-proof");assert.ok(!JSON.stringify(order).includes("PRIVATE"));
    assert.equal(result(order).retainedSales,0);assert.equal(result(order).contribution,null);
    assert.throws(()=>advance(order,"delivered"));advance(order,"confirmed");advance(order,"delivered");
    assert.equal(advance(order,"delivered"),false);assert.equal(result(order).retainedSales,o.door);
    advance(order,"payout_credited");advance(order,"returned");assert.equal(result(order).retainedSales,0);
    assert.equal(result(order).contribution,o.returned-o.ad);
    const e=envelope("cart_add",o,context,"fixture");
    assert.deepEqual(destinations(e,{},o),[]);
    const [,pixel,capi]=destinations(e,{behavior:true,ads:true},o);assert.equal(capi.event_id,pixel.eventID);
    assert.deepEqual(destinations(order.events[0],{ads:true},o),[]);
    assert.equal(destinations(order.events[2],{ads:true},o)[0].event_name,"Purchase");
  }
  const server=spawn(process.execPath,["scripts/journey/server.mjs",dir],{env:{...process.env,PORT:"0"}});
  t.after(()=>server.kill());const [chunk]=await once(server.stdout,"data");
  const origin=chunk.toString().trim(),url=origin+"/demo/orders";
  const request=input=>fetch(url,{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(input)});
  const o=zones[0].rows[0], key="demo-parallel", base={...context,key,offer:o.id,ads:true};
  for(const action of ["submitted","confirmed","delivered","payout_credited","returned"]){
    const twice=await Promise.all([request({...base,action}),request({...base,action})]);
    assert.deepEqual(twice.map(r=>r.status),[200,200]);
  }
  const {orders,serverEvents}=await (await fetch(url)).json();assert.equal(orders.length,1);assert.equal(orders[0].events.length,5);
  assert.equal(serverEvents.filter(e=>e.event_name==="Purchase").length,1);
  assert.equal((await request({...base,action:"submitted",campaign:"demo-meta-kitchen"})).status,409);
});
