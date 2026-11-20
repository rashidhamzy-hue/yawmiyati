/* Browser-only prelaunch smoke checks. No credentials, real orders or production deploys. */
const {chromium}=require("playwright");
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const base=process.env.QA_BASE_URL||"http://127.0.0.1:4173";
const markets=["sa","ae","om","eg","iq"];
const viewports=[320,390,768,1440];
const output=path.join(process.cwd(),"artifacts","browser-qa");
fs.mkdirSync(output,{recursive:true});
async function main(){
 const browser=await chromium.launch({headless:true});
 const failures=[];
 try{
  for(const market of markets){
   for(const width of viewports){
    const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
    const label=market+"-"+width;
    page.setDefaultTimeout(7000);
    page.setDefaultNavigationTimeout(15000);
    await page.route(/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//,route=>route.abort());
    try{
     const response=await page.goto(base+"/"+market,{waitUntil:"domcontentloaded",timeout:30000});
     assert.equal(response?.status(),200,label+": HTTP error");
     await page.locator("h1").first().waitFor({state:"visible",timeout:15000});
     // TanStack Start renders HTML before the client event handlers hydrate.
     await page.waitForLoadState("networkidle",{timeout:12000}).catch(()=>{});
     await page.waitForTimeout(500);
     await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,2500))]));
     const overflow=await page.evaluate(()=>({
       page:document.documentElement.scrollWidth,
       viewport:document.documentElement.clientWidth,
       body:document.body.scrollWidth
     }));
     assert.ok(overflow.page<=overflow.viewport+2,label+": horizontal overflow "+JSON.stringify(overflow));
     assert.equal(await page.getByRole("heading",{level:1}).count(),1,label+": main heading count");
     const lovProxyImages=await page.locator('main img[src^="/__l5e/"]').count();
     if(lovProxyImages){
       console.warn("ASSET WARNING "+label+": "+lovProxyImages+" editorial images depend on Lovable asset proxy; see issue #75");
       if(process.env.QA_REQUIRE_PORTABLE_IMAGES==="true")throw Error(label+": non-portable editorial assets");
     }
     const heroSearch=page.getByRole("button",{name:"دوّري على اللي يعجبك"});
     await heroSearch.click();
     const dialog=page.getByRole("dialog",{name:"بحث يومياتي الذكي"});
     await dialog.waitFor({state:"visible"});
     assert.equal(new URL(page.url()).pathname,"/"+market,label+": search navigated away");
     await page.keyboard.press("Escape");
     await dialog.waitFor({state:"hidden"});
     if(width<768){
       const mobileNav=page.getByRole("navigation",{name:"التنقل السريع للجوال"});
       assert.ok(await mobileNav.isVisible(),label+": mobile bottom navigation missing");
       await mobileNav.getByRole("button",{name:"البحث"}).click();
       await dialog.waitFor({state:"visible"});
       await dialog.getByRole("button",{name:"إغلاق البحث"}).click();
       await dialog.waitFor({state:"hidden"});
     }
     await page.screenshot({path:path.join(output,label+".png"),fullPage:true,animations:"disabled"});
     console.log("PASS "+label+" storefront, overflow, inline search, Escape");
    }catch(e){
     failures.push(label+": "+e.message);
     console.error("FAIL "+label+": "+e.message);
     await page.screenshot({path:path.join(output,label+"-failure.png"),fullPage:true,timeout:10000}).catch(()=>{});
    }finally{await page.close();}
   }
  }
 }finally{await browser.close();}
 if(failures.length)throw Error(failures.length+" browser QA failures:\n"+failures.join("\n"));
 console.log("PASS all "+(markets.length*viewports.length)+" market/viewport combinations");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
