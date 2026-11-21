import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, writeFileSync, realpathSync, existsSync, readdirSync, renameSync } from "node:fs";
import { resolve, relative, sep, isAbsolute } from "node:path";
import { analyze, editorial, type Snapshot } from "./workspace";
import { reviewBoard } from "./board";
import { unpackWoo, refreshWoo } from "./woo-snapshot";
import { sampleSnapshot } from "./demo";
import { demoDate } from "../../src/lib/store/offer-selection-demo";
import { markets } from "../../src/lib/store/markets";

const [command, directory, ...args] = process.argv.slice(2);
if (!directory || !["demo","woo","refresh","research","review","board","approve","revoke","draft","batch-approve","batch-draft"].includes(command)) throw Error("Usage: catalog <demo|woo|refresh|research|review|board|approve|revoke|draft|batch-approve|batch-draft> <workspace> [market SKU revision]");
const root=resolve(directory), path=(name:string)=>resolve(root,name);
function writeDraft(name:string,data:string) {
  const temp=path("draft-"+randomUUID()+".tmp");
  writeFileSync(temp,data,{flag:"wx",mode:0o600});
  renameSync(temp,name);
}
if(command==="demo"){
  mkdirSync(root,{recursive:true});
  writeFileSync(path("catalog.json"),JSON.stringify(sampleSnapshot(),null,2),{flag:"wx"});
  console.log("Fictional five-market snapshot created.");
} else if(command==="woo"){
  const raw=JSON.parse(readFileSync(path("woo-pages.json"),"utf8"));
  const stores=Object.keys(markets).map(code=>{
    const market=code as keyof typeof markets;
    const input=raw[market];
    return input ? unpackWoo(market,input.pages,input.observedAt) : {market,records:[],reportedTotal:null};
  });
  const snapshot={version:1 as const,demo:false,stores};
  analyze(snapshot,new Date().toISOString());
  writeFileSync(path("catalog.json"),JSON.stringify(snapshot,null,2),{flag:"wx"});
  console.log("Private Woo snapshot written. Add verified economics, research and content evidence before selection.");
} else if(command==="refresh"){
  const db=new DatabaseSync(path("owner.sqlite"));
  try {
    db.exec("PRAGMA busy_timeout=5000; BEGIN IMMEDIATE");
    const previous=readFileSync(path("catalog.json"),"utf8");
    const {snapshot,changes}=refreshWoo(JSON.parse(previous),JSON.parse(readFileSync(path("woo-pages.json"),"utf8")));
    analyze(snapshot,new Date().toISOString());
    const archive=path("catalog-history");
    mkdirSync(archive,{recursive:true,mode:0o700});
    const backup=resolve(archive,createHash("sha256").update(previous).digest("hex")+".json");
    if(!existsSync(backup))writeDraft(backup,previous);
    writeDraft(path("catalog.json"),JSON.stringify(snapshot,null,2));
    db.exec("COMMIT");
    console.log(JSON.stringify({changes,backup},null,2));
  } finally {db.close();}
} else {
  const original=readFileSync(path("catalog.json"),"utf8");
  const snapshot:Snapshot=JSON.parse(original);
  const inbox=path("evidence");
  if(existsSync(inbox)){
    for(const name of readdirSync(inbox).filter(n=>n.endsWith(".json")).sort()){
      const sample=JSON.parse(readFileSync(resolve(inbox,name),"utf8"));
      const store=snapshot.stores.find(s=>s.market===sample.market);
      const matches=store?.records.filter(r=>r.productKey===sample.productKey)??[];
      if(!matches.length){console.error("Unused evidence for an absent product: "+name);continue;}
      for(const record of matches){
        if(sample.metric==="search_interest_index")record.demand.push(sample);
        else if(typeof sample.seller==="string" && typeof sample.currency==="string")record.comparisons.push(sample);
        else throw Error("Unknown evidence kind: "+name);
      }
    }
  }
  const asOf=snapshot.demo?demoDate:new Date().toISOString();
  const cap=Number(process.env.YAWMIYATI_FAMILY_LIMIT??150);
  const review=analyze(snapshot,asOf,cap);
  if(command==="board"){
    writeDraft(path("catalog-review.html"),reviewBoard(review,snapshot.demo));console.log(path("catalog-review.html"));
  } else if(command==="research"){
    const countries={sa:"السعودية",ae:"الإمارات",om:"سلطنة عمان",eg:"مصر",iq:"العراق"};
    console.log(JSON.stringify(snapshot.stores.flatMap(store=>store.records.map(({offer,productKey})=>{
      const phrase=offer.title+" "+countries[store.market];
      return {market:store.market,sku:offer.sku,productKey,query:phrase,
        priceSearch:"https://www.google.com/search?"+new URLSearchParams({q:phrase+" سعر",gl:store.market,hl:"ar"}),
        demandSearch:"https://trends.google.com/trends/explore?"+new URLSearchParams({geo:store.market.toUpperCase(),q:offer.title}),
        verifiedComparisons:review.find(r=>r.market===store.market)?.decisions.find(d=>d.sku===offer.sku)?.comparison??null};
    })),null,2));
  } else if(command==="review") console.log(JSON.stringify(review.map(r=>({market:r.market,read:r.read,reported:r.reportedTotal,coverage:r.coverage,
    target:Math.min(100,cap),shortfall:Math.max(0,Math.min(100,cap)-r.selected.length),decisions:r.decisions.map(d=>({...d,accountProposal:d.selected?{schema:"yawmiyati-offer-1",demo:snapshot.demo,market:r.market,sku:d.sku,title:d.title,revision:d.revision,priceMinor:d.proposedPriceMinor,expectedContributionMinor:d.expectedContributionMinor,components:d.components}:null}))})),null,2));
  else {
    const batch=command==="batch-approve" || command==="batch-draft";
    const items=batch ? JSON.parse(readFileSync(resolve(args[0]??path("selected-offers.json")),"utf8")) : [{market:args[0],sku:args[1],revision:args[2]}];
    if(!Array.isArray(items)||items.length<1||items.length>750)throw Error("Invalid selection file");
    const targets=items.map(({market,sku,revision})=>{
    const store=review.find(r=>r.market===market);
    const row=store?.decisions.find(r=>r.sku===sku);
    if(!row || !store || row.revision!==revision || (command!=="revoke" && !row.selected))throw Error("Re-run review and choose the current shortlisted revision");
      return {market,sku,revision,store,row};
    });
    const db=new DatabaseSync(path("owner.sqlite"));
    try {
      db.exec("PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS decisions (id INTEGER PRIMARY KEY, market TEXT NOT NULL, sku TEXT NOT NULL, revision TEXT NOT NULL, decision TEXT NOT NULL, recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
      db.exec("BEGIN IMMEDIATE");
      if(readFileSync(path("catalog.json"),"utf8")!==original)throw Error("Catalog changed during review. Reload.");
      for(const {market,sku,revision,store,row} of targets){
      const params=[market,sku];
      const last=db.prepare("SELECT revision,decision FROM decisions WHERE market=? AND sku=? ORDER BY id DESC LIMIT 1").get(...params);
      if(command==="approve" || command==="batch-approve" || command==="revoke"){
        const action=command==="revoke"?"revoke":"approve";
        if(last?.revision!==revision || last?.decision!==action)db.prepare("INSERT INTO decisions (market,sku,revision,decision) VALUES (?,?,?,?)").run(market,sku,revision,action);
        console.log(command+" recorded for "+market+"/"+sku);
      } else {
        if(last?.revision!==revision || last.decision!=="approve")throw Error("Owner approval required for this revision");
        const record=snapshot.stores.find(s=>s.market===market)!.records.find(r=>r.offer.sku===sku)!;
        const page=editorial(record,revision);
        const esc=(text:string)=>text.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
        const gallery=record.media.map(m=>{
          const base=realpathSync(path("media"));
          const file=realpathSync(resolve(base,m.file));
          const rel=relative(base,file);
          if(rel===".."||rel.startsWith(".."+sep)||isAbsolute(rel))throw Error("Media outside workspace");
          const bytes=readFileSync(file);
          const png=bytes.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex"));
          const jpeg=bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
          if(bytes.length>5_000_000 || !(png||jpeg) || createHash("sha256").update(bytes).digest("hex")!==m.checksum)throw Error("Invalid or changed approved media");
          return '<img loading="lazy" src="data:image/'+(png?'png':'jpeg')+';base64,'+bytes.toString("base64")+'" alt="'+esc(m.alt)+'">';
        });
        const {locale,currency,minorDigits}=markets[store.market];
        const fmt=(n:number)=>new Intl.NumberFormat(locale,{style:"currency",currency,minimumFractionDigits:minorDigits,maximumFractionDigits:minorDigits}).format(n/10**minorDigits);
        const total=row.proposedPriceMinor!+record.offer.shopperShipping!;
        if(!Number.isSafeInteger(total))throw Error("Total exceeds supported precision");
        const field=(name:string)=>page.proposals.find(p=>p.field===name)!.segments.map(s=>s.text).join(" ");
        const html='<!doctype html><html dir="rtl" lang="'+locale+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src '+ "'none'; img-src data:; style-src 'unsafe-inline'"+'"><title>'+esc(field("seoTitle"))+'</title><meta name="description" content="'+esc(field("seoDescription"))+'"><style>body{max-width:46rem;margin:auto;padding:1.4rem;font:1.1rem/1.8 system-ui;color:#252a27;background:#faf9f5}article{background:white;padding:1.4rem;border-radius:1rem}img{max-width:100%;height:auto}details{margin:1rem 0}small{color:#47564f}</style><small>'+ (snapshot.demo?"معاينة ببيانات تجريبية":"مسودة للمراجعة")+'</small><article><h1>'+esc(field("title"))+'</h1>'+gallery.join("")+'<p>'+esc(field("description"))+'</p><dl><dt>سعر المنتج</dt><dd>'+fmt(row.proposedPriceMinor!)+'</dd><dt>الشحن</dt><dd>'+fmt(record.offer.shopperShipping!)+'</dd><dt>الإجمالي مع الشحن</dt><dd>'+fmt(total)+'</dd></dl>'+page.faq.map(f=>'<details><summary>'+esc(f.question)+'</summary>'+esc(f.answer)+'</details>').join("")+'</article></html>';
        const out=path("draft-"+revision+".html");
        writeDraft(out,html);
        writeDraft(path("draft-"+revision+".json"),JSON.stringify({schema:"yawmiyati-draft-1",demo:snapshot.demo,
          market,sku,revision,woo:record.woo??null,title:field("title"),description:field("description"),editorial:page},null,2));
        console.log(out);
      }
      }
      db.exec("COMMIT");
    } finally { db.close(); }
  }
}
