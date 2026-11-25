/* Exercise the preview-only catalog in Chromium, without contacting live services. */
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const base="http://preview-catalog.test:4173";
const markets=["sa","ae","om","eg","iq"];
async function main(){
 const browser=await chromium.launch({headless:true,args:["--host-resolver-rules=MAP preview-catalog.test 127.0.0.1","--no-proxy-server"]});
 try{
 for(const market of markets){
  const page=await browser.newPage({viewport:{width:390,height:900}});
  const forbidden=[];
  page.on("request",r=>{if(/supabase\.co/.test(r.url()))forbidden.push(r.url())});
  await page.route(/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|media\.taager\.com)\//,r=>r.abort());
  await page.goto(base+"/"+market,{waitUntil:"domcontentloaded"});
  await page.locator("[data-offer-fixture-notice]").first().waitFor({timeout:20000});
  const cards=page.locator("#collection article");
  assert.equal(await cards.count(),16);
  await page.getByRole("button",{name:"عرض المزيد من المنتجات"}).click();
  assert.equal(await cards.count(),32);
  const first=cards.first().locator("a");
  const title=await first.getAttribute("aria-label");
  assert.ok(title);
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent("yawmiyati:open-search")));
  const search=page.getByRole("dialog",{name:"بحث يومياتي الذكي"});
  await search.getByRole("searchbox").fill(title.split(" ").slice(0,2).join(" "));
  await search.locator('a[href*="/p/preview-"]').first().waitFor();
  await search.getByRole("button",{name:"إغلاق البحث"}).click();
  await first.click();
  await page.locator("[data-offer-version]").waitFor();
  if(market==="eg")await page.getByRole("radio",{name:/القاهرة والجيزة والإسكندرية/}).check();
  const door=await page.locator("[data-door-total]").innerText();
  await page.getByRole("button",{name:"أضيفي إلى السلة"}).click();
  await page.getByRole("link",{name:"مراجعة الطلب مباشرة"}).click();
  await page.locator("[data-cart-door-total]").waitFor();
  assert.equal(await page.locator("[data-cart-door-total]").innerText(),door);
  assert.ok(await page.getByRole("button",{name:"تأكيد الطلب"}).isDisabled());
  assert.equal(await page.locator('form,input[type=tel]').count(),0);
  await page.goto(base+"/"+market+"/c/home",{waitUntil:"domcontentloaded"});
  await page.getByRole("region",{name:"منتجات القسم"}).waitFor();
  assert.ok(await page.locator('main a[href*="/p/preview-"]').count()>0);
  assert.equal(forbidden.length,0);
  console.log("PASS preview catalog "+market+" search, pagination, product, checkout and category");
  await page.close();
 }
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exit(1);});
