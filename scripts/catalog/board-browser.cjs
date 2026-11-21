const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");
const {pathToFileURL} = require("node:url");
const {readFileSync} = require("node:fs");
async function main(){
  const browser=await chromium.launch({channel:"chrome",headless:true});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(pathToFileURL(process.argv[2]).href);
    const choices=page.getByRole("checkbox");
    assert.equal(await choices.count(),10);
    await choices.first().check();
    const pending=page.waitForEvent("download");
    await page.getByRole("button",{name:"Download selected offers"}).click();
    const download=await pending;
    assert.equal(download.suggestedFilename(),"selected-offers.json");
    const selected=JSON.parse(readFileSync(await download.path(),"utf8"));
    assert.equal(selected.length,1);
    assert.equal(selected[0].market,"sa");
    assert.match(selected[0].revision,/^[a-f0-9]{64}$/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=390));
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
