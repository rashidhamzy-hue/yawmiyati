/* M12 shopper journey with isolated offer fixtures: product -> pack -> add-on -> cart -> checkout review.
 * Requires a dev server started with VITE_YAWMIYATI_OFFER_FIXTURES=true on a loopback host.
 * No credentials, network services, real orders or deploys. */
const {chromium}=require("playwright");
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const base=process.env.QA_OFFER_BASE_URL||"http://127.0.0.1:4176";
const output=path.join(process.cwd(),"artifacts","offer-journey");
fs.mkdirSync(output,{recursive:true});
const markets=["sa","ae","om","eg","iq"];
async function main(){
 const browser=await chromium.launch({headless:true,...(process.env.QA_CHROME?{executablePath:process.env.QA_CHROME}:{})});
 const failures=[];
 for(const width of [390,1440])for(const market of markets){
  const label=market+"-"+width;
  const context=await browser.newContext({viewport:{width,height:900}});
  const page=await context.newPage();
  page.setDefaultTimeout(15000);
  const remote=[];
  page.on("request",r=>{if(/supabase\.co/.test(r.url()))remote.push(r.url());});
  await page.route(/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//,r=>r.abort());
  try{
   await page.goto(base+"/"+market,{waitUntil:"domcontentloaded"});
   await page.locator("[data-offer-fixture-notice]").first().waitFor();
   await page.evaluate(()=>document.dispatchEvent(new CustomEvent("yawmiyati:open-search")));
   const search=page.getByRole("dialog",{name:"بحث يومياتي الذكي"});
   await search.getByRole("searchbox").fill("التوابل");
   await search.locator('a[href$="/p/spice-rack"]').waitFor();
   await search.getByRole("button",{name:"إغلاق البحث"}).click();
   const card=page.locator("#collection article a").first();
   const box=await card.boundingBox();
   assert.ok(box&&box.y+60<900,label+": first product below initial viewport");
   await page.locator('#collection a[aria-label="حامل عبوات التوابل"]').click();
   await page.waitForURL(new RegExp("/"+market+"/p/spice-rack"));
   await page.locator("[data-offer-version]").waitFor();
   if(market==="eg")await page.getByRole("radio",{name:/منطقة التوصيل الأولى/}).check();
   await page.locator("[data-door-total]").waitFor();
   await page.getByRole("radio",{name:/حامل واحد/}).check();
   const addOn=page.locator("[data-offer-add-on] input");
   assert.equal(await addOn.count(),market==="ae"?0:1,label+": add-on eligibility");
   if(await addOn.count())await addOn.check();
   if(width===390){
    const launcher=page.getByRole("button",{name:"افتح مساعد يومياتي الذكي"});
    assert.equal(await launcher.evaluate(el=>getComputedStyle(el.parentElement).position),"static",label+": chat overlaps the mobile product page");
   }
   const door=await page.locator("[data-door-total]").innerText();
   await page.getByRole("button",{name:"أضيفي إلى السلة"}).click();
   await page.getByRole("status").filter({hasText:"أُضيف إلى السلة"}).waitFor();
   await page.goto(base+"/"+market+"/cart",{waitUntil:"domcontentloaded"});
   await page.locator("[data-cart-door-total]").waitFor();
   assert.equal(await page.locator("[data-cart-door-total]").innerText(),door,label+": cart total differs from product door total");
   await page.getByRole("link",{name:/مراجعة الطلب/}).click();
   await page.waitForURL(new RegExp("/"+market+"/checkout"));
   assert.ok(await page.getByRole("button",{name:"تأكيد الطلب"}).isDisabled(),label+": checkout must not submit");
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
   assert.ok(overflow<=2,label+": horizontal overflow "+overflow);
   await page.screenshot({path:path.join(output,label+"-checkout.png"),fullPage:true});
   const other=markets[(markets.indexOf(market)+1)%markets.length];
   await page.goto(base+"/"+other+"/cart",{waitUntil:"domcontentloaded"});
   await page.locator("h1").first().waitFor();
   await page.waitForTimeout(500);
   assert.equal(await page.locator("[data-cart-line]").count(),0,label+": cart leaked into "+other);
   assert.equal(remote.length,0,label+": fixture mode contacted Supabase");
   console.log("PASS "+label+" door "+door);
  }catch(error){
   failures.push(label+": "+error.message);
   await page.screenshot({path:path.join(output,label+"-failure.png"),fullPage:true}).catch(()=>{});
  }finally{await context.close();}
 }
 await browser.close();
 if(failures.length){console.error(failures.join("\n"));process.exit(1);}
 console.log("Offer fixture journey passed in 5 markets at 390 and 1440 px.");
}
main().catch(e=>{console.error(e);process.exit(1);});
