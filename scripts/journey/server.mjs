// node scripts/journey/server.mjs /path/to/generated/demo-board
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { submit, advance, destinations, envelope } from "./ledger.mjs";
const dir=resolve(process.argv[2]||".");
const html=readFileSync(resolve(dir,"offer-journey.html"),"utf8");
const catalog=JSON.parse(html.match(/const catalog=(\[.*\]);\n/)[1]).flatMap(z=>z.rows);
const db=new DatabaseSync(resolve(dir,"offer-journey-demo.sqlite"));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS demo_orders(id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS demo_destination(id TEXT, sink TEXT, payload TEXT, PRIMARY KEY(id,sink));`);
const orders=()=>db.prepare("SELECT data FROM demo_orders ORDER BY rowid").all().map(r=>JSON.parse(r.data));
function behavior(input){
  const allowed=["impression","search","product_view","bundle_select","cart_add","cart_remove","checkout_start","checkout_review","checkout_error"];
  const offer=catalog.find(o=>o.id===input.offer);
  if(!offer||!allowed.includes(input.action)||!/^[a-f0-9-]{36}$/.test(input.id))throw Error("Invalid storefront event");
  const event=envelope(input.action,offer,input,input.id);
  for(const data of destinations(event,input,offer)){
    if(data.sink!=="Pixel local")db.prepare("INSERT OR IGNORE INTO demo_destination VALUES(?,?,?)").run(event.id,data.sink,JSON.stringify(data));
  }
}
function apply(input){
  const row=db.prepare("SELECT data FROM demo_orders WHERE id=?").get(input.key);
  const offer=catalog.find(o=>o.id===input.offer);
  const consent={ads:input.ads===true,behavior:input.behavior===true};
  let order;
  if(input.action==="submitted"){
    if(!offer)throw Error("Unknown offer");
    order=submit(offer,input,input.key);
    if(row){const existing=JSON.parse(row.data);if(existing.offer.id!==offer.id||existing.context.placement!==input.placement||existing.context.campaign!==input.campaign)throw Error("Checkout key conflict");return}
    order.consent=consent;
  }else{
    if(!row)throw Error("Unknown order");
    order=JSON.parse(row.data);
    if(!advance(order,input.action))return;
  }
  db.prepare("INSERT OR REPLACE INTO demo_orders VALUES(?,?)").run(order.key,JSON.stringify(order));
  const e=order.events.at(-1);
  for(const data of destinations(e,{ads:consent.ads&&order.consent.ads,behavior:consent.behavior&&order.consent.behavior},order.offer)){
    db.prepare("INSERT OR IGNORE INTO demo_destination VALUES(?,?,?)").run(e.id,data.sink,JSON.stringify(data));
  }
}
const server=createServer(async(req,res)=>{
  const json=(code,data)=>{res.writeHead(code,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(data))};
  const {port}=server.address(), origin="http://127.0.0.1:"+port;
  if(req.headers.host!=="127.0.0.1:"+port)return json(403,{error:"Loopback only"});
  if(req.method==="GET"&&req.url==="/"){res.writeHead(200,{"Content-Type":"text/html;charset=utf-8"});return res.end(html.replace("const catalog=","const localServer=true;const catalog="))}
  if(req.url!=="/demo/orders"&&req.url!=="/demo/event")return json(404,{});
  if(req.method==="POST"){
    if(req.headers.origin!==origin||req.headers["content-type"]!=="application/json")return json(403,{});
    try{
      let body="";for await(const chunk of req){body+=chunk;if(body.length>4096)throw Error("Oversized request")}
      const input=JSON.parse(body);db.exec("BEGIN IMMEDIATE");
      try{if(req.url==="/demo/event")behavior(input);else apply(input);db.exec("COMMIT")}catch(e){db.exec("ROLLBACK");throw e}
    }catch(e){return json(409,{error:e.message})}
  }else if(req.method!=="GET"||req.url!=="/demo/orders")return json(405,{});
  json(200,{orders:orders(),serverEvents:db.prepare("SELECT payload FROM demo_destination ORDER BY rowid DESC LIMIT 12").all().map(r=>JSON.parse(r.payload))});
});
server.listen(Number(process.env.PORT||4175),"127.0.0.1",()=>console.log("http://127.0.0.1:"+server.address().port));
