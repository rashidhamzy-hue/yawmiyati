/* Browser-only prelaunch smoke checks. No credentials, real orders or production deploys. */
const {chromium}=require("playwright");
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const base=process.env.QA_BASE_URL||"http://127.0.0.1:4173";
const markets=["sa","ae","om","eg","iq"];
const searchLabels={sa:"دوّري على اللي يعجبك",ae:"شو ودّج تلاقين؟",om:"وش في بالك اليوم؟",eg:"بتدوّري على إيه؟",iq:"شنو ببالچ اليوم؟"};
const viewports=[320,390,768,1024,1440];
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
     const schema=await page.locator('script[type="application/ld+json"]').allTextContents();
     assert.ok(schema.some(raw=>JSON.parse(raw)["@graph"]?.some(node=>node["@type"]==="FAQPage")),label+": editorial JSON-LD missing");
     assert.ok((await page.locator('meta[name="robots"]').getAttribute("content"))?.includes("noindex"),label+": noindex missing");
     assert.ok(!schema.some(raw=>/"@type"\s*:\s*"(Product|Offer)"/.test(raw)),label+": commercial schema leaked");
     const hero=page.locator("main > #store-hero:first-child");
     assert.equal(await hero.count(),1,label+": country hero must open the homepage");
     assert.equal(await page.locator("#store-hero + #discover").count(),1,label+": department discovery must follow hero");
     assert.equal(await page.locator("#discover + #collection").count(),1,label+": product shelf must follow department discovery");
     if(width===390)await page.screenshot({path:path.join(output,label+"-first-screen.png"),animations:"disabled"});
     const firstDepartment=page.locator("#discover nav a").first();
     assert.ok(await firstDepartment.count(),label+": first department link missing");
     const departmentPhoto=firstDepartment.locator("img");
     assert.ok(await departmentPhoto.count(),label+": department photo missing");
     const firstBox=await firstDepartment.boundingBox();
     assert.ok(firstBox&&firstBox.y+60<900,label+": department discovery below first viewport");
     const firstShoppingTile=page.locator("#collection nav a, #collection article a").first();
     assert.ok(await firstShoppingTile.count(),label+": approved product or editorial browsing tile missing");
     const lovProxyImages=await page.locator('main img[src^="/__l5e/"]').count();
     if(lovProxyImages){
       console.warn("ASSET WARNING "+label+": "+lovProxyImages+" editorial images depend on Lovable asset proxy; see issue #75");
       if(process.env.QA_REQUIRE_PORTABLE_IMAGES==="true")throw Error(label+": non-portable editorial assets");
     }
     const heroSearch=page.getByRole("button",{name:searchLabels[market]});
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
     if(width===390||width===1440){
       const editorial=page.locator('main img[src^="https://images.unsplash.com/"]');
       assert.ok(await editorial.count()>=6,label+": incomplete licensed editorial photo set");
       for(const index of [0,1,2]){
         const item=editorial.nth(index);
         await item.evaluate(async(img)=>{
           img.loading="eager";
           await img.decode();
         },{timeout:20000});
         assert.ok(await item.evaluate(img=>img.naturalWidth>0),label+": editorial photo "+index+" could not decode");
       }
     }
     await page.screenshot({path:path.join(output,label+".png"),fullPage:true,animations:"disabled"});
     if(width===390){
       const policyResponse=await page.goto(base+"/"+market+"/info/shipping-returns",{waitUntil:"domcontentloaded",timeout:30000});
       assert.equal(policyResponse?.status(),200,label+": country policy HTTP error");
       await page.locator("h1").first().waitFor({state:"visible"});
       const text=await page.locator("main").innerText();
       assert.ok(text.includes("الدفع عند الاستلام"),label+": local COD guidance missing");
       assert.ok(!text.includes("تاجر"),label+": supplier name leaked into customer policy");
       await page.screenshot({path:path.join(output,label+"-shipping.png"),fullPage:true,animations:"disabled"});
       const story=await page.goto(base+"/"+market+"/story",{waitUntil:"domcontentloaded",timeout:30000});
       assert.equal(story?.status(),200,label+": story route HTTP error");
       await page.locator('h1').first().waitFor({state:"visible"});
       const storyCards=await page.locator("main article").count();
       assert.ok(storyCards>=6,label+": story lacks full editorial sections");
       const storyOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
       assert.ok(storyOverflow<=2,label+": story page horizontal overflow "+storyOverflow);
       await page.screenshot({path:path.join(output,label+"-story.png"),fullPage:true,animations:"disabled"});

     }
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
