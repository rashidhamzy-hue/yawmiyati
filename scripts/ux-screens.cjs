/* UX review screenshots: every shopper page type at 4 widths, with isolated offer fixtures
 * (loopback only, never shipped). Output: ux-screens/<market>-<page>-<width>.jpg */
const {chromium}=require("playwright");
const fs=require("node:fs");const path=require("node:path");
const base=process.env.QA_OFFER_BASE_URL||"http://127.0.0.1:4176";
const out=path.join(process.cwd(),"ux-screens");fs.mkdirSync(out,{recursive:true});
const widths=[360,390,768,1440];
(async()=>{
 const browser=await chromium.launch({headless:true});
 for(const market of ["sa","eg"])for(const width of widths){
  const ctx=await browser.newContext({viewport:{width,height:width<800?800:900},deviceScaleFactor:1,locale:"ar"});
  const page=await ctx.newPage();page.setDefaultTimeout(15000);
  const shot=async name=>{await page.waitForTimeout(700);await page.screenshot({path:path.join(out,`${market}-${name}-${width}.jpg`),fullPage:true,type:"jpeg",quality:55});};
  try{
   await page.goto(`${base}/${market}`,{waitUntil:"networkidle"});await shot("home");
   await page.goto(`${base}/${market}/c/organize`,{waitUntil:"networkidle"});await shot("category");
   await page.goto(`${base}/${market}/p/spice-rack`,{waitUntil:"networkidle"});await page.locator("[data-offer-version]").waitFor();
   if(market==="eg")await page.getByRole("radio",{name:/منطقة التوصيل الأولى/}).check();
   await shot("product");
   await page.getByRole("button",{name:"أضيفي إلى السلة"}).click();
   await page.goto(`${base}/${market}/cart`,{waitUntil:"networkidle"});await shot("cart");
   await page.getByRole("link",{name:/مراجعة الطلب/}).click();await page.waitForURL(/checkout/);await shot("checkout");
   await page.goto(`${base}/${market}`,{waitUntil:"networkidle"});
   await page.evaluate(()=>document.dispatchEvent(new CustomEvent("yawmiyati:open-search")));
   await page.getByRole("dialog",{name:"بحث يومياتي الذكي"}).getByRole("searchbox").fill("قهوة");await shot("search");
   if(width===390){
    await page.goto(`${base}/${market}/info/shipping-returns`,{waitUntil:"networkidle"});await shot("info");
    await page.goto(`${base}/${market}/story`,{waitUntil:"networkidle"});await shot("story");
   }
   console.log("ok",market,width);
  }catch(e){console.log("FAIL",market,width,e.message);await shot("failure").catch(()=>{});}
  await ctx.close();
 }
 for(const market of ["ae","om","iq"]){const ctx=await browser.newContext({viewport:{width:390,height:800}});const page=await ctx.newPage();await page.goto(`${base}/${market}`,{waitUntil:"networkidle"});await page.waitForTimeout(700);await page.screenshot({path:path.join(out,`${market}-home-390.jpg`),fullPage:true,type:"jpeg",quality:55});await ctx.close();}
 await browser.close();
})();
