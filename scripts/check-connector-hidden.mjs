#!/usr/bin/env node
// Checks that a back-office connector site is hidden from shoppers and search engines while its API still answers.
// Read-only: sends no keys, changes nothing. Usage: node scripts/check-connector-hidden.mjs https://ops-sa.example.com
export function robotsBlocksAll(body){
 const lines=body.split(/\r?\n/).map(l=>l.replace(/#.*/,"").trim()).filter(Boolean);
 let star=false,blocked=false,allowed=false;
 for(const line of lines){
  const [k,...rest]=line.split(":"),key=k.trim().toLowerCase(),value=rest.join(":").trim();
  if(key==="user-agent")star=value==="*";
  else if(star&&key==="disallow"&&value==="/")blocked=true;
  else if(star&&key==="allow"&&value)allowed=true;
 }
 return blocked&&!allowed;
}
export function pageIsNoindex(headers,html){
 const header=(headers.get("x-robots-tag")??"").toLowerCase();
 const meta=/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["']/i.exec(html)?.[1]?.toLowerCase()??"";
 return {header:header.includes("noindex"),meta:meta.includes("noindex")};
}
export function showsProducts(html){
 return /class=["'][^"']*\b(products|product-type-|add_to_cart_button|woocommerce-loop-product)/i.test(html)||/"@type"\s*:\s*"Product"/i.test(html);
}
export function restAnswers(status){return status===200||status===401||status===403;}

async function main(){
 const base=process.argv[2];
 if(!base||!/^https:\/\//.test(base)){console.error("usage: check-connector-hidden.mjs https://<connector-host>");process.exit(2);}
 const get=async path=>{const r=await fetch(new URL(path,base),{redirect:"follow",signal:AbortSignal.timeout(15000)});return {r,body:await r.text()};};
 const results=[];
 const add=(ok,label)=>results.push([ok,label]);
 try{
  const robots=await get("/robots.txt");
  add(robots.r.ok&&robotsBlocksAll(robots.body),"robots.txt blocks every crawler from every path");
  for(const path of ["/","/shop/"]){
   const page=await get(path),tag=pageIsNoindex(page.r.headers,page.body);
   add(tag.header,path+" sends X-Robots-Tag: noindex");
   add(tag.header||tag.meta,path+" is marked noindex");
   add(!showsProducts(page.body),path+" shows no products to a visitor");
  }
  const api=await get("/wp-json/wc/v3/system_status");
  add(restAnswers(api.r.status),"WooCommerce REST API answers (status "+api.r.status+")");
  add(api.r.status!==200,"REST API refuses a request with no key");
 }catch(error){add(false,"site reachable ("+(error instanceof Error?error.message:String(error))+")");}
 for(const [ok,label] of results)console.log((ok?"PASS  ":"FAIL  ")+label);
 process.exit(results.every(([ok])=>ok)?0:1);
}
if(import.meta.url==="file://"+process.argv[1])await main();
