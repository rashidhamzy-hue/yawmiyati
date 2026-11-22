const {chromium}=require("playwright-core");
const assert=require("node:assert/strict");
const {pathToFileURL}=require("node:url");
(async()=>{
  const browser=await chromium.launch({channel:"chrome",headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto(pathToFileURL(process.argv[2]).href);
    await page.check("#behavior");await page.check("#ads");
    for(const code of ["sa","ae","om","eg","iq"]){
      await page.selectOption("#market",code);
      await page.selectOption("#campaign","demo-meta-kitchen");
      await page.click("#packs button:nth-child(2)");await page.click("#add");
      await page.click("#checkout");await page.click("#submitOrder");
      assert.match(await page.textContent("#metrics"),/1 submitted · 0 retained/);
      await page.click("#examples");await page.click("#examples");
      assert.match(await page.textContent("#metrics"),/4 submitted · 1 retained/);
      assert.match(await page.textContent("#orders"),/returned/);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=390));
    }
    await page.reload();await page.selectOption("#market","iq");
    assert.match(await page.textContent("#metrics"),/4 submitted/);assert.deepEqual(errors,[]);
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
