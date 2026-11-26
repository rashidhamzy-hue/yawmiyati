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
  await page.locator("[data-mobile-buybar]").waitFor({state:"visible"});
  const before=await page.locator("[data-door-total]").innerText();
  await page.getByRole("button",{name:"زيادة الكمية"}).click();
  const door=await page.locator("[data-door-total]").innerText();
  assert.notEqual(door,before);
  await page.locator("[data-mobile-buybar]").getByRole("button",{name:"اشتري الآن"}).click();
  await page.locator("[data-cart-door-total]").waitFor();
  assert.equal(await page.locator("[data-cart-door-total]").innerText(),door);
  assert.ok(await page.getByRole("button",{name:"تأكيد الطلب"}).isDisabled());
  assert.equal(await page.locator("form[action]").count(),0);
  assert.ok(await page.getByRole("button",{name:"إتمام طلب تجريبي"}).isDisabled());
  const sample={sa:"0501234567",ae:"0501234567",om:"91234567",eg:"01012345678",iq:"07701234567"}[market];
  await page.getByLabel("الاسم الكامل").fill("عميلة تجريبية");
  await page.getByLabel("رقم الجوال").fill(sample);
  await page.locator('input[name="city"]').fill("مدينة اختبار");
  await page.getByLabel("العنوان بالتفصيل").fill("حي الاختبار، شارع ١، مبنى ٢");
  await page.getByRole("button",{name:"إتمام طلب تجريبي"}).click();
  await page.getByText("تمت محاكاة الطلب بنجاح. لم يُرسل طلب حقيقي.").waitFor();
  await page.goto(base+"/"+market+"/c/home",{waitUntil:"domcontentloaded"});
  const categoryGrid=page.getByRole("region",{name:"منتجات القسم"});
  await categoryGrid.locator('article a[href*="/p/preview-"]').first().waitFor({timeout:20000});
  const switches=page.getByRole("navigation",{name:"تبديل الأقسام"});
  for(const slug of ["kitchen","beauty","fashion","wellness","organize","home"]){
   await switches.locator('a[href$="/c/'+slug+'"]').click();
   await page.waitForURL(new RegExp("/"+market+"/c/"+slug+"$"));
   await page.getByRole("region",{name:"منتجات القسم"}).locator("article a").first().waitFor({timeout:20000});
   assert.equal(await switches.locator('[aria-current="page"]').getAttribute("href"),"/"+market+"/c/"+slug);
  }
  await page.getByRole("combobox",{name:"ترتيب المنتجات"}).selectOption("low");
  await page.getByRole("searchbox",{name:"البحث في هذا القسم"}).fill("zzzz-no-match");
  await categoryGrid.getByText("لا توجد نتائج مطابقة.",{exact:false}).waitFor();
  await page.getByRole("searchbox",{name:"البحث في هذا القسم"}).fill("");
  await categoryGrid.locator("article a").first().waitFor();
  assert.equal(forbidden.length,0);
  console.log("PASS preview catalog "+market+" search, pagination, product, checkout and category");
  await page.close();
 }
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exit(1);});
