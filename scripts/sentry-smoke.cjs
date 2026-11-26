// Loads staging, waits for the lazy Sentry SDK, throws one labelled error and
// requires Sentry's ingest endpoint to accept it (HTTP 200).
const {chromium}=require("playwright");
(async()=>{
 const base=process.env.BASE;
 const browser=await chromium.launch();
 const page=await browser.newPage();
 const accepted=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error("no Sentry ingest request within 30 s")),30000);
  page.on("response",res=>{
   if(/ingest\.de\.sentry\.io\/api\/\d+\/envelope/.test(res.url())){clearTimeout(timer);resolve(res.status());}
  });
 });
 await page.goto(base+"/sa/story",{waitUntil:"load",timeout:60000});
 await page.waitForFunction(()=>performance.getEntriesByType("resource").some(r=>r.name.includes("sentry-browser-sdk")),null,{timeout:20000});
 await page.waitForTimeout(1500);
 const label="Yawmiyati Sentry smoke test "+new Date().toISOString();
 await page.evaluate(l=>{setTimeout(()=>{throw new Error(l);},0);},label);
 const status=await accepted;
 console.log("Sentry ingest status:",status,"for:",label);
 await browser.close();
 if(status!==200)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
