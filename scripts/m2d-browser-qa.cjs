/**
 * M2D Chromium acceptance for isolated, password-gated localhost preview.
 * No external requests, no real supplier/checkout/PII, no deployed preview.
 */
const { chromium } = require("playwright");
const { mkdirSync } = require("node:fs");
const { join } = require("node:path");

const url="http://127.0.0.1:4174/__local_owner_review";
const secret=process.env.YAWMIYATI_LOCAL_PREVIEW_SECRET;
if(!secret || secret.length<32)throw Error("M2D browser test requires ephemeral preview credential");
const countries=["sa","ae","om","eg","iq"];
const viewports=[320,390,768,1440];
const artifactDir=join(process.cwd(),"artifacts/browser-qa/m2d");
mkdirSync(artifactDir,{recursive:true});

async function checkDenied(path) {
  const response=await fetch("http://127.0.0.1:4174"+path);
  if(response.status!==401)throw Error("Unauthenticated local demo path exposed: "+path+" ("+response.status+")");
}
async function run() {
  await checkDenied("/__local_owner_review");
  await checkDenied("/src/test/m2d-local-preview-entry.tsx");
  await checkDenied("/src/lib/store/simulation/fixtures.ts");
  const browser=await chromium.launch({headless:true});
  try {
    for(const width of viewports) {
      for(const market of countries) {
        const context=await browser.newContext({
          viewport:{width,height:900},
          httpCredentials:{username:"owner",password:secret},
          locale:"ar-SA",
          reducedMotion:"reduce",
        });
        const page=await context.newPage();
        const external=[];
        page.on("request",request=>{
          try{if(new URL(request.url()).hostname!=="127.0.0.1")external.push(request.url());}
          catch{external.push(request.url());}
        });
        const errors=[];
        page.on("pageerror",error=>errors.push(error.message));
        try {
          const response=await page.goto(url,{waitUntil:"networkidle",timeout:30000});
          if(response.status()!==200)throw Error("Owner preview did not authenticate");
          await page.getByRole("heading",{name:"مراجعة يومياتي الداخلية — دون نشر"}).waitFor();
          const preview=page.locator('[data-testid="local-owner-review"]');
          if(await preview.count()!==1)throw Error("Owner preview missing");
          await page.getByRole("combobox",{name:"بلد مراجعة المالك"}).selectOption(market);
          await page.getByText("DEMO · SIMULATION ONLY").waitFor();
          if(await page.getByRole("combobox",{name:"دولة التجربة"}).isEnabled())throw Error("Nested catalog market unlocked");
          const metrics=await page.evaluate(()=>({
            overflow:document.documentElement.scrollWidth-window.innerWidth,
            rtl:document.documentElement.dir==="rtl",
            market:document.querySelector('[data-yawmiyati-market]')?.getAttribute("data-yawmiyati-market"),
          }));
          if(metrics.overflow>2)throw Error("Horizontal overflow by "+metrics.overflow+" px, "+market+" at "+width);
          if(!metrics.rtl||metrics.market!==market)throw Error("RTL or country scope mismatch");
          await page.getByRole("combobox",{name:"تقييم rtl"}).selectOption("pass");
          await page.getByRole("button",{name:"تحضير تقرير المراجعة المحلي"}).click();
          const report=JSON.parse(await page.getByTestId("local-review-report").inputValue());
          if(report.mode!=="SIMULATION_ONLY" || report.synthetic!==true || report.checks.length!==50)throw Error("Invalid offline review report");

          await page.getByRole("button",{name:"محاكاة السلة والدفع عند الاستلام"}).click();
          await page.getByText("DEMO · SIMULATION ONLY").waitFor();
          if(await page.getByRole("combobox",{name:"دولة اختبار الدفع"}).isEnabled())throw Error("Nested COD market unlocked");
          const add=page.getByRole("button",{name:/إضافة تجريبية:/}).filter({visible:true}).first();
          if(await add.isDisabled()) {
            const buttons=page.getByRole("button",{name:/إضافة تجريبية:/});
            let found=false;
            for(let i=0;i<await buttons.count();i++) {
              if(await buttons.nth(i).isEnabled()) {await buttons.nth(i).click();found=true;break;}
            }
            if(!found)throw Error("No simulated available product");
          } else await add.click();
          await page.getByRole("button",{name:"التالي: عنوان اصطناعي"}).click();
          await page.getByRole("button",{name:"استخدام العنوان الاصطناعي"}).click();
          await page.getByRole("button",{name:"مراجعة الطلب التجريبي"}).click();
          await page.getByRole("checkbox").check();
          await page.getByRole("button",{name:"إنشاء إيصال محاكاة فقط"}).click();
          const orderId=await page.getByTestId("simulation-order-id").innerText();
          if(!orderId.startsWith("SIM-"+market.toUpperCase()+"-ORDER-"))throw Error("Missing market-scoped SIM receipt");
          const after=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
          if(after>2)throw Error("COD receipt viewport overflow by "+after+"px");
          await page.screenshot({path:join(artifactDir,market+"-"+width+".png"),fullPage:true});
          // A focused keyboard acceptance check on the visible restart control.
          const restart=page.getByRole("button",{name:"بدء محاكاة جديدة"}).last();
          await restart.focus();
          const focusVisible=await restart.evaluate(el=>el===document.activeElement);
          if(!focusVisible)throw Error("Keyboard focus not retained");
          if(external.length)throw Error("Unexpected external request(s): "+external.join(", "));
          if(errors.length)throw Error("Page error(s): "+errors.join(" | "));
          console.log("M2D offline accepted: "+market+" "+width+"px");
        }finally{await context.close();}
      }
    }
  } finally {await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
